-- Guest profiles, created by the database instead of the browser.
-- Run in the Supabase SQL Editor. Additive: replaces one function body and
-- backfills the rows it should already have created.
--
-- ALREADY RAN AN EARLIER VERSION OF THIS FILE? Re-run it. The whole file is
-- idempotent: `create or replace` is, and the backfill is guarded by
-- `where not exists`, so it inserts nothing the second time. Review moved the
-- collision path from a single id-fragment fallback to a readable 4-digit
-- suffix first, which only takes effect once the function is replaced again.
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
    wanted    text;
    candidate text;
    attempt   int;
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

    -- Three name forms, readable first. This trigger runs in the same
    -- transaction as the auth.users insert, so it now wins the race against
    -- ensureProfile() in authStore.ts and owns the collision path. That client
    -- retries with a fresh 4-digit suffix, so attempt 2 has to match it -
    -- jumping straight to the id fragment would turn a player who typed a
    -- taken `Rahul` into `Rahul_a1b2c3d4` rather than `Rahul1234`, and 15 to 31
    -- profiles a day are player-typed names, which are exactly the ones that
    -- collide.
    --
    -- Attempt 3 is unique by construction, so the loop effectively cannot fall
    -- through. That stays a logged warning rather than an assumption.
    --
    -- Nothing here may raise: this is AFTER INSERT on auth.users, so an
    -- exception would fail the sign-in itself. A player without a profile is
    -- recoverable and the client still repairs them; a player who cannot sign
    -- in is not. But every swallowed error is logged - the original leak went
    -- unnoticed for days precisely because there was no error to see.
    for attempt in 1..3 loop
        candidate := case attempt
            when 1 then wanted
            when 2 then left(wanted, 15) || floor(random() * 9000 + 1000)::text
            else        left(wanted, 11) || '_' || left(new.id::text, 8)
        end;

        begin
            insert into public.profiles (id, username)
            values (new.id, candidate)
            on conflict (id) do nothing;
            return new;
        exception
            when unique_violation then
                null; -- name taken, try the next form
            when others then
                raise warning 'profile insert failed for user % (%): %',
                    new.id, sqlstate, sqlerrm;
                return new;
        end;
    end loop;

    raise warning 'profile insert exhausted all name forms for user %', new.id;
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
