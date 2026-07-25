-- Daily activity grid for public profiles (GitHub-contribution-style heatmap).
-- Run in the Supabase SQL Editor AFTER leaderboards-v2.sql (needs
-- profiles.share_code). Additive only: one SECURITY DEFINER function + grant.
--
-- Exposes per-DAY aggregates only (games + wins), never row-level history —
-- same privacy posture as public_profile.
--
-- p_tz is an IANA timezone name from the browser (Intl resolvedOptions), so
-- "a day" matches the viewer's calendar. An invalid name makes the function
-- error; the frontend treats any error as feature-not-available and hides
-- the heatmap.

create or replace function public.profile_activity(p_share_code text, p_tz text default 'UTC')
returns table (day date, games bigint, wins bigint)
language sql
security definer
set search_path = public
stable
as $$
    select (gr.played_at at time zone p_tz)::date as day,
           count(*) as games,
           count(*) filter (where gr.result = 'won') as wins
    from game_results gr
    join profiles p on p.id = gr.user_id
    where p.share_code = p_share_code
      and gr.played_at > now() - interval '190 days'
    group by 1
    order by 1;
$$;

grant execute on function public.profile_activity to anon, authenticated;
