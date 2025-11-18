-- Add face_images_folder column to profiles
alter table public.profiles
add column if not exists face_images_folder text;

-- Add comment explaining the usage
comment on column public.profiles.face_images_folder is 'Folder name under /faces/ containing this member''s face_looker image set';
