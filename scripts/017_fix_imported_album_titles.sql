-- Normalize imported WhatsApp picks: set album to the stored title when it is still the placeholder.
-- Run in Supabase SQL editor (postgres role).

update public.music_picks
set album = title
where album = 'Imported via WhatsApp'
  and title is not null
  and title <> '';

-- Optional: report how many remain with placeholder albums
select count(*) as remaining_placeholders
from public.music_picks
where album = 'Imported via WhatsApp';
