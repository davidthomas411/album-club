-- Update any music_picks without a theme to use the active theme
UPDATE music_picks
SET weekly_theme_id = (
  SELECT id 
  FROM weekly_themes 
  WHERE is_active = true 
  ORDER BY created_at DESC 
  LIMIT 1
)
WHERE weekly_theme_id IS NULL;

-- Show all picks and their theme associations for verification
SELECT 
  mp.id,
  mp.album,
  mp.artist,
  mp.weekly_theme_id,
  wt.theme_name,
  p.display_name as user_name
FROM music_picks mp
LEFT JOIN weekly_themes wt ON mp.weekly_theme_id = wt.id
LEFT JOIN profiles p ON mp.user_id = p.id
ORDER BY mp.created_at DESC;
