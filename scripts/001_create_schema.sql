-- Create profiles table for members
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  whatsapp_number text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Create weekly_themes table
create table if not exists public.weekly_themes (
  id uuid primary key default gen_random_uuid(),
  theme_name text not null,
  theme_description text,
  curator_id uuid references public.profiles(id) on delete set null,
  week_start_date date not null,
  week_end_date date not null,
  is_active boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.weekly_themes enable row level security;

create policy "weekly_themes_select_all"
  on public.weekly_themes for select
  using (true);

create policy "weekly_themes_insert_authenticated"
  on public.weekly_themes for insert
  to authenticated
  with check (true);

create policy "weekly_themes_update_curator"
  on public.weekly_themes for update
  using (auth.uid() = curator_id);

-- Create music_picks table (platform-agnostic)
create table if not exists public.music_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  weekly_theme_id uuid references public.weekly_themes(id) on delete cascade,
  title text not null,
  artist text not null,
  album text,
  platform text not null, -- 'spotify', 'apple_music', 'youtube_music', 'soundcloud', etc.
  platform_url text not null,
  embed_data jsonb, -- store platform-specific embed info
  pick_type text not null check (pick_type in ('song', 'album')),
  notes text,
  created_at timestamp with time zone default now()
);

alter table public.music_picks enable row level security;

create policy "music_picks_select_all"
  on public.music_picks for select
  using (true);

create policy "music_picks_insert_own"
  on public.music_picks for insert
  with check (auth.uid() = user_id);

create policy "music_picks_update_own"
  on public.music_picks for update
  using (auth.uid() = user_id);

create policy "music_picks_delete_own"
  on public.music_picks for delete
  using (auth.uid() = user_id);

-- Create playlists table
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  weekly_theme_id uuid references public.weekly_themes(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  is_collaborative boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.playlists enable row level security;

create policy "playlists_select_all"
  on public.playlists for select
  using (true);

create policy "playlists_insert_authenticated"
  on public.playlists for insert
  to authenticated
  with check (true);

create policy "playlists_update_creator"
  on public.playlists for update
  using (auth.uid() = created_by or is_collaborative = true);

-- Create playlist_items table (links picks to playlists)
create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references public.playlists(id) on delete cascade not null,
  music_pick_id uuid references public.music_picks(id) on delete cascade not null,
  position integer not null default 0,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default now(),
  unique(playlist_id, music_pick_id)
);

alter table public.playlist_items enable row level security;

create policy "playlist_items_select_all"
  on public.playlist_items for select
  using (true);

create policy "playlist_items_insert_authenticated"
  on public.playlist_items for insert
  to authenticated
  with check (true);

create policy "playlist_items_delete_added_by"
  on public.playlist_items for delete
  using (auth.uid() = added_by);

-- Create indexes for better query performance
create index if not exists idx_music_picks_user_id on public.music_picks(user_id);
create index if not exists idx_music_picks_weekly_theme_id on public.music_picks(weekly_theme_id);
create index if not exists idx_music_picks_created_at on public.music_picks(created_at desc);
create index if not exists idx_weekly_themes_is_active on public.weekly_themes(is_active);
create index if not exists idx_playlist_items_playlist_id on public.playlist_items(playlist_id);
