-- Add album artwork URL column to music_picks table
ALTER TABLE music_picks 
ADD COLUMN IF NOT EXISTS album_artwork_url text;
