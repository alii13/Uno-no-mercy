-- Leaderboards for the daily challenge + weekly wins.
-- Run in the Supabase SQL Editor. Additive only: two SECURITY DEFINER
-- functions (game_results RLS is owner-select-only, so public boards need a
-- definer read) plus execute grants. No table changes.

create or replace function public.daily_leaderboard(
    challenge_date date default (now() at time zone 'utc')::date,
    max_rows int default 50
)
returns table (
    rank bigint,
    username text,
    result text,
    effort int,
    duration_secs int,
    is_me boolean
)
language sql
security definer
set search_path = public
stable
as $$
    select
        row_number() over (
            order by (gr.result = 'won') desc,
                     (gr.cards_played_total + gr.draws_taken) asc,
                     gr.game_duration_secs asc
        ) as rank,
        coalesce(p.username, 'PLAYER') as username,
        gr.result,
        (gr.cards_played_total + gr.draws_taken) as effort,
        gr.game_duration_secs as duration_secs,
        (auth.uid() is not null and gr.user_id = auth.uid()) as is_me
    from game_results gr
    left join profiles p on p.id = gr.user_id
    where gr.game_id = 'daily-' || to_char(challenge_date, 'YYYY-MM-DD')
    order by 1
    limit max_rows;
$$;

grant execute on function public.daily_leaderboard to anon, authenticated;

create or replace function public.weekly_wins_leaderboard(max_rows int default 50)
returns table (
    rank bigint,
    username text,
    wins bigint,
    games bigint,
    is_me boolean
)
language sql
security definer
set search_path = public
stable
as $$
    select
        row_number() over (
            order by count(*) filter (where gr.result = 'won') desc,
                     count(*) asc
        ) as rank,
        coalesce(p.username, 'PLAYER') as username,
        count(*) filter (where gr.result = 'won') as wins,
        count(*) as games,
        (auth.uid() is not null and gr.user_id = auth.uid()) as is_me
    from game_results gr
    left join profiles p on p.id = gr.user_id
    where gr.played_at > now() - interval '7 days'
    group by gr.user_id, p.username
    having count(*) filter (where gr.result = 'won') > 0
    order by 1
    limit max_rows;
$$;

grant execute on function public.weekly_wins_leaderboard to anon, authenticated;
