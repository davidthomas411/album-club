-- Backfill music_picks.weekly_theme_id based on created_at falling within a theme's week window.
-- Assumes weekly_themes have non-overlapping week_start_date/week_end_date ranges.
-- Run in Supabase SQL editor (postgres role).

with mapped as (
  select mp.id as pick_id, wt.id as theme_id
  from public.music_picks mp
  join public.weekly_themes wt
    on date(mp.created_at) between wt.week_start_date and wt.week_end_date
  where coalesce(mp.weekly_theme_id, '00000000-0000-0000-0000-000000000000') <> wt.id
)
update public.music_picks mp
set weekly_theme_id = m.theme_id
from mapped m
where mp.id = m.pick_id;

-- Verify counts per theme after update
select wt.theme_name, wt.week_start_date, count(mp.id) as picks
from public.weekly_themes wt
left join public.music_picks mp on mp.weekly_theme_id = wt.id
group by wt.id, wt.theme_name, wt.week_start_date
order by wt.week_start_date desc;
