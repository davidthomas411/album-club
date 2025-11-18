-- Seed data for first week's theme and Neil's pick

-- Insert members
INSERT INTO profiles (id, display_name, face_images_folder)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Dave', 'dave'),
  ('00000000-0000-0000-0000-000000000002', 'Neil', 'neil')
ON CONFLICT (id) DO NOTHING;

-- Dave is the curator, not Neil
-- Insert first week's theme: "Free Choice" with Dave as curator
INSERT INTO weekly_themes (theme_name, theme_description, curator_id, is_active, start_date, end_date)
VALUES (
  'Free Choice',
  'Pick anything you want - no restrictions!',
  '00000000-0000-0000-0000-000000000001', -- Dave's ID
  true,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days'
);

-- Insert Neil's pick: David Holmes - Let's Get Killed
INSERT INTO music_picks (
  user_id,
  title,
  artist,
  pick_type,
  platform,
  platform_url,
  notes,
  weekly_theme_id
)
VALUES (
  '00000000-0000-0000-0000-000000000002', -- Neil's ID
  'Let''s Get Killed',
  'David Holmes',
  'album',
  'other',
  'https://music.example.com/david-holmes-lets-get-killed',
  'Neil''s pick for Free Choice week',
  (SELECT id FROM weekly_themes WHERE theme_name = 'Free Choice' LIMIT 1)
);
