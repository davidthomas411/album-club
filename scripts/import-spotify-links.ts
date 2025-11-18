import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type CsvPick = {
  date: string
  person: string
  type: string
  url: string
}

const NAME_MAP: Record<string, string> = {
  'Rory Edwards': 'Rory',
  'Neil Tilston': 'Neil',
  'David Thomas': 'David',
  'Fergus Neville': 'Ferg',
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function parseSpotifyLinks(): CsvPick[] {
  const filePath = path.join(process.cwd(), 'spotify_links.md')
  const file = fs.readFileSync(filePath, 'utf8')

  return file
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('Date'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map(([, date, person, type, url]) => ({
      date,
      person,
      type,
      url,
    }))
    .filter(({ date, person, url }) => date && person && url)
}

async function main() {
  const rows = parseSpotifyLinks()
  console.log(`Found ${rows.length} rows to import`)

  for (const [index, row] of rows.entries()) {
    const parsedDate = new Date(row.date)
    if (Number.isNaN(parsedDate.getTime())) {
      console.warn(`Skipping row with invalid date: ${row.date}`)
      continue
    }

    const personKey = NAME_MAP[row.person] ?? row.person

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('display_name', personKey)
      .maybeSingle()

    if (!profile) {
      console.warn(`No profile for ${row.person} (lookup: ${personKey}), skipping ${row.url}`)
      continue
    }

    const pickType = row.type?.toLowerCase() === 'track' ? 'song' : 'album'
    const platform = row.url.includes('spotify.com') ? 'spotify' : 'other'

    const { error } = await supabase.from('music_picks').insert({
      user_id: profile.id,
      created_at: parsedDate.toISOString(),
      platform,
      platform_url: row.url,
      pick_type: pickType,
      title: null,
      album: null,
      artist: null,
      weekly_theme_id: null,
    })

    if (error) {
      console.error(`Failed to insert row ${index + 1}:`, error.message)
    } else if ((index + 1) % 20 === 0) {
      console.log(`Imported ${index + 1} picks...`)
    }
  }

  console.log('Import complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
