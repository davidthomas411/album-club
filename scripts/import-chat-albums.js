#!/usr/bin/env node

/**
 * Import album links from a chat CSV (links_3.csv / links_4.csv) into music_picks.
 *
 * - Only inserts Spotify album URLs (ignores tracks/playlists).
 * - Skips rows whose platform_url already exists.
 * - Uses client credentials to fetch album metadata from Spotify.
 * - Does NOT overwrite existing rows.
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

const parseCsvLine = (line) => {
  const matches = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'))
  if (matches.length < 5) return null
  const [date, time, user, url, type] = matches
  return { date, time, user, url, type }
}

const extractAlbumId = (url) => {
  const m = url.match(/spotify\.com\/album\/([A-Za-z0-9]{16,24})/)
  return m ? m[1] : null
}

async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
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

async function fetchAlbum(token, albumId) {
  const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Album ${albumId} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

async function main() {
  const csv = fs.readFileSync(path.resolve(inputPath), 'utf8').trim().split(/\r?\n/).slice(1)
  const albums = []
  for (const line of csv) {
    const row = parseCsvLine(line)
    if (!row || row.type !== 'album') continue
    const albumId = extractAlbumId(row.url)
    if (!albumId) continue
    albums.push({ ...row, albumId })
  }

  // Deduplicate by URL
  const seen = new Set()
  const unique = albums.filter((a) => {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })

  console.log(`Found ${unique.length} unique album URLs in ${inputPath}`)

  // Check existing platform_url in batches
  const existing = new Set()
  const chunkSize = 200
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize).map((a) => a.url)
    const { data, error } = await supabase
      .from('music_picks')
      .select('platform_url')
      .in('platform_url', chunk)
    if (error) throw error
    data?.forEach((row) => existing.add(row.platform_url))
  }

  const toInsert = unique.filter((a) => !existing.has(a.url))
  console.log(`Skipping ${existing.size} already present. Preparing to insert ${toInsert.length}.`)
  if (!toInsert.length) return

  const token = await getSpotifyToken()
  const rows = []
  for (const a of toInsert) {
    try {
      const album = await fetchAlbum(token, a.albumId)
      const primaryArtist = album.artists?.[0]?.name || 'Unknown artist'
      const albumName = album.name || 'Untitled'
      const art = album.images?.[0]?.url || null
      const year = album.release_date ? parseInt(album.release_date.slice(0, 4), 10) : null
      rows.push({
        artist: primaryArtist,
        album: albumName,
        title: albumName,
        album_artwork_url: art,
        album_release_year: isNaN(year) ? null : year,
        platform_url: a.url,
        user_id: process.env.IMPORT_DEFAULT_USERID,
      })
    } catch (err) {
      console.error(`Failed album ${a.url}:`, err.message)
    }
  }

  console.log(`Inserting ${rows.length} new albums...`)
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase.from('music_picks').insert(batch)
    if (error) {
      console.error('Insert error:', error.message)
      process.exit(1)
    }
  }

  console.log('Done. Inserted', rows.length, 'albums.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
