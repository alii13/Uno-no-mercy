-- Room invites. Run in the Supabase SQL Editor AFTER friends.sql (the block
-- check reads `friendships`). Additive: one table, one policy, three
-- SECURITY DEFINER functions, one publication change.
--
-- Reach is open by decision: anyone may invite anyone, and friendship is not
-- required. The controls that replace it are here - a block check, a cooldown
-- per pair, and an hourly cap per sender - because an open invite surface is
-- the first thing a pest finds.
--
-- Unlike `friendships`, this table has a SELECT policy. Realtime delivers
-- postgres_changes through RLS, so the recipient must be able to read their
-- own row or the subscription reports nothing. Writes still have no policy:
-- they go through send_room_invite, which is where the limits live.

create table if not exists room_invites (
    id uuid primary key default gen_random_uuid(),
    from_user uuid not null references auth.users(id) on delete cascade,
    to_user uuid not null references auth.users(id) on delete cascade,
    room_code text not null,
    created_at timestamptz not null default now(),
    -- Set when the recipient answers or dismisses. Keeps an answered invite
    -- from returning on the next page load.
    seen_at timestamptz
);

create index if not exists room_invites_to_idx on room_invites (to_user, created_at desc);
create index if not exists room_invites_from_idx on room_invites (from_user, created_at desc);

alter table room_invites enable row level security;

drop policy if exists room_invites_read_own on room_invites;
create policy room_invites_read_own on room_invites
    for select using (to_user = auth.uid());

-- Realtime carries the invite to a player sitting on the home screen, where
-- the game socket does not exist. Adding a table twice raises, so the guard
-- keeps this file re-runnable.
do $$
begin
    alter publication supabase_realtime add table room_invites;
exception when duplicate_object then null;
end;
$$;

-- --- Write ------------------------------------------------------------------

-- Ask someone to your room. Returns: sent, blocked, self, too_soon,
-- rate_limited, not_found, bad_code, unauthorized.
--
-- The caller is the game server, not the player: p_from is supplied rather
-- than read from auth.uid(), and only service_role may execute. That is what
-- makes "X wants you at their table" a fact instead of a claim - the Durable
-- Object holds the sender's authenticated socket for that room, so it knows
-- they are actually sitting in it. A definer function reading auth.uid()
-- could only know who asked, never where they were.
--
-- Membership in the room is checked before this function is reached, by the
-- Durable Object that holds the sender's socket. What is left here is the
-- sender's conduct: is this pair blocked, is it too soon, is it too many.

drop function if exists public.send_room_invite(uuid, text);

create or replace function public.send_room_invite(p_from uuid, p_user uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := p_from;
    recent int;
begin
    if me is null then return 'unauthorized'; end if;
    if p_user is null or p_user = me then return 'self'; end if;
    if p_code is null or p_code !~ '^[A-Za-z0-9]{4,12}$' then return 'bad_code'; end if;
    if not exists (select 1 from profiles where id = p_user) then return 'not_found'; end if;

    -- A block stops the invite whichever side placed it.
    if exists (
        select 1 from friendships
        where status = 'blocked'
          and least(requester_id, addressee_id) = least(me, p_user)
          and greatest(requester_id, addressee_id) = greatest(me, p_user)
    ) then return 'blocked'; end if;

    -- One invite per pair per five minutes. This is the rule that decides
    -- whether an unwanted invite is a nuisance or a barrage.
    if exists (
        select 1 from room_invites
        where from_user = me and to_user = p_user
          and created_at > now() - interval '5 minutes'
    ) then return 'too_soon'; end if;

    select count(*) into recent from room_invites
    where from_user = me and created_at > now() - interval '1 hour';
    if recent >= 20 then return 'rate_limited'; end if;

    -- Opportunistic sweep on the one path that writes. Both reads are time
    -- bounded - ten minutes for the toast, an hour for the cap - so nothing
    -- needs a row older than a day, and the table stays proportional to
    -- activity rather than to the age of the feature.
    delete from room_invites where created_at < now() - interval '1 day';

    insert into room_invites (from_user, to_user, room_code)
    values (me, p_user, upper(p_code));
    return 'sent';
end;
$$;

-- No client path at all: the worker calls this with the service key.
revoke execute on function public.send_room_invite(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.send_room_invite(uuid, uuid, text) to service_role;

-- --- Reads ------------------------------------------------------------------

-- Invites worth showing: mine, unanswered, and young enough that the room is
-- probably still there. Ten minutes matches the public-room GC window in
-- game-server/src/roomGc.ts.

create or replace function public.my_invites()
returns table (
    id uuid,
    from_user uuid,
    from_username text,
    room_code text,
    created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
    select i.id, i.from_user, p.username, i.room_code, i.created_at
    from room_invites i
    join profiles p on p.id = i.from_user
    where i.to_user = auth.uid()
      and i.seen_at is null
      and i.created_at > now() - interval '10 minutes'
    order by i.created_at desc
$$;

revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

-- Answered or waved away - either way it must not come back on reload.

create or replace function public.dismiss_invite(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return 'unauthorized'; end if;
    update room_invites set seen_at = now()
    where id = p_id and to_user = me and seen_at is null;
    if not found then return 'not_found'; end if;
    return 'dismissed';
end;
$$;

revoke execute on function public.dismiss_invite(uuid) from public, anon;
grant execute on function public.dismiss_invite(uuid) to authenticated;
