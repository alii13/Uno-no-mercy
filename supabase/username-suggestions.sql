-- Available-name suggestions for a rejected rename.
-- Run in the Supabase SQL Editor. Additive: one SECURITY DEFINER function.
--
-- WHY THIS EXISTS
-- A player told only "that name is already taken" has to guess again. The logs
-- show that happening in clusters - one player made six attempts across three
-- minutes. Suggesting names they can actually have ends the guessing.
--
-- WHY IT IS CHECKED SERVER-SIDE
-- The client could append a random suffix without asking, and would be right
-- most of the time. But a suggestion that is itself taken is worse than no
-- suggestion, because the player already trusted it. `profiles` RLS is
-- owner-only, so testing availability needs a definer read - the same rule as
-- every other public read here. It returns only free names and never
-- enumerates the table, and usernames are already public on the leaderboard.

create or replace function public.username_suggestions(p_base text, p_count int default 3)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
    base      text;
    candidate text;
    out_names text[] := '{}';
    attempt   int;
begin
    if p_count is null or p_count < 1 or p_count > 5 then
        p_count := 3;
    end if;

    -- Strip a trailing number so a rejected `Rahul7` suggests variants of
    -- `Rahul`, not of `Rahul7`. Capped at 15 so the 4-digit suffix keeps the
    -- whole name inside the 20 characters the input accepts.
    base := left(regexp_replace(coalesce(p_base, ''), '[0-9]+$', ''), 15);
    if base = '' then
        base := 'Player';
    end if;

    -- Bounded: a caller must never be able to make this scan indefinitely.
    -- 40 tries against a 9000-wide suffix space finds 3 free names unless a
    -- base is extraordinarily popular, and returning fewer is fine - the
    -- caller renders what it gets.
    for attempt in 1..40 loop
        exit when coalesce(array_length(out_names, 1), 0) >= p_count;
        candidate := base || floor(random() * 9000 + 1000)::text;
        continue when candidate = any(out_names);
        if not exists (select 1 from public.profiles p where p.username = candidate) then
            out_names := out_names || candidate;
        end if;
    end loop;

    return out_names;
end;
$$;

grant execute on function public.username_suggestions to anon, authenticated;

-- Suggestions can go stale between being offered and being tapped, so the
-- unique constraint stays the real guard and the taken-name error still shows.
-- That is the correct division: this improves the odds, it does not replace
-- the check.

-- Sanity check. Expect 3 names built on 'Rahul', and 3 on 'Player' for junk
-- input. Run after creating the function.
--   select public.username_suggestions('Rahul') as normal,
--          public.username_suggestions('Rahul7') as strips_trailing_digits,
--          public.username_suggestions('') as empty_base,
--          public.username_suggestions('Rahul', 99) as count_clamped;
