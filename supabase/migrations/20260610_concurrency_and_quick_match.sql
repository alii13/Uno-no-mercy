-- Concurrency + Quick Match support. Apply in the Supabase SQL editor BEFORE
-- deploying the client built from this branch — the client writes these
-- columns unconditionally and will error if they don't exist.

-- Optimistic-concurrency version for the games row. Every client write is a
-- compare-and-swap: UPDATE ... SET version = expected + 1 WHERE version =
-- expected. A write computed from a stale board affects 0 rows instead of
-- silently overwriting a newer one (last-write-wins divergence).
alter table public.games
  add column if not exists version integer not null default 0;

-- Quick Match: public rooms strangers can drop into.
alter table public.games
  add column if not exists is_public boolean not null default false;

-- Speeds up the Quick Match lobby scan (open public rooms, oldest first).
create index if not exists games_quick_match_idx
  on public.games (created_at)
  where status = 'waiting' and is_public;

-- Two players joining simultaneously can both compute the same seat from a
-- non-atomic count. Make the DB reject the duplicate; the client retries with
-- the next seat. NOTE: fails if existing rows already contain duplicate
-- (game_id, seat_order) pairs — clean those up first if so:
--   select game_id, seat_order, count(*) from public.game_players
--   group by 1, 2 having count(*) > 1;
-- Skip if an equivalent constraint already exists under either name (the
-- default Postgres name appears when the constraint was added unnamed) —
-- otherwise this would stack a second, redundant unique index.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_players'::regclass
      and contype = 'u'
      and conname in ('game_players_game_seat_unique', 'game_players_game_id_seat_order_key')
  ) then
    alter table public.game_players
      add constraint game_players_game_seat_unique unique (game_id, seat_order);
  end if;
end $$;
