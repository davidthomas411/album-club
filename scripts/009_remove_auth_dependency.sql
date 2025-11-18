-- Drop the foreign key constraint from profiles to auth.users
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- Make id a regular UUID column without auth dependency
alter table public.profiles alter column id set default gen_random_uuid();

-- Now we can insert members without needing auth.users entries
