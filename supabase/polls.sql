-- One-question polls asked from the loud card. Run in the Supabase SQL
-- Editor. Additive: one table, RLS, and nothing else reads it.
--
-- The question itself is not here. It lives in
-- frontend/src/data/polls.ts, because asking is a deploy anyway and a table
-- would add a fetch and a policy to carry four lines of copy. This table
-- holds answers only.
--
-- Answers stay private. No policy exposes anyone else's vote, and there is
-- deliberately no results view: a view in `public` is reachable through the
-- API and does not enforce the underlying RLS unless it is declared
-- security_invoker, so publishing one would hand every vote to anon. Read the
-- tally in the SQL Editor with the queries at the bottom of this file.

create table if not exists public.poll_votes (
    poll_id text not null,
    user_id uuid not null default auth.uid() references auth.users on delete cascade,
    choice text not null check (length(choice) between 1 and 40),
    voted_at timestamptz not null default now(),
    primary key (poll_id, user_id)
);

alter table public.poll_votes enable row level security;

-- One vote per person, and only their own. `choice` is not checked against the
-- poll's options: the options live in the bundle, and duplicating them here
-- would put the same list in two places that drift. An option that was never
-- offered shows up as its own row in the tally below rather than silently
-- inflating a real one.
--
-- The cap this leaves: the anon key is public and anonymous sign-in mints
-- users freely, so the primary key stops a second vote from one account, not a
-- determined person from making more accounts. Read the tally with the
-- engaged-players query when the answer decides something expensive.
create policy "vote as yourself"
    on public.poll_votes for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "read your own vote"
    on public.poll_votes for select
    to authenticated
    using (auth.uid() = user_id);

grant select, insert on public.poll_votes to authenticated;


-- Read the results ----------------------------------------------------------

-- The plain tally.
--
-- select choice, count(*) as votes
-- from poll_votes
-- where poll_id = '2026-08-29-mobile-app'
-- group by choice
-- order by votes desc;

-- The same tally, from players who have actually played. This join is the
-- reason the votes live next to game_results instead of in a hosted survey
-- tool: on a build-or-not question, the only answers worth weighting come from
-- people who play enough to use the thing.
--
-- select v.choice, count(*) as votes
-- from poll_votes v
-- join (
--     select user_id, count(*) as games
--     from game_results
--     where cards_played_total >= 5
--     group by user_id
-- ) g on g.user_id = v.user_id
-- where v.poll_id = '2026-08-29-mobile-app' and g.games >= 5
-- group by v.choice
-- order by votes desc;
