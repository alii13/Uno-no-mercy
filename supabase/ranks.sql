-- Public rank lookup for visible seats (waiting room, game over).
-- Run in the Supabase SQL Editor. Additive only: one SECURITY DEFINER
-- function + grant. game_results RLS is owner-select-only, so showing an
-- opponent's rank needs a definer read. Exposes nothing but win counts for
-- explicitly requested user ids.

create or replace function public.player_ranks(ids uuid[])
returns table (user_id uuid, wins bigint)
language sql
security definer
set search_path = public
stable
as $$
    select gr.user_id, count(*) filter (where gr.result = 'won') as wins
    from game_results gr
    where gr.user_id = any(ids)
    group by gr.user_id;
$$;

grant execute on function public.player_ranks to anon, authenticated;
