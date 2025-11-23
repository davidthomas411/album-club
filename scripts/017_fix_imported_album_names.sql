-- Fix placeholder album names set during WhatsApp imports.
-- This updates only rows whose album was left as the placeholder.
-- Run in the Supabase SQL editor (postgres role).

update public.music_picks
set album = coalesce(title, album)
where album ilike 'Imported via WhatsApp';

-- Optional: preview what remains with the placeholder after update (should be 0 rows)
select id, title, artist, album, platform_url
from public.music_picks
where album ilike 'Imported via WhatsApp'
order by created_at desc;
