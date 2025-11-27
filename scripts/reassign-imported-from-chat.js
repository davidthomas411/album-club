#!/usr/bin/env node
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env.local' })
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const IMPORTED_ID = process.env.IMPORT_DEFAULT_USERID || '8cddd5c2-cfdd-40e6-a742-98c8c6873780'
const inputPath = process.argv[2] || 'links_4.csv'
const max = process.env.MAX_FIX ? parseInt(process.env.MAX_FIX, 10) : 0

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const USER_MAP = {
  'dave': '11111111-1111-1111-1111-111111111111',
  'david thomas': '11111111-1111-1111-1111-111111111111',
  'rory': '44444444-4444-4444-4444-444444444444',
  'rory edwards': '44444444-4444-4444-4444-444444444444',
  'ferg': '22222222-2222-2222-2222-222222222222',
  'fergus neville': '22222222-2222-2222-2222-222222222222',
  'neil': '33333333-3333-3333-3333-333333333333',
  'neil tilston': '33333333-3333-3333-3333-333333333333',
}

function parseLine(line) {
  const match = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'))
  if (match.length < 5) return null
  const [date, time, userRaw, url, type] = match
  return { date, time, user: userRaw.toLowerCase().trim(), url, type }
}

const normalize = (url) => {
  if (!url) return ''
  const noQuery = url.split('?')[0]
  return noQuery.replace(/\/+$/, '')
}

async function main() {
  const csv = fs.readFileSync(path.resolve(inputPath), 'utf8').trim().split(/\r?\n/).slice(1)
  const rows = []
  for (const line of csv) {
    const r = parseLine(line)
    if (!r) continue
    if (r.type !== 'album' && r.type !== 'song') continue
    const uid = USER_MAP[r.user]
    if (!uid) continue
    rows.push({
      url: r.url,
      norm: normalize(r.url),
      user_id: uid,
      pick_type: r.type === 'song' ? 'song' : 'album',
    })
    if (max && rows.length >= max) break
  }
  console.log('Parsed rows', rows.length)

  const map = new Map()
  rows.forEach((r) => {
    if (!map.has(r.norm)) map.set(r.norm, r)
  })
  console.log('Unique normalized URLs', map.size)

  const { data, error } = await supabase
    .from('music_picks')
    .select('id, platform_url')
    .or(`user_id.eq.${IMPORTED_ID},user_id.is.null`)

  if (error) {
    console.error('Select error', error)
    process.exit(1)
  }

  let updated = 0
  for (const row of data || []) {
    const norm = normalize(row.platform_url)
    const target = map.get(norm)
    if (!target) continue
    const { error: uErr } = await supabase
      .from('music_picks')
      .update({ user_id: target.user_id, pick_type: target.pick_type || 'album' })
      .eq('id', row.id)
    if (uErr) {
      console.error('Update error', uErr)
      process.exit(1)
    }
    updated += 1
    if (process.env.DEBUG) {
      console.log('[reassign] set', row.platform_url, '->', target.user_id, 'type', target.pick_type)
    }
  }

  console.log('Updated rows', updated)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
