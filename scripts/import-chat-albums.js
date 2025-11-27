#!/usr/bin/env node

/**
 * Import album links from a chat CSV (links_3.csv / links_4.csv) into music_picks.
 *
 * - Inserts Spotify album/track URLs, deduped by URL (query removed).
 * - Skips rows whose platform_url already exists.
 * - Uses client credentials to fetch album metadata from Spotify.
 * - Does NOT overwrite themed rows; minimal updates on existing rows.
 *
 * Usage:
 *   node scripts/import-chat-albums.js links_4.csv
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   IMPORT_DEFAULT_USERID   (user id to associate with imported picks)
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 */

require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' })
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const inputPath = process.argv[2] || 'links_4.csv'

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'IMPORT_DEFAULT_USERID',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
]
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing env ${key}`)
    process.exit(1)
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const cleanTime = (t) => (t || '').replace(/\u202f/g, ' ')
const normalizeUrl = (url) => (url ? url.split('?')[0].replace(/\/+$/, '') : '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// Map chat display names to canonical user ids in profiles
const userMap = {
  'david thomas': '11111111-1111-1111-1111-111111111111',
  dave: '11111111-1111-1111-1111-111111111111',
  'rory edwards': '44444444-4444-4444-4444-444444444444',
  rory: '44444444-4444-4444-4444-444444444444',
  'fergus neville': '22222222-2222-2222-2222-222222222222',
  ferg: '22222222-2222-2222-2222-222222222222',
  neil: '33333333-3333-3333-3333-333333333333',
  'neil tilston': '33333333-3333-3333-3333-333333333333',
}

const resolveUserId = (name) => {
  const key = (name || '').trim().toLowerCase()
  return userMap[key] || process.env.IMPORT_DEFAULT_USERID
}

const parseCsvLine = (line) => {
  const matches = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'))
  if (matches.length < 5) return null
  const [date, time, user, url, type] = matches
  return {
    date,
    time,
    user,
    url,
    type,
    createdAt: (() => {
      const composed = `${date} ${cleanTime(time)} UTC`
      const d = new Date(composed)
      return isNaN(d.getTime()) ? null : d.toISOString()
    })(),
  }
}

const extractAlbumId = (url) => {
  const albumMatch = url.match(/spotify\.com\/album\/([A-Za-z0-9]{16,24})/)
  if (albumMatch) return { kind: 'album', id: albumMatch[1] }
  const trackMatch = url.match(/spotify\.com\/track\/([A-Za-z0-9]{16,24})/)
  if (trackMatch) return { kind: 'track', id: trackMatch[1] }
  return null
}

// Optional Discogs helpers
const discogsKey = process.env.DISCOGS_KEY || process.env.DISCOGS_CLIENT_KEY
const discogsSecret = process.env.DISCOGS_SECRET || process.env.DISCOGS_CLIENT_SECRET

async function searchDiscogs(title, artist) {
  if (!discogsKey || !discogsSecret) return null
  const attempts = [
    { title, artist, type: 'release' },
    { title: title.replace(/\(.*?\)/g, '').trim(), artist, type: 'release' },
    { title, artist, type: 'master' },
  ]
  for (const attempt of attempts) {
    const params = new URLSearchParams({
      type: attempt.type,
      per_page: '3',
      page: '1',
      key: discogsKey,
      secret: discogsSecret,
    })
    if (attempt.title) params.append('title', attempt.title)
    if (attempt.artist) params.append('artist', attempt.artist)
    const url = `https://api.discogs.com/database/search?${params.toString()}`
    const res = await fetch(url, { headers: { 'User-Agent': 'AlbumClub/1.0 (+https://album-club.com)' } })
    if (!res.ok) {
      if (res.status === 429) await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    const json = await res.json()
    const match = json.results?.find((r) => (r.genre?.length || r.style?.length))
    if (match) return { genres: match.genre || [], styles: match.style || [], resource_url: match.resource_url, release_id: match.id }
  }
  return null
}

async function fetchDiscogsDetails(resourceUrl) {
  if (!resourceUrl) return null
  const res = await fetch(resourceUrl, { headers: { 'User-Agent': 'AlbumClub/1.0 (+https://album-club.com)' } })
  if (!res.ok) return null
  const json = await res.json()
  return {
    release_id: json.id || null,
    master_id: json.master_id || null,
    country: json.country || null,
    year: json.year || null,
    labels: (json.labels || []).map((l) => l.name),
    genres: json.genres || [],
    styles: json.styles || [],
    notes: json.notes || null,
    producers:
      json.extraartists
        ?.filter((a) => (a.role || '').toLowerCase().includes('producer'))
        .map((a) => a.name) || [],
  }
}

