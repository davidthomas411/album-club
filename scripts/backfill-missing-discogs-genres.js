#!/usr/bin/env node
/**
 * Backfill missing genres using Discogs search (artist + album).
 * Requires env: DISCOGS_KEY/DISCOGS_SECRET (or DISCOGS_CLIENT_KEY/SECRET), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Load env from .env.local if present
try {
  const envText = fs.readFileSync('.env.local', 'utf8')
  for (const line of envText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [k, ...rest] = trimmed.split('=')
    const v = rest.join('=').replace(/^"(.*)"$/, '$1')
    if (k && v && !process.env[k]) process.env[k] = v
  }
} catch {}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const discogsKey = process.env.DISCOGS_KEY || process.env.DISCOGS_CLIENT_KEY
const discogsSecret = process.env.DISCOGS_SECRET || process.env.DISCOGS_CLIENT_SECRET

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!discogsKey || !discogsSecret) {
  console.error('Missing DISCOGS_KEY/SECRET')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const cleanTitle = (t) =>
  t
    .replace(/\(.*?\)/g, ' ')
    .replace(/-.*/, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const primaryArtist = (name) => {
  if (!name) return ''
  const split = name.split(/[;&,]|feat\.?|with|and/gi).map((s) => s.trim()).filter(Boolean)
  return split[0] || name.trim()
}

async function searchDiscogs(title, artist) {
  const mainArtist = primaryArtist(artist)
  const attempts = [
    { title, artist: mainArtist, type: 'release' },
    { title: cleanTitle(title || ''), artist: mainArtist, type: 'release' },
    { title, artist: mainArtist, type: 'master' },
    { title: cleanTitle(title || ''), artist: mainArtist, type: 'master' },
    { title: '', artist: mainArtist, type: 'release' },
    { title: '', artist: mainArtist, type: 'master', useQ: true }, // q search with artist only
  ]

  for (const attempt of attempts) {
    const params = new URLSearchParams({
      type: attempt.type || 'release',
      per_page: '5',
      page: '1',
      key: discogsKey,
      secret: discogsSecret,
    })
    if (attempt.useQ) {
      const q = [attempt.artist, attempt.title].filter(Boolean).join(' ')
      if (q) params.append('q', q)
    } else {
      if (attempt.title) params.append('title', attempt.title)
      if (attempt.artist) params.append('artist', attempt.artist)
    }

    const url = `https://api.discogs.com/database/search?${params.toString()}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AlbumClub/1.0 (+https://album-club.com)' },
    })
    if (!res.ok) {
      if (process.env.DEBUG) console.log('[discogs] non-ok', res.status, url)
      if (res.status === 429) await sleep(2000)
      continue
    }
    const json = await res.json()
    const results = json.results || []
    if (process.env.DEBUG) {
      console.log('[discogs] attempt', { url, count: results.length, first: results[0]?.title })
    }
    for (const match of results) {
      const genres = match.genre || []
      const styles = match.style || []
      if (!genres.length && !styles.length) continue
      return { genres, styles, match }
    }
  }

  return null
}

async function fetchReleaseDetails(resourceUrl) {
  if (!resourceUrl) return null
  const res = await fetch(resourceUrl, {
    headers: { 'User-Agent': 'AlbumClub/1.0 (+https://album-club.com)' },
  })
  if (!res.ok) return null
  const json = await res.json()
  const producers =
    json.extraartists
      ?.filter((a) => (a.role || '').toLowerCase().includes('producer'))
      .map((a) => a.name) || []
  return {
    release_id: json.id || null,
    master_id: json.master_id || null,
    country: json.country || null,
    year: json.year || null,
    labels: (json.labels || []).map((l) => l.name),
    genres: json.genres || [],
    styles: json.styles || [],
    notes: json.notes || null,
    producers,
  }
}

async function main() {
  const testId = process.env.TEST_ID
  const limit = parseInt(process.env.LIMIT_ROWS || '200', 10)
  const includeAll = process.env.INCLUDE_ALL === 'true'
  let data, error
  if (testId) {
    ;({ data, error } = await supabase
      .from('music_picks')
      .select('id, album, title, artist, album_genres, artist_genres')
      .eq('id', testId))
  } else if (includeAll) {
    const offset = parseInt(process.env.OFFSET || '0', 10)
    ;({ data, error } = await supabase
      .from('music_picks')
      .select('id, album, title, artist, album_genres, artist_genres')
      .range(offset, offset + limit - 1))
  } else {
    ;({ data, error } = await supabase
      .from('music_picks')
      .select('id, album, title, artist, album_genres, artist_genres')
      .or('album_genres.is.null,album_genres.eq.{}')
      .or('artist_genres.is.null,artist_genres.eq.{}')
      .limit(limit))
  }

  if (error) {
    console.error('Query failed', error)
    process.exit(1)
  }

  const rows = data || []
  console.log(`Found ${rows.length} picks missing genres for Discogs lookup`)
  let updated = 0
  const failures = []

  for (const row of rows) {
    const title = row.album || row.title || ''
    const artist = row.artist || ''
    if (!title || !artist) continue

    try {
      const result = await searchDiscogs(title, artist)
      if (!result || (!result.genres?.length && !result.styles?.length)) {
        failures.push({ id: row.id, reason: 'no genres from discogs' })
        continue
      }
      const genres = result.genres || []
      const styles = result.styles || []
      const genreField = genres.length ? genres : styles

      let details = null
      if (result.match?.resource_url) {
        details = await fetchReleaseDetails(result.match.resource_url)
      }

      const updatePayload = {
        album_genres: genreField.length ? genreField : null,
        artist_genres: styles.length ? styles : null,
      }
      if (details) {
        updatePayload.discogs_release_id = details.release_id || null
        updatePayload.discogs_master_id = details.master_id || null
        updatePayload.discogs_country = details.country || null
        updatePayload.discogs_year = details.year || null
        updatePayload.discogs_labels = details.labels?.length ? details.labels : null
        if (!updatePayload.album_genres && details.genres?.length) {
          updatePayload.album_genres = details.genres
        }
        if (!updatePayload.artist_genres && details.styles?.length) {
          updatePayload.artist_genres = details.styles
        }
        updatePayload.discogs_styles = details.styles?.length ? details.styles : null
        updatePayload.discogs_genres = details.genres?.length ? details.genres : null
        updatePayload.discogs_notes = details.notes || null
        if (details.producers?.length) {
          updatePayload.album_producers = details.producers
        }
      }

      const { error: updateError } = await supabase
        .from('music_picks')
        .update(updatePayload)
        .eq('id', row.id)

      if (updateError) {
        failures.push({ id: row.id, reason: `update failed: ${updateError.message}` })
      } else {
        updated += 1
        if (updated % 25 === 0) console.log(`Updated ${updated} picks...`)
      }
    } catch (err) {
      failures.push({ id: row.id, reason: err?.message || String(err) })
    }

    await sleep(parseInt(process.env.SLEEP_MS || '1500', 10)) // respect Discogs rate limiting
  }

  console.log(`Done. Updated ${updated} picks. Failures: ${failures.length}`)
  if (failures.length) {
    console.log('Sample failures (up to 15):')
    failures.slice(0, 15).forEach((f) => console.log(`- ${f.id}: ${f.reason}`))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
