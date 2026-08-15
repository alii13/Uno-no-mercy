-- Friends. Run in the Supabase SQL Editor AFTER presence.sql (my_friends
-- returns last_seen_at). Additive: one table, five SECURITY DEFINER
-- functions, grants. Re-running the whole file is safe.
--
-- One row per pair, whichever way round the request went. The unique index on
-- (least, greatest) is what enforces that: without it A -> B and B -> A can
-- both exist, and "are we friends?" stops having one answer.
--
-- RLS is on and the table has no policies, so no client can read or write it
-- directly. Every path goes through the functions below, which is the only
-- place a rate limit or a block check can actually live.

create table if not exists friendships (
    requester_id uuid not null references auth.users(id) on delete cascade,
    addressee_id uuid not null references auth.users(id) on delete cascade,
    status text not null check (status in ('pending', 'accepted', 'blocked', 'declined')),
    -- Who pressed block. Null unless status is 'blocked'; without it the row
    -- cannot say which side is unwelcome.
    blocked_by uuid references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    responded_at timestamptz,
    primary key (requester_id, addressee_id)
);

create unique index if not exists friendships_pair_idx
    on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_addressee_idx on friendships (addressee_id, status);

-- Idempotent, so a database that ran an earlier copy of this file picks up
-- 'declined' instead of failing every refusal on the old check.
alter table friendships drop constraint if exists friendships_status_check;
alter table friendships add constraint friendships_status_check
    check (status in ('pending', 'accepted', 'blocked', 'declined'));

alter table friendships enable row level security;

-- --- Writes -----------------------------------------------------------------

-- Ask to be friends. Returns one of: sent, accepted, already, blocked, self,
-- rate_limited. A request to someone who already asked you accepts theirs -
-- two people pressing ADD at the same time should end as friends, not as two
-- pending rows nobody can resolve.

create or replace function public.send_friend_request(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    existing friendships%rowtype;
    sent_today int;
begin
    if me is null then return 'unauthorized'; end if;
    if p_user is null or p_user = me then return 'self'; end if;

    if not exists (select 1 from profiles where id = p_user) then return 'not_found'; end if;

    select * into existing from friendships
    where least(requester_id, addressee_id) = least(me, p_user)
      and greatest(requester_id, addressee_id) = greatest(me, p_user);

    -- Tested on the row, not on FOUND: FOUND belongs to the last statement
    -- that set it, and anything added above this line would silently move it.
    if existing.requester_id is not null then
        if existing.status = 'blocked' then return 'blocked'; end if;
        if existing.status = 'accepted' then return 'already'; end if;
        if existing.status = 'declined' then
            -- A refusal holds for a week. Long enough that DECLINE means
            -- something, short enough that it is not a life sentence.
            if existing.responded_at > now() - interval '7 days' then return 'declined'; end if;
            update friendships
            set requester_id = me, addressee_id = p_user, status = 'pending',
                created_at = now(), responded_at = null
            where requester_id = existing.requester_id and addressee_id = existing.addressee_id;
            return 'sent';
        end if;
        -- Pending: theirs to me becomes friendship, mine to them stays put.
        if existing.addressee_id = me then
            update friendships set status = 'accepted', responded_at = now()
            where requester_id = existing.requester_id and addressee_id = existing.addressee_id;
            return 'accepted';
        end if;
        return 'already';
    end if;

    -- A cap on strangers asked per day. The number is deliberately generous:
    -- it is here to stop a script, not a sociable player.
    --
    -- Declined rows count. They used to be deleted, which meant a burst of
    -- refusals handed the sender their slots straight back - the cap only
    -- ever bit someone nobody had answered yet.
    select count(*) into sent_today from friendships
    where requester_id = me and created_at > now() - interval '24 hours';
    if sent_today >= 20 then return 'rate_limited'; end if;

    insert into friendships (requester_id, addressee_id, status)
    values (me, p_user, 'pending');
    return 'sent';
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase grants it to
-- anon explicitly on top - revoking PUBLIC alone leaves anon holding it.
revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- Answer a request addressed to me. Declining keeps the row as 'declined'
-- rather than deleting it: a deleted refusal let the same person ask again
-- immediately, and handed their daily cap a free slot. The refusal expires
-- after a week in send_friend_request, so it bounds a pest without being a
-- permanent grudge.

create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return 'unauthorized'; end if;

    if p_accept then
        update friendships set status = 'accepted', responded_at = now()
        where requester_id = p_user and addressee_id = me and status = 'pending';
        if not found then return 'not_found'; end if;
        return 'accepted';
    end if;

    update friendships set status = 'declined', responded_at = now()
    where requester_id = p_user and addressee_id = me and status = 'pending';
    if not found then return 'not_found'; end if;
    return 'declined';
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase grants it to
-- anon explicitly on top - revoking PUBLIC alone leaves anon holding it.
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Block. Overwrites whatever the pair had, including an accepted friendship,
-- and send_friend_request refuses both directions afterwards.

create or replace function public.block_player(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return 'unauthorized'; end if;
    if p_user is null or p_user = me then return 'self'; end if;

    delete from friendships
    where least(requester_id, addressee_id) = least(me, p_user)
      and greatest(requester_id, addressee_id) = greatest(me, p_user);

    insert into friendships (requester_id, addressee_id, status, blocked_by, responded_at)
    values (me, p_user, 'blocked', me, now());
    return 'blocked';
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase grants it to
-- anon explicitly on top - revoking PUBLIC alone leaves anon holding it.
revoke execute on function public.block_player(uuid) from public, anon;
grant execute on function public.block_player(uuid) to authenticated;

-- Undo my own block. A block placed by the other side stays.

create or replace function public.unblock_player(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return 'unauthorized'; end if;

    delete from friendships
    where status = 'blocked' and blocked_by = me
      and least(requester_id, addressee_id) = least(me, p_user)
      and greatest(requester_id, addressee_id) = greatest(me, p_user);
    if not found then return 'not_found'; end if;
    return 'unblocked';
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase grants it to
-- anon explicitly on top - revoking PUBLIC alone leaves anon holding it.
revoke execute on function public.unblock_player(uuid) from public, anon;
grant execute on function public.unblock_player(uuid) to authenticated;

-- --- Read -------------------------------------------------------------------

-- Everyone connected to me, in one round trip: accepted friends, requests in
-- both directions, and the people I have blocked. `incoming` is what the UI
-- needs to tell "they asked you" from "you asked them"; a block placed by the
-- other side is not returned at all, because there is nothing to act on.

create or replace function public.my_friends()
returns table (
    user_id uuid,
    username text,
    share_code text,
    skin text,
    last_seen_at timestamptz,
    status text,
    incoming boolean,
    created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
    select
        p.id,
        p.username,
        p.share_code,
        p.equipped_card_back,
        p.last_seen_at,
        f.status,
        f.addressee_id = auth.uid(),
        f.created_at
    from friendships f
    join profiles p
      on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
    where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
      and f.status <> 'declined'
      and (f.status <> 'blocked' or f.blocked_by = auth.uid())
    order by f.created_at desc
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase grants it to
-- anon explicitly on top - revoking PUBLIC alone leaves anon holding it.
revoke execute on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;
