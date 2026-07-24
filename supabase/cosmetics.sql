-- Account-synced card-back equip. Run in the Supabase SQL Editor.
-- Additive only: one nullable column on profiles. The owner-update RLS
-- policy that already covers username covers this too.

alter table public.profiles
    add column if not exists equipped_card_back text;
