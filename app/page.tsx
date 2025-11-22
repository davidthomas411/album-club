'use client'

import { Sidebar } from '@/components/sidebar'
import { FaceTracker } from '@/components/face-tracker'
import { Music, Play, Menu, ExternalLink } from 'lucide-react'
import { useEffect, useState, useMemo, CSSProperties } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface WeeklyTheme {
  id: string
  theme_name: string
  theme_description: string | null
  curator: {
    display_name: string
    face_images_folder: string | null
    face_blob_prefix: string | null
  } | null
}

interface MusicPick {
  id: string
  artist: string
  album: string
  title?: string | null
  platform_url: string
  platform: string | null
  album_artwork_url: string | null
  weekly_theme_id: string
  user: {
    display_name: string
    face_blob_prefix: string | null
  } | null
  created_at?: string
  weekly_theme?: {
    theme_name: string | null
  } | null
}

const CORE_MEMBERS = [
  { id: 'neil', displayName: 'Neil', facePrefix: 'neil' },
  { id: 'ferg', displayName: 'Ferg', facePrefix: 'ferg' },
  { id: 'rory', displayName: 'Rory', facePrefix: 'rory' },
  { id: 'dave', displayName: 'Dave', facePrefix: 'dave' },
] as const

const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${process.env.NEXT_PUBLIC_SUPABASE_FACE_BUCKET || 'faces'}`
  : null

function VinylArtwork({
  artworkUrl,
  alt,
  seed,
  title,
  showTitleRing = false,
  labelArt,
}: {
  artworkUrl?: string | null
  alt: string
  seed?: string
  title?: string | null
  showTitleRing?: boolean
  labelArt?: string | null
}) {
  const hash = useMemo(() => hashSeed(seed || alt || 'vinyl'), [seed, alt])

  const wearRotation = useMemo(
    () => 0,
    [hash]
  )
  const wearShiftX = useMemo(
    () => 0,
    [hash]
  )
  const wearShiftY = useMemo(
    () => 0,
    [hash]
  )
  const wearOpacity = useMemo(
    () => 0.7,
    [hash]
  )
  const edgeWear = useMemo(
    () => 0.1,
    [hash]
  )
  const edgeShadow = useMemo(
    () => 0.32,
    [hash]
  )
  const ringShadow = useMemo(
    () => 0.52,
    [hash]
  )
  const leftFade = useMemo(
    () => 0.1,
    [hash]
  )
  const midWear = useMemo(
    () => 0.14,
    [hash]
  )

  const artStyles: CSSProperties = {
    ['--cover-art' as string]: artworkUrl ? `url(${artworkUrl})` : undefined,
    ['--label-art' as string]: labelArt
      ? labelArt
      : artworkUrl
      ? `url(${artworkUrl})`
      : undefined,
    ['--wear-shift-x' as string]: `${wearShiftX}px`,
    ['--wear-shift-y' as string]: `${wearShiftY}px`,
    ['--wear-opacity' as string]: wearOpacity,
    ['--edge-wear-strength' as string]: edgeWear,
    ['--edge-wear-shadow' as string]: edgeShadow,
    ['--ring-shadow-alpha' as string]: ringShadow,
    ['--left-fade-strength' as string]: leftFade,
    ['--mid-wear-strength' as string]: midWear,
  }

  return (
    <div className="vinyl-card" style={artStyles} role="img" aria-label={alt}>
      <div className="vinyl-record" aria-hidden="true">
        <div className="vinyl-label" />
        {showTitleRing && title ? (
          <div className="vinyl-title-ring" aria-hidden="true">
            {title.split('').map((char, idx) => {
              const angle = (idx / Math.max(title.length, 1)) * 360
              return (
                <span
                  key={`${char}-${idx}`}
                  style={{
                    transform: `rotate(${angle}deg) translateY(-50%) rotate(90deg)`,
                  }}
                >
                  {char}
                </span>
              )
            })}
          </div>
        ) : null}
      </div>
      <div className="vinyl-sleeve">
        <div className="vinyl-ring" aria-hidden="true" />
        <div className="vinyl-scuffs" aria-hidden="true" />
        <div className="vinyl-creases" aria-hidden="true" />
        <div className="vinyl-damage" aria-hidden="true" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [currentTheme, setCurrentTheme] = useState<WeeklyTheme | null>(null)
  const [weeklyPicks, setWeeklyPicks] = useState<MusicPick[]>([])
  const [userFaceImages, setUserFaceImages] = useState<Record<string, Record<string, string>>>({})
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [recentPicks, setRecentPicks] = useState<MusicPick[]>([])
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    async function fetchCurrentTheme() {
      console.log('[v0] Fetching current active theme...')
      const { data, error } = await supabase
        .from('weekly_themes')
        .select(`
          id,
          theme_name,
          theme_description,
          week_start_date,
          week_end_date,
          created_at,
          is_active,
          curator:curator_id (
            display_name,
            face_images_folder,
            face_blob_prefix
          )
        `)
        .order('is_active', { ascending: false })
        .order('week_start_date', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false })
        .limit(1)

      console.log('[v0] Theme query result:', { count: data?.length || 0, error })

      if (!error && data && data.length > 0) {
        const latestTheme = data[0]
        console.log('[v0] Selected theme:', latestTheme)
        setCurrentTheme(latestTheme)
        
        console.log('[v0] Fetching picks for theme:', data.id)
        const { data: picksData, error: picksError } = await supabase
          .from('music_picks')
          .select(`
            id,
            artist,
            album,
            platform_url,
            platform,
            album_artwork_url,
            weekly_theme_id,
            user:user_id (
              display_name,
              face_blob_prefix
            )
          `)
          .eq('weekly_theme_id', data.id)
          .order('created_at', { ascending: false })
        
        console.log('[v0] Picks query result:', { picksData, picksError, count: picksData?.length || 0 })
        
        const { data: allPicks } = await supabase
          .from('music_picks')
          .select('id, album, artist, weekly_theme_id')
          .order('created_at', { ascending: false })
        
        console.log('[v0] ALL picks in database:', allPicks)
        console.log('[v0] Expected theme ID:', data.id)
        console.log('[v0] Theme ID mismatch check:', allPicks?.map(p => ({
          album: p.album,
          has_theme: !!p.weekly_theme_id,
          matches: p.weekly_theme_id === data.id
        })))
        
        if (picksData) {
          setWeeklyPicks(picksData)
        }
      } else {
        console.log('[v0] No active theme found or error:', error)
      }
    }

    fetchCurrentTheme()
  }, [])

  useEffect(() => {
    async function fetchRecentPicks() {
      const { data, error } = await supabase
        .from('music_picks')
        .select(`
          id,
          title,
          album,
          artist,
          created_at,
          platform_url,
          album_artwork_url,
          weekly_theme:weekly_theme_id(theme_name, week_start_date),
          user:user_id(display_name, face_blob_prefix)
        `)
        .order('created_at', { ascending: false })
        .limit(60)

      if (error) {
        console.error('[v0] Error fetching recent picks:', error)
        return
      }
      if (data) {
        const sorted = [...data].sort((a, b) => {
          const aDate = a.weekly_theme?.week_start_date || a.created_at || ''
          const bDate = b.weekly_theme?.week_start_date || b.created_at || ''
          return bDate.localeCompare(aDate)
        })
        setRecentPicks(sorted)
      }
    }

    fetchRecentPicks()
  }, [])

  const recentByTheme = useMemo(() => {
    const map = new Map<string, MusicPick[]>()
    recentPicks.forEach((pick) => {
      const themeName = pick.weekly_theme?.theme_name || 'No Theme'
      const themeKey = themeName.trim() || 'No Theme'
      if (!map.has(themeKey)) {
        map.set(themeKey, [])
      }
      map.get(themeKey)?.push(pick)
    })
    return Array.from(map.entries()).map(([theme, picks]) => ({
      theme,
      picks,
    }))
  }, [recentPicks])

  useEffect(() => {
    async function fetchCoreMemberFaces() {
      const cacheBust = Date.now()
      const faceMap: Record<string, Record<string, string>> = {}
      await Promise.all(
        CORE_MEMBERS.map(async (member) => {
          try {
            const response = await fetch(
              `/api/get-face-images?member=${member.facePrefix}&_=${cacheBust}`,
              { cache: 'no-store' },
            )
            const data = await response.json()
            if (data.images) {
              faceMap[member.facePrefix] = data.images
            }
          } catch (error) {
            console.error(`[v0] Error fetching face images for ${member.facePrefix}:`, error)
          }
        })
      )

      if (Object.keys(faceMap).length > 0) {
        setUserFaceImages((prev) => ({ ...prev, ...faceMap }))
      }
    }

    fetchCoreMemberFaces()
  }, [])

  useEffect(() => {
    async function fetchAllUserFaceImages() {
      const uniqueUsers = new Set(
        weeklyPicks
          .map(pick => pick.user?.face_blob_prefix)
          .filter(Boolean) as string[]
      )
      
      const faceImagesMap: Record<string, Record<string, string>> = {}
      const cacheBust = Date.now()
      
      for (const userPrefix of uniqueUsers) {
        try {
          const response = await fetch(
            `/api/get-face-images?member=${userPrefix}&_=${cacheBust}`,
            { cache: 'no-store' },
          )
          const data = await response.json()
          if (data.images) {
            faceImagesMap[userPrefix] = data.images
          }
        } catch (error) {
          console.error(`[v0] Error fetching face images for ${userPrefix}:`, error)
        }
      }
      
      if (Object.keys(faceImagesMap).length > 0) {
        setUserFaceImages(prev => ({ ...prev, ...faceImagesMap }))
      }
    }

    if (weeklyPicks.length > 0) {
      fetchAllUserFaceImages()
    }
  }, [weeklyPicks])

  const fallbackCurator = CORE_MEMBERS[0]
  const activeCuratorPrefix =
    currentTheme?.curator?.face_blob_prefix || fallbackCurator?.facePrefix || ''
  const curatorMember =
    CORE_MEMBERS.find((member) => member.facePrefix === activeCuratorPrefix) ||
    fallbackCurator
  const curatorFaceImages = curatorMember ? userFaceImages[curatorMember.facePrefix] : undefined
  const curatorName =
    currentTheme?.curator?.display_name ||
    curatorMember?.displayName ||
    'Curator'
  const themeExpired =
    currentTheme?.week_end_date &&
    new Date(currentTheme.week_end_date).getTime() < Date.now()
  const latestPick = weeklyPicks[0] || recentPicks[0] || null
  const latestPickLink = latestPick?.platform_url
    ? `/link?url=${encodeURIComponent(latestPick.platform_url)}`
    : null

  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-surface p-2 rounded-lg shadow-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block fixed inset-0 z-40 md:relative`}>
        <div 
          className="absolute inset-0 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
      </div>
      
      {/* Main Content - Adjusted margins for mobile */}
      <main className="flex-1 p-4 md:ml-64 md:p-8">
        <section className="mb-4 md:mb-6 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Album Club</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Neil made us quit Spotify because morals</p>
        </section>

        <section className={`mb-8 md:mb-12 bg-gradient-to-r ${currentTheme ? 'from-primary/20 to-primary/5' : 'from-muted/20 to-muted/5'} rounded-lg p-6 md:p-10 relative overflow-hidden`}>
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:gap-10">
            <div className="flex justify-center md:justify-start">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-full overflow-hidden border border-white/10 bg-background/70 shadow-2xl">
                <FaceTracker
                  memberFolder={curatorMember.facePrefix}
                  blobUrls={curatorFaceImages}
                  size={256}
                  fallbackBasePath={
                    storageBase ? `${storageBase}/${curatorMember.facePrefix}` : undefined
                  }
                />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left items-center md:items-start flex flex-col gap-3">
              {!themeExpired && (
                <p className="text-base md:text-lg text-muted-foreground mb-1">
                  This Week's Theme
                </p>
              )}
              <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-2 text-center md:text-left">
                {currentTheme ? currentTheme.theme_name : 'No theme set'}
              </h2>
              {currentTheme?.theme_description && (
                <p className="text-base md:text-lg text-muted-foreground mb-1 text-center md:text-left">
                  {currentTheme.theme_description}
                </p>
              )}
              <p className="text-base md:text-lg text-muted-foreground text-center md:text-left">
                {currentTheme ? `Curated by ${curatorName}` : `Curated by ${curatorMember.displayName}`}
              </p>
              {themeExpired && (
                <p className="text-xs md:text-sm text-amber-300/80 text-center md:text-left">
                  This theme ended — set a new one.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-3 w-full">
                <Link href="/set-theme">
                  <button className="bg-primary hover:bg-primary-hover text-black font-semibold py-3 px-6 md:px-8 rounded-full transition-all text-base whitespace-nowrap">
                    {currentTheme ? 'Set New Theme' : 'Set Theme'}
                  </button>
                </Link>
                <Link href="/feed">
                  <button className="bg-surface hover:bg-surface-hover text-foreground font-semibold py-3 px-6 md:px-8 rounded-full border border-white/10 transition-all text-base whitespace-nowrap">
                    View Feed
                  </button>
                </Link>
              </div>
            </div>
            {latestPick && (
              <div className="hidden md:block">
                <a
                  href={latestPickLink || '#'}
                  className={`hero-latest group mx-auto md:mx-0 ${latestPickLink ? '' : 'pointer-events-none opacity-80'}`}
                  target={latestPickLink ? '_blank' : undefined}
                  rel={latestPickLink ? 'noopener noreferrer' : undefined}
                >
                  <div className="hero-latest__glow" />
                  <div className="hero-latest__card">
                    <VinylArtwork
                      artworkUrl={latestPick.album_artwork_url}
                      alt={`${latestPick.album} by ${latestPick.artist}`}
                      seed={`hero-${latestPick.id}`}
                    />
                    <div className="hero-latest__info">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latest pick</p>
                      <p className="text-sm font-semibold text-foreground line-clamp-1">
                        {latestPick.album || latestPick.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {latestPick.artist || 'Unknown'}
                      </p>
                    </div>
                    <div className="hero-latest__shine" />
                  </div>
                </a>
              </div>
            )}
          </div>
        </section>


        <section>
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">This Week's Picks</h2>
            <Link href="/feed">
              <button className="text-sm md:text-base text-muted-foreground hover:text-foreground font-semibold transition-colors">
                Show all
              </button>
            </Link>
          </div>
          
          {weeklyPicks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-7xl">
              {weeklyPicks.map((pick) => {
                const userPrefix = pick.user?.face_blob_prefix
                const userFaces = userPrefix ? userFaceImages[userPrefix] : undefined
                
                return (
                  <a 
                    key={pick.id}
                    href={`/link?url=${encodeURIComponent(pick.platform_url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-surface hover:bg-surface-hover p-5 md:p-6 rounded-lg transition-all duration-300 cursor-pointer flex flex-col"
                  >
                    {/* Album artwork - no face tracker here */}
                    <div className="relative mb-5 md:mb-6">
                      <VinylArtwork
                        artworkUrl={pick.album_artwork_url}
                        alt={`${pick.album} by ${pick.artist}`}
                        seed={pick.id}
                      />

                      {!pick.album_artwork_url && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="rounded-full bg-background/80 border border-white/10 shadow-lg p-3">
                            <Music className="w-12 md:w-14 h-12 md:h-14 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                      
                      {/* Play button overlay on hover */}
                      <div className="hidden md:block absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                          <Play className="w-7 h-7 text-black fill-black ml-0.5" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Album info section with face tracker */}
                    <div className="space-y-2 flex-1 relative pb-16">
                      <h3 className="font-semibold text-lg md:text-xl text-foreground line-clamp-2 group-hover:underline">
                        {pick.album}
                      </h3>
                      <p className="text-base md:text-lg text-muted-foreground line-clamp-1">
                        {pick.artist}
                      </p>
                      
                      {/* Face tracker in bottom right of info section */}
                      {userFaces && userPrefix ? (
                        <div className="absolute bottom-0 right-0 w-20 h-20 md:w-24 md:h-24 rounded-full border-3 border-background shadow-xl overflow-hidden">
                          <FaceTracker
                            memberFolder={userPrefix}
                            blobUrls={userFaces}
                            size={256}
                            fallbackBasePath={
                              storageBase ? `${storageBase}/${userPrefix}` : undefined
                            }
                          />
                        </div>
                      ) : (
                        <div className="absolute bottom-0 right-0 w-20 h-20 md:w-24 md:h-24 rounded-full border-3 border-background shadow-xl overflow-hidden bg-surface flex items-center justify-center">
                          <Music className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          ) : (
            <div className="bg-surface rounded-lg p-8 md:p-16 text-center">
              <div className="w-16 md:w-24 h-16 md:h-24 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-4 md:mb-6">
                <Music className="w-8 md:w-12 h-8 md:h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">No picks yet this week</h3>
              <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">Be the first to share an album</p>
              <Link href="/add-pick">
                <button className="bg-primary hover:bg-primary-hover text-black font-bold py-2 md:py-3 px-6 md:px-8 rounded-full transition-all hover:scale-105">
                  Add Pick
                </button>
              </Link>
            </div>
          )}
        </section>
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Recent Picks History</h2>
            <span className="text-xs md:text-sm text-muted-foreground">
              Grouped by theme · {recentByTheme.length} themes · {recentPicks.length} picks
            </span>
          </div>

          {recentPicks.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface/80 shadow-sm p-8 text-center text-muted-foreground">
              No picks found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {recentByTheme.map(({ theme, picks }) => {
                const display = picks.slice(0, 5)
                const center = (display.length - 1) / 2
                const isExpanded = expandedTheme === theme
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setExpandedTheme(isExpanded ? null : theme)}
                    className={`theme-stack-card group relative rounded-xl bg-surface/80 border border-border shadow-md p-5 md:p-6 overflow-hidden text-left transition-all ${
                      isExpanded ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background' : ''
                    }`}
                  >
                    <div className="theme-stack mx-auto">
                      {display.map((pick, index) => {
                        const spread = index - center
                        const cover = pick.album_artwork_url
                        return (
                          <div
                            key={pick.id}
                            className="stack-item"
                            style={{
                              ['--stack-x' as string]: `${spread * 7}px`,
                              ['--stack-y' as string]: `${(display.length - index - 1) * -4}px`,
                              ['--stack-rot' as string]: `${spread * 2}deg`,
                              ['--hover-x' as string]: `${spread * 34}px`,
                              ['--hover-y' as string]: `${spread * -6}px`,
                              ['--hover-rot' as string]: `${spread * 10}deg`,
                              backgroundImage: cover
                                ? `linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25)), url(${cover})`
                                : 'linear-gradient(135deg, #1f2937, #111827)',
                            }}
                            title={pick.album || pick.title || pick.artist || 'Album'}
                          />
                        )
                      })}
                    </div>
                    <div className="theme-chip">
                      <span className="theme-chip__dot" />
                      <div className="theme-chip__text">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Theme</p>
                        <p className="text-sm font-semibold text-foreground">{theme}</p>
                        <p className="text-[11px] text-muted-foreground">{picks.length} picks</p>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="theme-detail">
                        {picks.map((pick) => {
                          const resolvedUrl = `/link?url=${encodeURIComponent(pick.platform_url)}`
                          return (
                            <a
                              key={pick.id}
                              href={resolvedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="theme-detail__item"
                            >
                              <div className="theme-detail__thumb">
                                {pick.album_artwork_url ? (
                                  <img
                                    src={pick.album_artwork_url}
                                    alt={pick.album || pick.title || pick.artist || 'Album'}
                                  />
                                ) : (
                                  <Music className="w-4 h-4 text-muted-foreground" />
                                )}
                                <div className="theme-detail__ring" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {pick.title || pick.album || 'Untitled'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {pick.artist || 'Unknown artist'}
                                </p>
                              </div>
                              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function hashSeed(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) + 1
}

function seededRandom(seed: number, offset = 0) {
  const x = Math.sin(seed + offset) * 10000
  return x - Math.floor(x)
}
