import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_DAYS_BACK = 30
const senderKeys = ['neil', 'dave', 'rory', 'ferg'] as const
type SenderKey = (typeof senderKeys)[number]

type SonglinkMeta = {
  title?: string | null
  artistName?: string | null
  thumbnailUrl?: string | null
}

type ParsedLine = {
  date: Date
  sender: string
  message: string
}

type ParsedLink = {
  url: string
  platform: 'spotify' | 'tidal'
  kind: 'album' | 'track' | 'playlist'
}

type Candidate = {
  url: string
  sender: string
  platform: ParsedLink['platform']
  kind: ParsedLink['kind']
  date: Date
}

type DateOrder = 'mdy' | 'dmy'

function parseWhatsAppLine(line: string, dateOrder: DateOrder): ParsedLine | null {
  const cleaned = line.replace(/^\uFEFF/, '').trim()
  // Handles both "dd/mm/yy, hh:mm - Sender: msg" and "[dd/mm/yy, hh:mm:ss PM] Sender: msg"
  const regex =
    /^(?:\s*\[?)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[\u202F\u00A0\s]?(AM|PM)?\]?\s*(?:-|–)?\s*([^:]+):\s+(.*)$/iu
  const match = cleaned.match(regex)
  if (!match) return null

  const [, a, b, y, hh, mm, ss, ampm, sender, message] = match
  let yearNum: number
  if (y) {
    yearNum = y.length === 2 ? Number(`20${y}`) : Number(y)
  } else {
    yearNum = new Date().getFullYear()
  }

  const firstPart = Number(a)
  const secondPart = Number(b)
  let month: number
  let day: number
  // If one side is impossible for a month, trust that side as the day.
  if (firstPart > 12 && secondPart <= 12) {
    day = firstPart
    month = secondPart
  } else if (secondPart > 12 && firstPart <= 12) {
    month = firstPart
    day = secondPart
  } else {
    // Ambiguous (both <= 12): use the detected order.
    if (dateOrder === 'dmy') {
      day = firstPart
      month = secondPart
    } else {
      month = firstPart
      day = secondPart
    }
  }
  if (month > 12 || day > 31) return null

  let hour = Number(hh)
  const minute = Number(mm)
  const second = ss ? Number(ss) : 0
  if (ampm) {
    const upper = ampm.toUpperCase()
    if (upper === 'PM' && hour < 12) hour += 12
    if (upper === 'AM' && hour === 12) hour = 0
  }

  const date = new Date(yearNum, month - 1, day, hour, minute, second)
  if (isNaN(date.getTime())) return null
  // If the parsed date is in the future, skip this line (do not import)
  if (date.getTime() > Date.now()) return null
  return { date, sender: sender.trim(), message: message.trim() }
}

function extractLinks(text: string): ParsedLink[] {
  const links: ParsedLink[] = []

  const collect = (
    regex: RegExp,
    platform: ParsedLink['platform']
  ) => {
    for (const match of text.matchAll(regex)) {
      const kind = (match[1] as ParsedLink['kind']) || 'album'
      links.push({
        url: match[0].trim(),
        platform,
        kind,
      })
    }
  }

  // Spotify: album/track/playlist
  collect(/https?:\/\/open\.spotify\.com\/(album|track|playlist)\/[^\s)]+/gi, 'spotify')
  // Tidal: supports both tidal.com/album/... and tidal.com/browse/album/...
  collect(
    /https?:\/\/(?:listen\.)?tidal\.com\/(?:browse\/)?(album|track|playlist)\/[^\s)]+/gi,
    'tidal'
  )

  return links
}

async function fetchSonglinkMeta(sourceUrl: string): Promise<SonglinkMeta | null> {
  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(sourceUrl)}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    const entityId = data?.entityUniqueId
    const entity = entityId ? data?.entitiesByUniqueId?.[entityId] : null
    if (!entity) return null
    return {
      title: entity.title || null,
      artistName: entity.artistName || null,
      thumbnailUrl: entity.thumbnailUrl || null,
    }
  } catch (err) {
    console.error('[whatsapp-import] songlink meta fetch failed', err)
    return null
  }
}

