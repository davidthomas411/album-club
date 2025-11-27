#!/usr/bin/env node

// Update music_picks rows that still have the imported user id by matching
// against a chat export CSV (links_4.csv). Sets real user_id/pick_type and
// fills created_at if missing. Does not touch themed rows (weekly_theme_id).

require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' })
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const inputPath = process.argv[2] || 'links_4.csv'
const importedUser = process.env.IMPORTED_USER_UUID || '8cddd5c2-cfdd-40e6-a742-98c8c6873780'
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!spotifyClientId || !spotifyClientSecret) {
  console.error('Missing SPOTIFY_CLIENT_ID/SECRET (required to resolve track -> album)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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
  return userMap[key] || importedUser
}

const cleanTime = (t) => (t || '').replace(/\u202f/g, ' ')
const normalizeUrl = (url) => (url ? url.split('?')[0].replace(/\/+$/, '') : '')
const trackIdFromUrl = (url) => {
  const m = (url || '').match(/spotify\.com\/track\/([A-Za-z0-9]{16,24})/)
  return m ? m[1] : null
}
const albumUrlFromId = (id) => `https://open.spotify.com/album/${id}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const parseCsvLine = (line) => {
  const matches = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'))
  if (matches.length < 5) return null
  const [date, time, user, url, type] = matches
  const createdAt = (() => {
    const composed = `${date} ${cleanTime(time)} UTC`
    const d = new Date(composed)
    return isNaN(d.getTime()) ? null : d.toISOString()
  })()
  const kind = /track/.test(url) || type === 'song' ? 'song' : 'album'
  return { date, time, user, url, createdAt, pickType: kind }
}

function loadChatMap(csvPath) {
  const text = fs.readFileSync(path.resolve(csvPath), 'utf8').trim()
  const lines = text.split(/\r?\n/).slice(1)
  const map = new Map()
  for (const line of lines) {
    const row = parseCsvLine(line)
    if (!row) continue
    const norm = normalizeUrl(row.url)
    if (!norm) continue
    if (!map.has(norm)) {
      map.set(norm, {
        userId: resolveUserId(row.user),
        pickType: row.pickType,
        createdAt: row.createdAt,
      })
    }
  }
  return map
}

async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: spotifyClientId,
      client_secret: spotifyClientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.access_token
}

async function albumUrlFromTrack(token, trackUrl) {
  const trackId = trackIdFromUrl(trackUrl)
  if (!trackId) return null
  const fetchWithTimeout = async () => {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), parseInt(process.env.FETCH_TIMEOUT_MS || '10000', 10))
    try {
      return await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(t)
    }
  }
  const doFetch = async () =>
    fetchWithTimeout()
  try {
    let res = await doFetch()
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '1', 10) * 1000
      await sleep(Math.max(retryAfter, parseInt(process.env.TRACK_SLEEP_MS || '500', 10)))
      res = await doFetch()
    }
    if (!res.ok) {
      if (process.env.DEBUG) console.log('[spotify] track fetch failed', trackId, res.status)
      return null
    }
    const json = await res.json()
    const albumId = json.album?.id
    return albumId ? albumUrlFromId(albumId) : null
  } catch (err) {
    if (process.env.DEBUG) console.log('[spotify] track fetch error', trackId, err.message)
    return null
  }
}

async function main() {
  const limitDebug = parseInt(process.env.DEBUG_LIMIT || '0', 10)
  const chatMap = loadChatMap(inputPath)
  const urls = Array.from(chatMap.keys())
  console.log(`Loaded ${urls.length} urls from ${inputPath}`)

  const token = await getSpotifyToken()

  let updated = 0
  let missing = 0
  let themed = 0
  let scanned = 0
  let matchedViaAlbum = 0

  const pageSize = parseInt(process.env.CHUNK_SIZE || '200', 10)
  let processed = 0
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('music_picks')
      .select('id, platform_url, weekly_theme_id, user_id, created_at, pick_type, platform')
      .eq('user_id', importedUser)
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Fetch error', error)
      process.exit(1)
    }
    const rows = data || []
    if (!rows.length) break
    scanned += rows.length

    for (const row of rows) {
      if (limitDebug && processed >= limitDebug) break
      processed += 1

      const norm = normalizeUrl(row.platform_url)
      if (process.env.DEBUG) console.log('[row]', processed, row.id, norm)
      let info = chatMap.get(norm)

      // If not found and it's a track URL, resolve album URL and try again
      if (!info && /spotify\.com\/track\//.test(norm)) {
        if (process.env.DEBUG) console.log('[track->album lookup]', norm)
        const albumUrl = await Promise.race([
          albumUrlFromTrack(token, norm),
          new Promise((_, rej) => setTimeout(() => rej(new Error('row timeout')), 7000)),
        ]).catch((err) => {
          if (process.env.DEBUG) console.log('[track lookup error]', err.message)
          return null
        })
        const normAlbum = normalizeUrl(albumUrl)
        if (normAlbum && chatMap.has(normAlbum)) {
          info = chatMap.get(normAlbum)
          matchedViaAlbum += 1
          if (process.env.DEBUG) console.log('[match via album]', norm, '->', normAlbum)
        }
      }

      if (!info) {
        missing += 1
        if (process.env.DEBUG) console.log('[no match]', row.id, norm)
        continue
      }
      if (row.weekly_theme_id) {
        themed += 1
        continue
      }
      const payload = {
        user_id: info.userId,
        pick_type: row.pick_type || info.pickType,
        platform: row.platform || 'spotify',
      }
      if (!row.created_at && info.createdAt) payload.created_at = info.createdAt

      const { error: upErr } = await supabase.from('music_picks').update(payload).eq('id', row.id)
      if (upErr) {
        console.error('Update failed', row.id, upErr.message)
        process.exit(1)
      }
      updated += 1
      if (process.env.DEBUG) console.log('[update]', norm, payload)
    }
    if (limitDebug && processed >= limitDebug) break
  }

  console.log(
    `Scanned ${scanned} imported rows. Updated ${updated} (album-match:${matchedViaAlbum}). Themed skipped: ${themed}. No chat match: ${missing}.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
