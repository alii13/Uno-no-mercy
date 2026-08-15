-- Presence. Run in the Supabase SQL Editor. Additive: one column, one index,
-- three SECURITY DEFINER functions, three grants. No table is dropped, and
-- re-running the whole file is safe.
--
-- One column answers three questions - "is this player online?", "when were
-- they last here?", and "how many are playing right now?". The client checks
-- in through touch_presence() on load and every 60s while its tab is visible.
--
-- What this exposes: a last-seen timestamp per user id, to anyone who already
-- has that id. Ids are public today through the leaderboards and profile
-- pages, so this adds a timestamp, not an identity.
--
-- The read is granted to `anon` on purpose, and the cost is understood: a
-- shared profile link shows last-seen to a visitor who is not signed in, and
-- a script that knows a user id can poll it and learn when that player is
-- usually around. The invite case won the call - a link that says "online
-- now" to whoever opens it is the point. Narrowing this to accepted friends
-- stays available once the friendships table lands.

alter table profiles add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_idx on profiles (last_seen_at desc);

-- The check-in. The server supplies the time, so one clock decides both the
-- write and the two reads below.
--
-- The client could update its own row directly - owner-update RLS allows it -
-- but then the timestamp would be whatever the browser believes, and a device
-- with a wrong clock would be permanently online or permanently offline. It
-- would also be settable by hand: a future value reads as ONLINE NOW forever.

create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = public
as $$
    update profiles set last_seen_at = now() where id = auth.uid()
$$;

-- Signed in only, and it writes exactly one row - the caller's own. Guests
-- count: an anonymous Supabase user is authenticated.
--
-- Both PUBLIC and anon have to be named: a new function is granted EXECUTE
-- to PUBLIC by Postgres and to anon by the project's default privileges, and
-- revoking one leaves the other. Even so, a call that got through would
-- update zero rows, because auth.uid() is null. The two reads below keep
-- their open grants deliberately.
revoke execute on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

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
