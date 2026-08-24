-- One-question in-app poll, pushed without a deploy. Run in the Supabase SQL
-- Editor. Additive only: two tables, no changes to anything that exists.
--
-- HOW TO ASK A QUESTION
--   1. Open Table Editor -> polls -> Insert row.
--   2. Fill id, question, options. Set active = true.
--   3. Players see it on their next landing-page visit. No frontend deploy.
--   4. Set active = false to stop asking.
--
-- Keep exactly one row active. The client takes the newest active row, so a
-- second active poll silently hides the first instead of showing both.

create table if not exists public.polls (
    id          text primary key,
    question    text not null,
    options     jsonb not null,
    active      boolean not null default false,
    min_games   int not null default 0,
    allow_note  boolean not null default false,
    note_label  text,
    created_at  timestamptz not null default now()
);

comment on column public.polls.options is
    'Ordered choice labels: ["Yes","No","Maybe"]. Two to five render well; more overflows the sheet on mobile.';
comment on column public.polls.min_games is
    'Hide from players with fewer finished games than this. An opinion from someone who played once is noise. Checked on the client against local play history - it shapes the sample, it is not a security boundary.';
comment on column public.polls.allow_note is
    'Add a free-text box under the choices. Use it sparingly; it lowers completion.';

alter table public.polls enable row level security;

-- The question text is not sensitive and every player has to read it.
-- Only active rows are visible, so a draft poll stays private until you flip it.
drop policy if exists "active polls are public" on public.polls;
create policy "active polls are public"
    on public.polls for select
    to anon, authenticated
    using (active);

create table if not exists public.poll_votes (
    poll_id     text not null references public.polls (id) on delete cascade,
    user_id     uuid not null references auth.users (id) on delete cascade,
    choice      text not null,
    note        text,
    created_at  timestamptz not null default now(),
    primary key (poll_id, user_id)
);

alter table public.poll_votes enable row level security;

-- Owner-insert only. The primary key makes a second vote a unique violation,
-- which is how the client detects "already answered on another device".
drop policy if exists "own vote insert" on public.poll_votes;
create policy "own vote insert"
    on public.poll_votes for insert
    to anon, authenticated
    with check (auth.uid() = user_id);

-- Read your own vote back. No policy grants anyone else's: results stay
-- private while the poll is open so early answers cannot anchor later ones.
drop policy if exists "own vote select" on public.poll_votes;
create policy "own vote select"
    on public.poll_votes for select
    to anon, authenticated
    using (auth.uid() = user_id);

-- The anon key is public by design, so RLS is the only thing standing between
-- PostgREST and a hand-written request. It proves who is voting, not what they
-- voted for: without the check below, `choice` is unauthenticated free text and
-- a tally meant to inform a pricing decision can be filled with anything. The
-- primary key caps one vote per user, but anonymous sign-in mints users freely,
-- so stuffing costs nothing.
--
-- This also closes voting on an inactive poll, which the insert policy alone
-- allows: the row is still insertable after `active` goes false.
create or replace function public.poll_vote_is_valid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from public.polls p
        where p.id = new.poll_id
          and p.active
          and new.choice in (select jsonb_array_elements_text(p.options))
    ) then
        raise exception 'invalid choice % for poll %', new.choice, new.poll_id;
    end if;
    return new;
end;
$$;

drop trigger if exists poll_votes_validate on public.poll_votes;
create trigger poll_votes_validate
    before insert on public.poll_votes
    for each row execute function public.poll_vote_is_valid();

-- The textarea's maxlength is a UI affordance, not validation. A direct
-- request can store an arbitrarily large string without this.
alter table public.poll_votes drop constraint if exists poll_votes_note_len;
alter table public.poll_votes
    add constraint poll_votes_note_len check (note is null or length(note) <= 500);

-- READING THE RESULTS
-- Run this in the SQL Editor, where you are the service role. Deliberately
-- not a view: a view in `public` would be exposed through the API, and a
-- view does not enforce the underlying RLS unless it is declared
-- security_invoker - so publishing one would hand every vote to anon.
--
--   select choice, count(*) as votes,
--          round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
--   from public.poll_votes
--   where poll_id = 'PUT_POLL_ID_HERE'
--   group by choice
--   order by votes desc;
--
-- Segment by how much someone actually plays - this is the reason the poll
-- lives next to game_results instead of in a survey tool:
--
--   select v.choice, count(*) as votes, round(avg(g.games), 1) as avg_games
--   from public.poll_votes v
--   join (
--       select user_id, count(*) as games
--       from public.game_results
--       group by user_id
--   ) g on g.user_id = v.user_id
--   where v.poll_id = 'PUT_POLL_ID_HERE'
--   group by v.choice
--   order by votes desc;
--
-- Free-text answers, newest first:
--
--   select choice, note, created_at
--   from public.poll_votes
--   where poll_id = 'PUT_POLL_ID_HERE' and note is not null
--   order by created_at desc;
