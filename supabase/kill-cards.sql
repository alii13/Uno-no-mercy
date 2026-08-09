-- Kill cards — the shareable artifact for a game's biggest stack (/k/<code>).
-- Run in the Supabase SQL Editor. Additive only: one new table plus one
-- SECURITY DEFINER reader. Nothing here touches game_results or its RLS.
--
-- Reads are public by design (a link-preview crawler is anonymous and has no
-- session), but the table itself stays RLS-closed for select — the only way
-- out is public.kill_card(), which returns exactly the five fields the unfurl
-- needs and no user_id. Same shape as public_profile().

create table if not exists public.kill_cards (
    -- Matches the profiles.share_code convention: 8 hex chars, URL-safe.
    code text primary key
        default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
    dealer text not null check (length(dealer) between 1 and 40),
    victim text not null check (length(victim) between 1 and 40),
    amount int not null check (amount between 1 and 500),
    -- Selects the pre-rendered OG image. Constrained here as well as in the
    -- Pages Function so a bad row can never widen what lands in an image URL.
    -- Kept in step by the alter below, which is what actually runs on a table
    -- that already exists.
    tier text not null,
    cards_played int not null default 0 check (cards_played >= 0),
    user_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

-- Allowed image slugs: every even stack size from the brag threshold (6) to the
-- cap (42), the above-cap fallback, and '26plus' from the original banded
-- scheme. The legacy slug stays permitted so cards minted before the switch
-- still validate and their links keep unfurling.
--
-- Stated as a drop-then-add so re-running this file updates an existing table;
-- the inline CHECK in `create table` only fires on a first install.
alter table public.kill_cards drop constraint if exists kill_cards_tier_check;
alter table public.kill_cards add constraint kill_cards_tier_check
    check (tier in (
        '6', '8', '10', '12', '14', '16', '18', '20', '22', '24',
        '26', '28', '30', '32', '34', '36', '38', '40', '42', '42plus',
        '26plus'
    ));

alter table public.kill_cards enable row level security;

-- Insert only as yourself, and no more than 20 cards an hour. A game produces
-- at most one card, so the cap is far above real play and still bounds how
-- fast a scripted client can fill the table.
drop policy if exists kill_cards_insert_own on public.kill_cards;
create policy kill_cards_insert_own on public.kill_cards
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and (
            select count(*) from public.kill_cards k
            where k.user_id = auth.uid()
              and k.created_at > now() - interval '1 hour'
        ) < 20
    );

-- Deliberately no select policy: RLS blocks direct reads for everyone. The
-- definer function below is the only read path.
--
-- Consequence for callers: the client must supply `code` and insert WITHOUT a
-- RETURNING clause. PostgREST's .select() after an insert is a RETURNING, which
-- needs a select policy and fails with 42501 even though the insert itself is
-- allowed. See newKillCode() in src/utils/killCard.ts.

create or replace function public.kill_card(p_code text)
returns table (
    dealer text,
    victim text,
    amount int,
    tier text,
    cards_played int
)
language sql
security definer
set search_path = public
stable
as $$
    select k.dealer, k.victim, k.amount, k.tier, k.cards_played
    from kill_cards k
    where k.code = p_code
    limit 1;
$$;

grant execute on function public.kill_card to anon, authenticated;

-- Cards are a share artifact, not history — nothing reads them after the link
-- goes cold. Prune with a scheduled job if the table ever gets big:
--   delete from public.kill_cards where created_at < now() - interval '180 days';
create index if not exists kill_cards_created_at_idx on public.kill_cards (created_at);