async function getSpotifyToken() {
  const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.access_token
}

async function fetchTrack(token, id) {
  const retryBase = parseInt(process.env.ALBUM_SLEEP_MS || '800', 10)
  const doFetch = async () =>
    fetch(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  let res = await doFetch()
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '1', 10) * 1000
    const sleepMs = Math.max(retryAfter, retryBase)
    await sleep(sleepMs)
    res = await doFetch()
  }
  if (!res.ok) {
    throw new Error(`track ${id} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

async function fetchAlbumsBatch(token, ids) {
  const chunks = []
  const retryBase = parseInt(process.env.ALBUM_SLEEP_MS || '800', 10)
  for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20))

  const results = new Map()
  for (const chunk of chunks) {
    if (process.env.DEBUG) console.log('[spotify] fetch albums chunk size', chunk.length, 'at', now())
    const doFetch = async () =>
      fetchWithTimeout(`https://api.spotify.com/v1/albums?ids=${chunk.join(',')}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    let res
    try {
      res = await doFetch()
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '1', 10) * 1000
        const sleepMs = Math.max(retryAfter, retryBase)
        if (process.env.DEBUG) console.log('[spotify] 429, sleeping', sleepMs, 'ms')
        await sleep(sleepMs)
        res = await doFetch()
      }
      if (!res.ok) {
        const txt = await res.text()
        console.error('[spotify] album batch failed', res.status, txt)
        continue
      }
      const json = await res.json()
      for (const alb of json.albums || []) {
        if (alb?.id) results.set(alb.id, alb)
      }
      await sleep(retryBase)
    } catch (err) {
      console.error('[spotify] album batch error', err.message)
    }
  }
  return results
}

