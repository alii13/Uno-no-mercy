-- Guest profiles, created by the database instead of the browser.
-- Run in the Supabase SQL Editor. Additive: replaces one function body and
-- backfills the rows it should already have created.
--
-- THE BUG
-- create_profile_for_user() gated every insert on
--     new.email_confirmed_at is not null or new.confirmed_at is not null
-- An anonymous user satisfies neither. `confirmed_at` is a GENERATED column
-- derived from the email and phone confirmation columns, and a guest has no
-- email and no phone, so both are null for every guest - measured: 0 of 530
-- anonymous users created in the last 7 days have confirmed_at set.
--
-- So this trigger has never created a guest profile. All 527 existing guest
-- profiles were written by ensureProfile() in authStore.ts, a client
-- round-trip on the critical path. When that call is lost - tab closed too
-- early, network blip, a token that was not refreshed yet - the player keeps
-- an account with no profile, permanently, and no server-side path repairs it.
-- That is the steady leak of roughly one account a day.
--
-- WHY THE GATE STAYS FOR EMAIL SIGNUPS
-- An unconfirmed address must not squat a username. So anonymous users are
-- added to the condition rather than replacing it.

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    wanted text;
begin
    if not (
        new.is_anonymous
        or new.email_confirmed_at is not null
        or new.confirmed_at is not null
    ) then
        return new;
    end if;

    -- profiles.username is NOT NULL. A guest has no email, so the email
    -- fallback yields null for them and the literal is what actually lands.
    wanted := coalesce(
        nullif(new.raw_user_meta_data->>'username', ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Player'
    );

    -- This trigger is AFTER INSERT on auth.users, so anything it raises fails
    -- the sign-in itself. It has been harmless until now only because the old
    -- gate meant it never ran for a guest. It is about to run for every guest,
    -- so both inserts swallow their errors: a player who signs in without a
    -- profile is recoverable, and ensureProfile() in the client still repairs
    -- them, but a player who cannot sign in at all is not. Watch the verify
    -- query at the bottom rather than the absence of errors.
    begin
        insert into public.profiles (id, username)
        values (new.id, wanted)
        on conflict (id) do nothing;
    exception when others then
        -- Usually the name was taken. The id fragment is unique by
        -- construction, so this second form cannot collide on username.
        begin
            insert into public.profiles (id, username)
            values (new.id, left(wanted, 11) || '_' || left(new.id::text, 8))
            on conflict (id) do nothing;
        exception when others then
            null;
        end;
    end;

    return new;
end;
$$;

-- Both triggers already exist and both call this function; neither needs to
-- change. on_auth_user_created covers guests from now on, and
-- on_auth_user_updated still covers an email confirmation later. A guest who
-- claims an account keeps the profile they already have, because every insert
-- here is `on conflict (id) do nothing`.

-- Backfill the accounts the old gate skipped. The suffixed form is used
-- unconditionally so the backfill cannot collide with a live username.
-- The gate is repeated here on purpose: an unconfirmed email signup is left
-- without a profile, which is the intended behaviour, not an oversight.
insert into public.profiles (id, username)
select
    u.id,
    left(coalesce(
        nullif(u.raw_user_meta_data->>'username', ''),
        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
        'Player'
    ), 11) || '_' || left(u.id::text, 8)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
  and (
    u.is_anonymous
    or u.email_confirmed_at is not null
    or u.confirmed_at is not null
  )
on conflict (id) do nothing;

-- Verify. `orphans` counts only accounts that SHOULD have a profile, so the
-- expected result is 0. `unconfirmed_held_back` is the count deliberately left
-- without one; a small number there is correct.
select
    (
        select count(*)
        from auth.users u
        where not exists (select 1 from public.profiles p where p.id = u.id)
          and (u.is_anonymous or u.email_confirmed_at is not null or u.confirmed_at is not null)
    ) as orphans,
    (
        select count(*)
        from auth.users u
        where not exists (select 1 from public.profiles p where p.id = u.id)
          and not (u.is_anonymous or u.email_confirmed_at is not null or u.confirmed_at is not null)
    ) as unconfirmed_held_back;
