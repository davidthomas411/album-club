-- Update Neil's profile to use the neil face folder from blob storage

UPDATE profiles
SET face_blob_prefix = 'neil'
WHERE display_name = 'Neil';