async function main() {
  console.log(`[start] ${now()} input=${inputPath}`)
  const csv = fs.readFileSync(path.resolve(inputPath), 'utf8').trim().split(/\r?\n/).slice(1)
  const maxImport = parseInt(process.env.MAX_IMPORT || '0', 10)
  const albums = []
  for (const line of csv) {
    const row = parseCsvLine(line)
    if (!row) continue
    const parsed = extractAlbumId(row.url)
    if (!parsed) continue
    const pickType = row.type === 'song' || parsed.kind === 'track' ? 'song' : 'album'
    albums.push({ ...row, albumId: parsed.id, kind: parsed.kind, normUrl: normalizeUrl(row.url), pickType })
    if (maxImport && albums.length >= maxImport) break
  }

  // Deduplicate by URL
  const seen = new Set()
  let unique = albums.filter((a) => {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })

  if (maxImport > 0 && unique.length > maxImport) {
    unique = unique.slice(0, maxImport)
    console.log(`Found ${albums.length} unique URLs, trimming to first ${maxImport} due to MAX_IMPORT`)
  } else {
    console.log(`Found ${unique.length} unique album URLs in ${inputPath}`)
  }

  // Check existing platform_url in batches
  const existing = new Map()
  const chunkSize = parseInt(process.env.CHUNK_SIZE || '30', 10)
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize).map((a) => a.url)
    try {
      const { data, error } = await supabase
        .from('music_picks')
        .select('id, platform_url, weekly_theme_id, user_id, created_at, album_genres, artist_genres, album_producers, pick_type, platform')
        .in('platform_url', chunk)
      if (error) {
        console.error('[import-chat-albums] Supabase error object:', error)
        throw error
      }
      data?.forEach((row) => existing.set(normalizeUrl(row.platform_url), row))
    } catch (err) {
      console.error('[import-chat-albums] Supabase fetch failed', {
        chunkIndex: i / chunkSize,
        chunkSize: chunk.length,
        supabaseUrl: process.env.SUPABASE_URL,
        error: err?.message || err,
        note: 'If this is a Headers Overflow error, try setting CHUNK_SIZE=20',
      })
      process.exit(1)
    }
  }

  const toInsert = unique.filter((a) => !existing.has(a.normUrl))
  console.log(`Skipping ${existing.size} already present. Preparing to insert ${toInsert.length}.`)

  console.log(`[token] requesting at ${now()}`)
  const token = await getSpotifyToken()
  console.log(`[token] ok at ${now()}`)
  const inserts = []
  const updates = []
  let skippedThemed = 0

  // Preload album metadata in batches
  const albumIds = Array.from(new Set(unique.filter((a) => a.kind === 'album').map((a) => a.albumId)))
  console.log(`[prefetch] albums requested ${albumIds.length} at ${now()}`)
  const albumMap = await fetchAlbumsBatch(token, albumIds)
  if (process.env.DEBUG) console.log('[prefetch] albums requested', albumIds.length, 'fetched', albumMap.size)
  if (!albumMap.size) {
    console.error('[prefetch] no albums fetched; aborting')
    process.exit(1)
  }

  for (const a of unique) {
    const existingRow = existing.get(a.normUrl)
    if (existingRow) {
      if (existingRow.weekly_theme_id) {
        skippedThemed += 1
        continue
      }
      const payload = {}
      const mappedUser = resolveUserId(a.user)
      if (!existingRow.user_id || existingRow.user_id === process.env.IMPORT_DEFAULT_USERID) {
        payload.user_id = mappedUser
      }
      if (!existingRow.created_at && a.createdAt) payload.created_at = a.createdAt
      if (!existingRow.pick_type) payload.pick_type = a.pickType
      if (!existingRow.platform) payload.platform = 'spotify'
      if (Object.keys(payload).length) {
        updates.push({ id: existingRow.id, payload, url: a.url })
      }
      continue
    }

    try {
      let albumData = null
      let entity = null
      const originalUrl = a.url
      if (a.kind === 'track') {
        entity = await fetchTrack(token, a.albumId)
        albumData = entity.album || {}
        // replace platform_url with album URL so we store albums consistently
        const albumId = albumData.id
        if (albumId) a.url = `https://open.spotify.com/album/${albumId}`
        if (process.env.DEBUG) console.log('[track->album]', a.albumId, '=>', albumId)
      } else {
        albumData = albumMap.get(a.albumId)
        if (!albumData) {
          if (process.env.DEBUG) console.log('[missing album metadata]', a.albumId, a.url)
          continue
        }
      }

      const primaryArtist = albumData.artists?.[0]?.name || 'Unknown artist'
      const albumName = albumData.name || 'Untitled'
      const art = albumData.images?.[0]?.url || null
      const year = albumData.release_date ? parseInt(albumData.release_date.slice(0, 4), 10) : null

      let discogs = null
      if (discogsKey && discogsSecret) {
        try {
          discogs = await searchDiscogs(albumName, primaryArtist)
          if (discogs?.resource_url) {
            const detail = await fetchDiscogsDetails(discogs.resource_url)
            if (detail) discogs.detail = detail
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 800))
      }

      const row = {
        artist: primaryArtist,
        album: albumName,
        title: a.pickType === 'song' ? entity.name || albumName : albumName,
        album_artwork_url: art,
        album_release_year: isNaN(year) ? null : year,
        platform_url: a.url,
        platform: 'spotify',
        pick_type: a.pickType,
        user_id: resolveUserId(a.user),
        created_at: a.createdAt || null,
      }
      if (discogs) {
        const genres = discogs.genres || []
        const styles = discogs.styles || []
        if (genres.length) row.album_genres = genres
        if (styles.length) row.artist_genres = styles
        if (discogs.detail) {
          const d = discogs.detail
          row.discogs_release_id = d.release_id
          row.discogs_master_id = d.master_id
          row.discogs_country = d.country
          row.discogs_year = d.year
          row.discogs_labels = d.labels?.length ? d.labels : null
          row.discogs_styles = d.styles?.length ? d.styles : null
          row.discogs_genres = d.genres?.length ? d.genres : null
          row.discogs_notes = d.notes || null
          if (d.producers?.length) row.album_producers = d.producers
        }
      }

      inserts.push(row)
      if (process.env.DEBUG) console.log('[insert]', row.artist, '-', row.album)
    } catch (err) {
      console.error(`Failed album ${a.url}:`, err.message)
    }
  }

  if (inserts.length) {
    console.log(`Inserting ${inserts.length} new albums...`)
    for (let i = 0; i < inserts.length; i += 50) {
      const batch = inserts.slice(i, i + 50)
      if (process.env.DEBUG) {
        console.log(`[import-chat-albums] inserting batch ${i / 50 + 1} (${batch.length} rows)`)
      }
      const { error } = await supabase.from('music_picks').insert(batch)
      if (error) {
        console.error('Insert error:', error.message)
        process.exit(1)
      }
    }
  }

  if (updates.length) {
    console.log(`Updating ${updates.length} existing albums...`)
    for (const u of updates) {
      const { error } = await supabase.from('music_picks').update(u.payload).eq('id', u.id)
      if (error) {
        console.error('Update error:', error.message)
        process.exit(1)
      }
      if (process.env.DEBUG) console.log('[update]', u.url, u.payload)
    }
  }

  if (skippedThemed) {
    console.log(`Skipped ${skippedThemed} themed rows (left untouched).`)
  }
  console.log('Done. Inserted', inserts.length, 'albums. Updated', updates.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
