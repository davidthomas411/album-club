-- Add support for storing Blob URLs for face images
ALTER TABLE profiles
ADD COLUMN face_blob_prefix TEXT;

COMMENT ON COLUMN profiles.face_blob_prefix IS 'Vercel Blob URL prefix for face images (e.g., https://blob.vercel-storage.com/faces/dave/)';

-- Update existing profiles with local paths for backward compatibility
UPDATE profiles
SET face_blob_prefix = '/faces/' || face_images_folder || '/'
WHERE face_images_folder IS NOT NULL;
