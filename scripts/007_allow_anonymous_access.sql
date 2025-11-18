-- Update RLS policies to allow anonymous access for development
-- This disables authentication requirements while keeping RLS enabled

-- Weekly themes: allow anyone to insert and update
drop policy if exists "weekly_themes_insert_authenticated" on public.weekly_themes;
drop policy if exists "weekly_themes_update_curator" on public.weekly_themes;

create policy "weekly_themes_insert_all"
  on public.weekly_themes for insert
  with check (true);

create policy "weekly_themes_update_all"
  on public.weekly_themes for update
  using (true);

-- Music picks: allow anyone to insert, update, delete
drop policy if exists "music_picks_insert_own" on public.music_picks;
drop policy if exists "music_picks_update_own" on public.music_picks;
drop policy if exists "music_picks_delete_own" on public.music_picks;

create policy "music_picks_insert_all"
  on public.music_picks for insert
  with check (true);

create policy "music_picks_update_all"
  on public.music_picks for update
  using (true);

create policy "music_picks_delete_all"
  on public.music_picks for delete
  using (true);

-- Playlists: allow anyone to insert and update
drop policy if exists "playlists_insert_authenticated" on public.playlists;
drop policy if exists "playlists_update_creator" on public.playlists;

create policy "playlists_insert_all"
  on public.playlists for insert
  with check (true);

create policy "playlists_update_all"
  on public.playlists for update
  using (true);

-- Playlist items: allow anyone to insert and delete
drop policy if exists "playlist_items_insert_authenticated" on public.playlist_items;
drop policy if exists "playlist_items_delete_added_by" on public.playlist_items;

create policy "playlist_items_insert_all"
  on public.playlist_items for insert
  with check (true);

create policy "playlist_items_delete_all"
  on public.playlist_items for delete
  using (true);

-- Profiles: allow anyone to insert and update
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_insert_all"
  on public.profiles for insert
  with check (true);

create policy "profiles_update_all"
  on public.profiles for update
  using (true);
