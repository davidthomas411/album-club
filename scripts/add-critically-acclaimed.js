// Temporary script to insert “critically acclaimed albums” picks.
// Run with service role creds set in env:
// SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/add-critically-acclaimed.js

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const THEME_NAME = "critically acclaimed albums"
// How many Fridays back this theme started (0 = this Friday, 1 = last Friday, 2 = week before last)
const THEME_WEEKS_AGO = 2
const PICKS = [
  { url: 'https://open.spotify.com/album/3SUEJULSGgBDG1j4GQhfYY?si=7ALfltdWT_CUMEvdk5eW-A', displayName: 'Rory' },
  { url: 'https://open.spotify.com/album/0G19nfof63Mn9Se0ermJvi?si=mQiDQt9ERE6nHYFrH8A8Ww', displayName: 'Neil' },
  { url: 'https://open.spotify.com/album/52yD51X7yDinwlg6tbCtpP?si=CyOT-6dFR-qYttC5eBZD4w', displayName: 'Dave' },
  { url: 'https://open.spotify.com/album/45YPdI0NwrZvqVWKi6Gb6D?si=DuSzQwddSnqjVDZYX-d3NQ', displayName: 'Ferf' },
]

function fridayRangeWeeksAgo(weeksAgo = 0) {
  const now = new Date()
  const day = now.getDay() // 0 Sunday ... 5 Friday
  const diffToFriday = (day >= 5 ? day - 5 : day + 2) // days since last Friday
  const start = new Date(now)
  start.setDate(now.getDate() - diffToFriday - weeksAgo * 7)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  end.setHours(0, 0, 0, 0)

  return { start: start.toISOString(), end: end.toISOString() }
}

async function getThemeId(themeName) {
  const range = fridayRangeWeeksAgo(THEME_WEEKS_AGO)
  const { data, error } = await supabase
    .from('weekly_themes')
    .select('id, week_start_date, week_end_date')
    .ilike('theme_name', themeName)
    .maybeSingle()

  if (error) throw error
  if (data) {
    // Patch missing week_start_date if needed
    if (!data.week_start_date || !data.week_end_date) {
      const { error: updError } = await supabase
        .from('weekly_themes')
        .update({
          week_start_date: data.week_start_date || range.start,
          week_end_date: data.week_end_date || range.end,
        })
        .eq('id', data.id)
      if (updError) throw updError
    }
    return data.id
  }

  const { data: inserted, error: insertError } = await supabase
    .from('weekly_themes')
    .insert({
      theme_name: themeName,
      is_active: false,
      week_start_date: range.start,
      week_end_date: range.end,
    })
    .select('id, week_start_date, week_end_date')
    .maybeSingle()

  if (insertError) throw insertError
  return inserted?.id
}

async function getUserId(displayName) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('display_name', displayName)
    .maybeSingle()

  if (error) throw error
  return data?.id || null
}

async function pickExists(url) {
  const { data, error } = await supabase
    .from('music_picks')
    .select('id')
    .eq('platform_url', url)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error // ignore no rows
  return !!data
}

async function insertPick(themeId, { url, displayName }) {
  const already = await pickExists(url)
  if (already) {
    console.log(`Skip (exists): ${url}`)
    return
  }

  const userId = await getUserId(displayName)

  const payload = {
    album: 'Critically acclaimed pick',
    artist: displayName,
    platform_url: url,
    platform: 'spotify',
    album_artwork_url: null,
    weekly_theme_id: themeId,
    user_id: userId,
  }

  const { error } = await supabase.from('music_picks').insert(payload)
  if (error) {
    console.error(`Failed to insert ${url}:`, error.message)
  } else {
    console.log(`Inserted: ${url} (${displayName})`)
  }
}

async function main() {
  try {
    const themeId = await getThemeId(THEME_NAME)
    if (!themeId) throw new Error('No theme id')

    for (const pick of PICKS) {
      await insertPick(themeId, pick)
    }

    console.log('Done.')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

main()
