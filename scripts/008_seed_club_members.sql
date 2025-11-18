-- Insert the 4 rotating AlbumClub members: Ferg, Neil, Rory, and Dave
-- Removed ON CONFLICT clause since there's no unique constraint on display_name

insert into public.profiles (id, display_name, face_blob_prefix, bio)
values
  ('11111111-1111-1111-1111-111111111111', 'Dave', 'dave', 'Music enthusiast and curator'),
  ('22222222-2222-2222-2222-222222222222', 'Ferg', 'ferg', 'Once picked Sunscreen by Suntan'),
  ('33333333-3333-3333-3333-333333333333', 'Neil', 'neil', 'Made us quit Spotify because morals'),
  ('44444444-4444-4444-4444-444444444444', 'Rory', 'rory', 'Fan of foreign')
on conflict (id) do nothing;
