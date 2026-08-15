-- Presence. Run in the Supabase SQL Editor. Additive: one column, one index,
-- two SECURITY DEFINER functions, two grants. No table is dropped.
--
-- One column answers three questions - "is this player online?", "when were
-- they last here?", and "how many are playing right now?". The client writes
-- its own row on load and every 60s while its tab is visible; owner-update
-- RLS already allows that, so no function is needed to write.
--
-- What this exposes: a last-seen timestamp per user id, to anyone who already
-- has that id. Ids are public today through the leaderboards and profile
-- pages, so this adds a timestamp, not an identity.

alter table profiles add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_idx on profiles (last_seen_at desc);

-- Two minutes, not one: the heartbeat runs every 60s, so one missed beat must
-- not flip a present player to offline. Keep this in step with
-- ONLINE_WINDOW_MS in frontend/src/utils/relativeTime.ts.

create or replace function public.players_presence(ids uuid[])
returns table (user_id uuid, last_seen_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
    select id, last_seen_at
    from profiles
    where id = any(ids)
$$;

grant execute on function public.players_presence to anon, authenticated;

-- The live population. Counts players, not sockets: a player with two tabs
-- open is one row.

create or replace function public.online_now()
returns int
language sql
security definer
set search_path = public
stable
as $$
    select count(*)::int
    from profiles
    where last_seen_at > now() - interval '2 minutes'
$$;

grant execute on function public.online_now to anon, authenticated;
