-- Sample: Insert the 4 rotating members
-- Replace these with actual member names and face folder names

insert into public.profiles (id, display_name, face_images_folder, bio)
values
  (gen_random_uuid(), 'Alex', 'alex', 'Jazz and indie rock enthusiast'),
  (gen_random_uuid(), 'Sam', 'sam', 'Electronic and experimental lover'),
  (gen_random_uuid(), 'Jordan', 'jordan', 'Hip-hop and R&B curator'),
  (gen_random_uuid(), 'Taylor', 'taylor', 'Classic rock and folk aficionado')
on conflict (id) do nothing;

-- Example: Create a sample weekly theme with Alex as curator
-- Get Alex's ID first, then create theme
do $$
declare
  alex_id uuid;
begin
  select id into alex_id from public.profiles where display_name = 'Alex' limit 1;
  
  if alex_id is not null then
    insert into public.weekly_themes (theme_name, theme_description, curator_id, week_start_date, week_end_date, is_active)
    values (
      'Songs That Make You Move',
      'Share tracks that get you dancing or feeling energized',
      alex_id,
      current_date,
      current_date + interval '7 days',
      true
    );
  end if;
end $$;