function detectDateOrder(lines: string[]): DateOrder {
  let mdyVotes = 0
  let dmyVotes = 0
  const regex =
    /^(?:\s*\[?)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[\u202F\u00A0\s]?(AM|PM)?\]?\s*(?:-|–)?\s*([^:]+):\s+(.*)$/iu
  for (const raw of lines) {
    const cleaned = raw.replace(/^\uFEFF/, '').trim()
    const match = cleaned.match(regex)
    if (!match) continue
    const first = Number(match[1])
    const second = Number(match[2])
    if (first > 12 && second <= 12) dmyVotes++
    else if (second > 12 && first <= 12) mdyVotes++
  }
  // Default to mdy (WhatsApp exports on this data set) when ambiguous.
  return mdyVotes >= dmyVotes ? 'mdy' : 'dmy'
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const themeId = (formData.get('themeId') as string) || null
    const daysBackRaw = formData.get('daysBack') as string | null
    const daysBack = Number(daysBackRaw ?? DEFAULT_DAYS_BACK)
    const useCutoff = Number.isFinite(daysBack) && daysBack > 0
    const cutoff = useCutoff ? Date.now() - daysBack * 24 * 60 * 60 * 1000 : 0

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    let defaultUserId = process.env.IMPORT_DEFAULT_USER_ID || process.env.NEXT_PUBLIC_IMPORT_DEFAULT_USER_ID
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const authClient = createClient(supabaseUrl, serviceKey, { db: { schema: 'auth' } })

    const isValidUUID = (value: string | undefined | null) =>
      typeof value === 'string' &&
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)

    const senderEmailMap: Record<SenderKey, string | undefined> = {
      neil: process.env.IMPORT_USER_EMAIL_NEIL,
      dave: process.env.IMPORT_USER_EMAIL_DAVE,
      rory: process.env.IMPORT_USER_EMAIL_RORY,
      ferg: process.env.IMPORT_USER_EMAIL_FERG,
    }
    const senderDisplayMap: Record<SenderKey, string> = {
      neil: 'Neil Tilston',
      dave: 'David Thomas',
      rory: 'Rory Edwards',
      ferg: 'Fergus Neville',
    }
    const emailToUserId = new Map<string, string>()
    const senderToUserId = new Map<string, string | null>()
    const profileCache = new Map<string, string | null>()

    const normalizeSender = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim()

    const resolveKey = (sender: string): SenderKey | null => {
      const norm = normalizeSender(sender)
      if (norm.startsWith('neil')) return 'neil'
      if (norm.startsWith('dave') || norm.startsWith('david')) return 'dave'
      if (norm.startsWith('rory')) return 'rory'
      if (norm.startsWith('ferg') || norm.startsWith('fergus')) return 'ferg'
      return null
    }

    const getAuthUserIdForEmail = async (email: string): Promise<string | null> => {
      if (emailToUserId.has(email)) return emailToUserId.get(email) || null
      const { data, error } = await authClient
        .from('users')
        .select('id,email')
        .eq('email', email)
        .limit(1)
        .maybeSingle()
      if (error) {
        emailToUserId.set(email, null)
        return null
      }
      const id = (data as { id?: string } | null)?.id ?? null
      if (id) emailToUserId.set(email, id)
      else emailToUserId.set(email, null)
      return id
    }

    const ensureProfileForUser = async (authUserId: string, key: SenderKey | null): Promise<string | null> => {
      if (profileCache.has(authUserId)) return profileCache.get(authUserId) || null
      const { data: existingProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUserId)
        .limit(1)
        .maybeSingle()
      if (!profileErr && existingProfile?.id) {
        profileCache.set(authUserId, existingProfile.id)
        return existingProfile.id
      }
      const displayName = key ? senderDisplayMap[key] || key : 'Imported User'
      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert({ id: authUserId, display_name: displayName })
        .select('id')
        .maybeSingle()
      if (insertErr) {
        debugInfo.profileInsertFailures.push(`${authUserId}:${insertErr.message}`)
        profileCache.set(authUserId, null)
        return null
      }
      const newId = (inserted as { id?: string } | null)?.id ?? null
      profileCache.set(authUserId, newId)
      return newId
    }

    const resolveUserId = async (sender: string): Promise<string | null> => {
      if (senderToUserId.has(sender)) return senderToUserId.get(sender) || null
      const trace: string[] = [`sender:${sender}`]
      const key = resolveKey(sender)
      const email = key ? senderEmailMap[key] : undefined
      trace.push(`key:${key ?? 'none'}`, `email:${email ?? 'none'}`)
      if (!email) {
        debugInfo.missingEmails.push(sender)
      }
      if (email) {
        const authId = await getAuthUserIdForEmail(email)
        trace.push(`authId:${authId ?? 'none'}`)
        if (authId) {
          const profileId = await ensureProfileForUser(authId, key)
          trace.push(`profile:${profileId ?? 'none'}`)
          senderToUserId.set(sender, profileId)
          debugInfo.mappingTraces.push(trace.join('|'))
          return profileId
        } else {
          debugInfo.missingAuthUsers.push(sender)
        }
      }
      senderToUserId.set(sender, null)
      debugInfo.unmatchedSenders.push(sender)
      trace.push('profile:none')
      debugInfo.mappingTraces.push(trace.join('|'))
      return null
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)

    const debugInfo = {
      totalLines: lines.length,
      parsedLines: 0,
      withinCutoffLines: 0,
      linksFound: 0,
      uniqueCountBeforeInsert: 0,
      sampleLinks: [] as string[],
      resolvedUsers: [] as string[],
      unmatchedSenders: [] as string[],
      missingEmails: [] as string[],
      missingAuthUsers: [] as string[],
      profileInsertFailures: [] as string[],
      mappingTraces: [] as string[],
      dateOrder: 'mdy' as DateOrder,
    }

    const candidates: Candidate[] = []
    const dateOrder = detectDateOrder(lines)
    debugInfo.dateOrder = dateOrder
    // parse from bottom (most recent) upward
    for (const line of [...lines].reverse()) {
      const parsed = parseWhatsAppLine(line, dateOrder)
      if (!parsed) continue
      debugInfo.parsedLines++
      if (useCutoff && parsed.date.getTime() < cutoff) continue
      debugInfo.withinCutoffLines++
      const urls = extractLinks(parsed.message)
      urls
        .filter(({ kind }) => kind === 'album') // only import albums
        .forEach(({ url, platform, kind }) => {
          candidates.push({ url, platform, kind, sender: parsed.sender, date: parsed.date })
        })
      debugInfo.linksFound += urls.length
    }

    const unique = new Map<
      string,
      { sender: string; platform: ParsedLink['platform']; kind: ParsedLink['kind']; date?: Date }
    >()
    for (const c of candidates) {
      if (!unique.has(c.url)) {
        unique.set(c.url, { sender: c.sender, platform: c.platform, kind: c.kind, date: c.date })
      }
    }
    debugInfo.uniqueCountBeforeInsert = unique.size
    debugInfo.sampleLinks = Array.from(unique.keys()).slice(0, 10)

    let inserted = 0
    const errors: string[] = []
    const missingUser: Set<string> = new Set()
    let skippedWeekLimit = 0
    const invalidDefaultUserId = defaultUserId && !isValidUUID(defaultUserId) ? defaultUserId : null
    if (invalidDefaultUserId) {
      errors.push(`IMPORT_DEFAULT_USER_ID is not a valid UUID: "${invalidDefaultUserId}"`)
      defaultUserId = null
    }

    // Prepare default profile id if provided
    let defaultProfileId: string | null = null
    if (defaultUserId) {
      const profileId = await ensureProfileForUser(defaultUserId, null)
      if (!profileId) {
        errors.push('Could not ensure profile for IMPORT_DEFAULT_USER_ID; will treat as missing')
      } else {
        defaultProfileId = profileId
      }
    }

    // Cache theme lookups by date key (yyyy-mm-dd)
    const themeCache = new Map<string, { id: string | null; weekStartIso: string; weekEndIso: string }>()
    const themeIdToBounds = new Map<string, { weekStartIso: string; weekEndIso: string } | null>()
    const weekCountCache = new Map<string, number>()

    const getWeekCount = async (weekStartIso: string, weekEndIso: string): Promise<number> => {
      const key = `${weekStartIso}:${weekEndIso}`
      if (weekCountCache.has(key)) return weekCountCache.get(key) as number
      const { count, error } = await supabase
        .from('music_picks')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${weekStartIso}T00:00:00.000Z`)
        .lte('created_at', `${weekEndIso}T23:59:59.999Z`)
      if (error) {
        errors.push(`Week count failed for ${weekStartIso}-${weekEndIso}: ${error.message}`)
        weekCountCache.set(key, 0)
        return 0
      }
      const c = count ?? 0
      weekCountCache.set(key, c)
      return c
    }

    const getFridayWeekBounds = (date: Date) => {
      const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const day = utc.getUTCDay() // 0=Sun ... 5=Fri
      const diff = (day - 5 + 7) % 7 // days since last Friday
      utc.setUTCDate(utc.getUTCDate() - diff)
      const weekStart = utc
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
      const fmt = (d: Date) => d.toISOString().slice(0, 10)
      return { weekStart, weekEnd, weekStartIso: fmt(weekStart), weekEndIso: fmt(weekEnd) }
    }

    const getThemeBoundsById = async (id: string): Promise<{ weekStartIso: string; weekEndIso: string } | null> => {
      if (themeIdToBounds.has(id)) return themeIdToBounds.get(id) ?? null
      const { data, error } = await supabase
        .from('weekly_themes')
        .select('id,week_start_date,week_end_date')
        .eq('id', id)
        .limit(1)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') {
        errors.push(`Theme bounds lookup failed for ${id}: ${error.message}`)
        themeIdToBounds.set(id, null)
        return null
      }
      const bounds =
        data?.week_start_date && data?.week_end_date
          ? { weekStartIso: data.week_start_date, weekEndIso: data.week_end_date }
          : null
      themeIdToBounds.set(id, bounds)
      return bounds
    }

    const findThemeForDate = async (
      date: Date
    ): Promise<{ id: string | null; weekStartIso: string; weekEndIso: string }> => {
      const { weekStartIso, weekEndIso } = getFridayWeekBounds(date)
      if (themeCache.has(weekStartIso)) return themeCache.get(weekStartIso)!
      const { data, error } = await supabase
        .from('weekly_themes')
        .select('id,week_start_date,week_end_date')
        .lte('week_start_date', weekStartIso)
        .gte('week_end_date', weekStartIso)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error && error.code !== 'PGRST116') {
        errors.push(`Theme lookup failed for ${weekStartIso}: ${error.message}`)
        const fallback = { id: null, weekStartIso, weekEndIso }
        themeCache.set(weekStartIso, fallback)
        return fallback
      }
      const id = data?.id ?? null
      const bounds =
        data?.week_start_date && data?.week_end_date
          ? { weekStartIso: data.week_start_date, weekEndIso: data.week_end_date }
          : { weekStartIso, weekEndIso }
      const entry = { id, ...bounds }
      themeCache.set(weekStartIso, entry)
      return entry
    }

    const ensurePlaceholderTheme = async (
      weekStartIso: string,
      weekEndIso: string
    ): Promise<{ id: string | null; weekStartIso: string; weekEndIso: string }> => {
      const cacheKey = weekStartIso
      if (themeCache.has(cacheKey)) return themeCache.get(cacheKey)!
      const name = `Imported (week of ${weekStartIso})`
      const { data: existing, error: existingErr } = await supabase
        .from('weekly_themes')
        .select('id,week_start_date,week_end_date')
        .eq('week_start_date', weekStartIso)
        .eq('week_end_date', weekEndIso)
        .limit(1)
        .maybeSingle()
      if (existingErr && existingErr.code !== 'PGRST116') {
        errors.push(`Placeholder theme lookup failed for ${weekStartIso}: ${existingErr.message}`)
      }
      if (existing?.id) {
        const entry = { id: existing.id, weekStartIso, weekEndIso }
        themeCache.set(cacheKey, entry)
        return entry
      }
      const { data: inserted, error: insertErr } = await supabase
        .from('weekly_themes')
        .insert({
          theme_name: name,
          week_start_date: weekStartIso,
          week_end_date: weekEndIso,
          is_active: false,
        })
        .select('id')
        .maybeSingle()
      if (insertErr) {
        errors.push(`Placeholder theme insert failed for ${weekStartIso}: ${insertErr.message}`)
        const fallback = { id: null, weekStartIso, weekEndIso }
        themeCache.set(cacheKey, fallback)
        return fallback
      }
      const id = inserted?.id ?? null
      const entry = { id, weekStartIso, weekEndIso }
      themeCache.set(cacheKey, entry)
      return entry
    }

    const getWeekWindow = async (
      date: Date,
      explicitThemeId: string | null
    ): Promise<{ themeId: string | null; weekStartIso: string; weekEndIso: string }> => {
      if (explicitThemeId) {
        const bounds = await getThemeBoundsById(explicitThemeId)
        if (bounds) return { themeId: explicitThemeId, ...bounds }
      }
      const inferred = await findThemeForDate(date)
      if (inferred.id) return inferred
      // Create or reuse a placeholder so even "no theme" weeks get their own bin.
      return await ensurePlaceholderTheme(inferred.weekStartIso, inferred.weekEndIso)
    }

    for (const [url, meta] of unique.entries()) {
      if (meta.kind !== 'album') continue
      const { data: existing, error: existsError } = await supabase
        .from('music_picks')
        .select('id')
        .eq('platform_url', url)
        .maybeSingle()
      if (existsError && existsError.code !== 'PGRST116') {
        errors.push(`Check failed for ${url}: ${existsError.message}`)
        continue
      }
      const dateForRow = meta.date
      const effectiveDate = dateForRow && !isNaN(dateForRow.getTime()) ? dateForRow : new Date()
      const { themeId: resolvedThemeId, weekStartIso, weekEndIso } = await getWeekWindow(
        effectiveDate,
        themeId
      )
      const createdAt = effectiveDate.toISOString()

      const userId = await resolveUserId(meta.sender)
      if (userId) {
        debugInfo.resolvedUsers.push(`${meta.sender} -> ${userId}`)
      }
      const effectiveUserId = userId || defaultProfileId
      if (!effectiveUserId) {
        missingUser.add(meta.sender)
        errors.push(`No user mapping and no IMPORT_DEFAULT_USER_ID for sender "${meta.sender}" (${url})`)
        continue
      }

      const themeForDate = resolvedThemeId

      const songlinkMeta = await fetchSonglinkMeta(url)

      const payload = {
        album: 'Imported via WhatsApp',
        title: songlinkMeta?.title || 'Imported album',
        artist: songlinkMeta?.artistName || meta.sender || 'Unknown',
        platform_url: url,
        platform: meta.platform,
        pick_type: 'album',
        weekly_theme_id: themeForDate,
        album_artwork_url: songlinkMeta?.thumbnailUrl || null,
        user_id: effectiveUserId,
        created_at: createdAt,
      }

      if (existing?.id) {
        const { error: updateError } = await supabase.from('music_picks').update(payload).eq('id', existing.id)
        if (updateError) {
          errors.push(`Update failed for ${url}: ${updateError.message}`)
        }
        continue
      }

      const existingWeekCount = await getWeekCount(weekStartIso, weekEndIso)
      if (existingWeekCount >= 4) {
        skippedWeekLimit++
        continue
      }
      // optimistic increment to avoid another fetch within this run
      weekCountCache.set(`${weekStartIso}:${weekEndIso}`, existingWeekCount + 1)

      const { error: insertError } = await supabase.from('music_picks').insert(payload)
      if (insertError) {
        errors.push(`Insert failed for ${url}: ${insertError.message}`)
      } else {
        inserted++
      }
    }

    return NextResponse.json({
      found: unique.size,
      inserted,
      debug: debugInfo,
      missingUserMapping: Array.from(missingUser),
      skippedWeekLimit,
      errors,
      mappingTraces: debugInfo.mappingTraces,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
