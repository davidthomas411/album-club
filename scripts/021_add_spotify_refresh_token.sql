-- Add spotify_refresh_token column to profiles.
-- Run in Supabase SQL editor (postgres role).

alter table public.profiles
  add column if not exists spotify_refresh_token text;
