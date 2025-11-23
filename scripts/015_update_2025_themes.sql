-- Update 2025 weekly themes. Run in the Supabase SQL editor (postgres role).
-- This replaces any 2025 themes with the list below, setting week_end_date to start + 6 days.

begin;

-- Clear existing 2025 themes to avoid duplicates.
delete from public.weekly_themes
where week_start_date between date '2025-01-01' and date '2025-12-31';

with members as (
  select id, display_name from public.profiles
),
upsert as (
  insert into public.weekly_themes (theme_name, theme_description, curator_id, week_start_date, week_end_date, is_active)
  values
    ('Free choice',                                                          null, (select id from members where display_name ilike '%Rory%' limit 1), date '2025-01-05', date '2025-01-05' + interval '6 days', false),
    ('2025 albums',                                                          null, (select id from members where display_name ilike '%Dave%' limit 1), date '2025-01-11', date '2025-01-11' + interval '6 days', false),
    ('Fashion (alt. to “records released this morning”)',                    null, (select id from members where display_name ilike '%Ferg%' limit 1), date '2025-01-18', date '2025-01-18' + interval '6 days', false),
    ('Scottish artists (Burns Night)',                                       null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-01-25', date '2025-01-25' + interval '6 days', false),
    ('Trad or trad-influenced albums',                                       null, (select id from members where display_name ilike '%Rory%' limit 1), date '2025-02-02', date '2025-02-02' + interval '6 days', false),
    ('Athletics / sport albums',                                             null, (select id from members where display_name ilike '%Ferg%' limit 1), date '2025-02-14', date '2025-02-14' + interval '6 days', false),
    ('New Orleans / Mardi Gras music',                                       null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-02-23', date '2025-02-23' + interval '6 days', false),
    ('Nostalgia albums',                                                     null, (select id from members where display_name ilike '%Rory%' limit 1), date '2025-03-01', date '2025-03-01' + interval '6 days', false),
    ('Cross-genre / mashup albums',                                          null, (select id from members where display_name ilike '%Dave%' limit 1), date '2025-03-09', date '2025-03-09' + interval '6 days', false),
    ('“Chain-link” connections between albums (each pick links to the last)', null, (select id from members where display_name ilike '%Ferg%' limit 1), date '2025-03-16', date '2025-03-16' + interval '6 days', false),
    ('Jungle / drum & bass albums',                                          null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-03-21', date '2025-03-21' + interval '6 days', false),
    ('“Ideas” / concept albums',                                             null, (select id from members where display_name ilike '%Rory%' limit 1), date '2025-03-28', date '2025-03-28' + interval '6 days', false),
    ('Albums that merge genres',                                             null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-04-20', date '2025-04-20' + interval '6 days', false),
    ('2025 albums (round 2 / unpicked 2025 records)',                        null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-05-18', date '2025-05-18' + interval '6 days', false),
    ('Beats (interpreted however you like)',                                 null, (select id from members where display_name ilike '%Dave%' limit 1), date '2025-05-31', date '2025-05-31' + interval '6 days', false),
    ('Coast / sea-related albums',                                           null, (select id from members where display_name ilike '%Ferg%' limit 1), date '2025-06-07', date '2025-06-07' + interval '6 days', false),
    ('EPs (everyone picks an EP)',                                           null, (select id from members where display_name ilike '%Dave%' limit 1), date '2025-08-05', date '2025-08-05' + interval '6 days', false),
    ('ROCK',                                                                 null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-08-11', date '2025-08-11' + interval '6 days', false),
    ('Talking Heads / David Byrne / other long-avoided classic act',         null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-09-05', date '2025-09-05' + interval '6 days', false),
    ('One-word band names',                                                  null, (select id from members where display_name ilike '%Ferg%' limit 1), date '2025-09-27', date '2025-09-27' + interval '6 days', false),
    ('“October” – baseball, leaves, Halloween, etc.',                        null, (select id from members where display_name ilike '%Dave%' limit 1), date '2025-10-19', date '2025-10-19' + interval '6 days', false),
    ('Free choice – pick something good',                                    null, (select id from members where display_name ilike '%Neil%' limit 1), date '2025-11-01', date '2025-11-01' + interval '6 days', false),
    ('Critically acclaimed albums',                                          null, (select id from members where display_name ilike '%Rory%' limit 1), date '2025-11-07', date '2025-11-07' + interval '6 days', false),
    ('Free choice (because the theme was late)',                             null, (select id from members where display_name ilike '%Dave%' limit 1), date '2025-11-17', date '2025-11-17' + interval '6 days', false)
  returning id, theme_name, week_start_date, week_end_date, curator_id
)
select * from upsert;

commit;
