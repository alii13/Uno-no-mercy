-- profile-hardening.sql
-- Run manually in the Supabase SQL Editor. Two parts, both idempotent:
--   1) create_profile_for_user() survives a username collision instead of
--      leaving the user with no profile row.
--   2) Backfill profiles for existing auth users that have none.
-- Context: profiles.username is UNIQUE and the guest handle namespace filled
-- to the point that ~1 in 3 random handles collided; a collision made the
-- insert fail silently (no stats, no share code, no rank for that user).

-- 1) Trigger function: on a username collision, retry once with a suffix
--    derived from the user id - unique by construction, and the total stays
--    within the 20-char cap the client applies to names.
--    set search_path also clears the database-linter warning on this function.
create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null or new.confirmed_at is not null then
    begin
      insert into public.profiles (id, username)
      values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
      )
      on conflict (id) do nothing;
    exception when unique_violation then
      insert into public.profiles (id, username)
      values (
        new.id,
        left(coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1), 'Player'), 11)
          || '_' || left(new.id::text, 8)
      )
      on conflict (id) do nothing;
    end;
  end if;
  return new;
end;
$$;

-- 2) Backfill: one row per auth user with no profile. The id-derived suffix
--    makes names unique against both existing rows and this batch (8 hex
--    chars; if this ever raises unique_violation, widen the suffix and rerun).
insert into public.profiles (id, username)
select
  u.id,
  left(coalesce(nullif(u.raw_user_meta_data->>'username', ''), 'Player'), 11)
    || '_' || left(u.id::text, 8)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Verify: expect 0.
select count(*) as users_still_missing_profile
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
