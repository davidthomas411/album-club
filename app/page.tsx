'use client'

import { Sidebar } from '@/components/sidebar'
import { FaceTracker } from '@/components/face-tracker'
import { Music, Play, Menu, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { previousPicks } from '@/lib/previous-picks'

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
  platform_url: string
  platform: string | null
  album_artwork_url: string | null
  weekly_theme_id: string
  user: {
    display_name: string
    face_blob_prefix: string | null
  } | null
}

const CORE_MEMBERS = [
  { id: 'neil', displayName: 'Neil', facePrefix: 'neil' },
  { id: 'ferg', displayName: 'Ferg', facePrefix: 'ferg' },
  { id: 'rory', displayName: 'Rory', facePrefix: 'rory' },
  { id: 'dave', displayName: 'Dave', facePrefix: 'dave' },
] as const

export default function HomePage() {
  const [currentTheme, setCurrentTheme] = useState<WeeklyTheme | null>(null)
  const [weeklyPicks, setWeeklyPicks] = useState<MusicPick[]>([])
  const [userFaceImages, setUserFaceImages] = useState<Record<string, Record<string, string>>>({})
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [previousPickMetadata, setPreviousPickMetadata] = useState<
    Record<string, { title: string; artist: string; albumArtwork: string | null }>
  >({})
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
          curator:curator_id (
            display_name,
            face_images_folder,
            face_blob_prefix
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('[v0] Theme query result:', { data, error })

      if (!error && data) {
        console.log('[v0] Found active theme:', data)
        setCurrentTheme(data)
        
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

  useEffect(() => {
    async function loadPreviousPickMetadata() {
      const uniqueLinks = Array.from(new Set(previousPicks.map((pick) => pick.url)))
      const metadataEntries: Record<string, { title: string; artist: string; albumArtwork: string | null }> = {}

      await Promise.all(
        uniqueLinks.map(async (url) => {
          try {
            const response = await fetch(`/api/fetch-album-metadata?url=${encodeURIComponent(url)}`)
            if (!response.ok) return
            const data = await response.json()
            metadataEntries[url] = {
              title: data.title || "Unknown Album",
              artist: data.artist || "Unknown Artist",
              albumArtwork: data.albumArtwork || null,
            }
          } catch (error) {
            console.error(`[v0] Failed to fetch metadata for ${url}:`, error)
          }
        }),
      )

      setPreviousPickMetadata(metadataEntries)
    }

    loadPreviousPickMetadata()
  }, [])

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
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center">
            <div className="flex justify-center md:justify-start">
              <div className="relative w-36 h-36 md:w-48 md:h-48 rounded-full overflow-hidden border border-white/10 bg-background/70 shadow-2xl">
                <FaceTracker
                  memberFolder={curatorMember.facePrefix}
                  blobUrls={curatorFaceImages}
                  size={256}
                />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-base md:text-lg text-muted-foreground mb-2">This Week's Theme</p>
              <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-3">
                {currentTheme ? currentTheme.theme_name : 'No theme set'}
              </h2>
              {currentTheme?.theme_description ? (
                <p className="text-base md:text-lg text-muted-foreground mb-2">
                  {currentTheme.theme_description}
                </p>
              ) : (
                <p className="text-base md:text-lg text-muted-foreground mb-2">
                  Create a new theme to get the conversation started.
                </p>
              )}
              <p className="text-base md:text-lg text-muted-foreground">
                {currentTheme ? `Curated by ${curatorName}` : `Curated by ${curatorMember.displayName}`}
              </p>
              <div className="mt-4">
                <Link href="/set-theme">
                  <button className="bg-primary hover:bg-primary-hover text-black font-semibold py-3 px-6 md:px-8 rounded-full transition-all text-base whitespace-nowrap">
                    {currentTheme ? 'Set New Theme' : 'Set Theme'}
                  </button>
                </Link>
              </div>
            </div>
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
                    <div className="relative mb-5 md:mb-6 aspect-square overflow-hidden rounded shadow-lg">
                      {pick.album_artwork_url ? (
                        <img 
                          src={pick.album_artwork_url || "/placeholder.svg"} 
                          alt={`${pick.album} by ${pick.artist}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface-hover flex items-center justify-center">
                          <Music className="w-16 md:w-20 h-16 md:h-20 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Play button overlay on hover */}
                      <div className="hidden md:block absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
              Showing latest {previousPicks.length} entries from spotify_links.md
            </span>
          </div>
          <div className="rounded-xl border border-border bg-surface/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[780px] w-full text-sm">
                <thead className="bg-surface-hover/80 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-center font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Track</th>
                    <th className="px-4 py-2 text-left font-medium">Theme</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Picker</th>
                    <th className="px-4 py-2 text-right font-medium">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {previousPicks
                    .slice()
                    .sort(
                      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((pick, index) => {
                      const metadata = previousPickMetadata[pick.url]
                      const resolvedUrl = `/link?url=${encodeURIComponent(pick.url)}`
                      return (
                        <tr
                          key={`${pick.date}-${index}`}
                          className={`${index % 2 === 0 ? 'bg-transparent' : 'bg-surface-hover/40'} hover:bg-surface-hover/70 transition-colors`}
                        >
                          <td className="px-4 py-2 text-center text-muted-foreground text-xs">{index + 1}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-sm bg-surface-hover flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                                {metadata?.albumArtwork ? (
                                  <img src={metadata.albumArtwork} alt={metadata.title} className="w-full h-full object-cover" />
                                ) : (
                                  <Music className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate">
                                  {metadata?.title || "Album information loading..."}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{metadata?.artist || 'Unknown artist'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-xs text-muted-foreground italic">Not tracked</span>
                          </td>
                          <td className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{pick.date}</td>
                          <td className="px-4 py-2 text-xs font-semibold text-primary truncate">{pick.person}</td>
                          <td className="px-4 py-2 text-right">
                            <a
                              href={resolvedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-xs text-primary font-semibold"
                            >
                              Open
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
