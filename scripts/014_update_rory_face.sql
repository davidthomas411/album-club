-- Update Rory's profile with face blob prefix
-- This allows the face tracker to load Rory's face images from blob storage

UPDATE profiles
SET face_blob_prefix = 'rory'
WHERE display_name = 'Rory';
