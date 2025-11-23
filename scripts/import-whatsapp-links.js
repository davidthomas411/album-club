#!/usr/bin/env node
/**
 * Import WhatsApp-exported chat links into music_picks.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WHATSAPP_THEME_ID=<optional> DAYS_BACK=10 node scripts/import-whatsapp-links.js /path/to/chat.txt
 *
 * Notes:
 * - Expects the standard WhatsApp text export format:
 *   "dd/mm/yyyy, hh:mm - Name: message"
 * - Extracts Spotify album links from the last N days (default 10).
 * - Skips platform_url values already in music_picks.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TARGET_THEME_ID = process.env.WHATSAPP_THEME_ID || null
const DAYS_BACK = Number(process.env.DAYS_BACK || 10)

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/import-whatsapp-links.js /path/to/chat.txt')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function parseWhatsAppLine(line) {
  const match = line.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})\s+-\s+([^:]+):\s+(.*)$/u
  )
  if (!match) return null
  const [_, d, m, y, hh, mm, sender, message] = match
  const year = y.length === 2 ? Number(`20${y}`) : Number(y)
  // Interpret as DD/MM/YYYY
  const date = new Date(year, Number(m) - 1, Number(d), Number(hh), Number(mm))
  return { date, sender: sender.trim(), message: message.trim() }
}

function extractSpotifyAlbums(text) {
  const regex = /https?:\/\/open\.spotify\.com\/album\/[^\s)]+/gi
  const matches = text.match(regex)
  return matches ? matches.map((u) => u.trim()) : []
}

async function pickExists(url) {
  const { data, error } = await supabase
    .from('music_picks')
    .select('id')
    .eq('platform_url', url)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return !!data
}

async function insertPick(url, sender) {
  const payload = {
    album: 'Imported via WhatsApp',
    title: null,
    artist: sender || 'Unknown',
    platform_url: url,
    platform: 'spotify',
    pick_type: 'album',
    weekly_theme_id: TARGET_THEME_ID,
    album_artwork_url: null,
    user_id: null,
  }
  const { error } = await supabase.from('music_picks').insert(payload)
  if (error) throw error
}

async function main() {
  const cutoff = Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000
  const content = fs.readFileSync(path.resolve(inputPath), 'utf8')
  const lines = content.split(/\r?\n/).filter(Boolean)

  const candidates = []
  for (const line of lines) {
    const parsed = parseWhatsAppLine(line)
    if (!parsed) continue
    if (parsed.date.getTime() < cutoff) continue
    const urls = extractSpotifyAlbums(parsed.message)
    urls.forEach((url) => candidates.push({ url, sender: parsed.sender }))
  }

  const unique = new Map()
  for (const c of candidates) {
    if (!unique.has(c.url)) unique.set(c.url, c.sender)
  }

  console.log(`Found ${unique.size} Spotify album links in last ${DAYS_BACK} day(s).`)

  let inserted = 0
  for (const [url, sender] of unique.entries()) {
    const exists = await pickExists(url)
    if (exists) {
      console.log(`Skip existing: ${url}`)
      continue
    }
    try {
      await insertPick(url, sender)
      inserted++
      console.log(`Inserted: ${url} (sender: ${sender})`)
    } catch (err) {
      console.error(`Failed to insert ${url}:`, err.message || err)
    }
  }

  console.log(`Done. Inserted ${inserted} new pick(s).`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
