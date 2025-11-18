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

export default function HomePage() {
  const [currentTheme, setCurrentTheme] = useState<WeeklyTheme | null>(null)
  const [weeklyPicks, setWeeklyPicks] = useState<MusicPick[]>([])
  const [blobUrls, setBlobUrls] = useState<Record<string, string> | undefined>(undefined)
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
    async function fetchFaceImages() {
      try {
        const response = await fetch('/api/get-face-images?member=dave')
        const data = await response.json()
        if (data.images) {
          setBlobUrls(data.images)
        }
      } catch (error) {
        console.error('[v0] Error fetching face images:', error)
      }
    }

    fetchFaceImages()
  }, [])

  useEffect(() => {
    async function fetchAllUserFaceImages() {
      const uniqueUsers = new Set(
        weeklyPicks
          .map(pick => pick.user?.face_blob_prefix)
          .filter(Boolean) as string[]
      )
      
      const faceImagesMap: Record<string, Record<string, string>> = {}
      
      for (const userPrefix of uniqueUsers) {
        try {
          const response = await fetch(`/api/get-face-images?member=${userPrefix}`)
          const data = await response.json()
          if (data.images) {
            faceImagesMap[userPrefix] = data.images
          }
        } catch (error) {
          console.error(`[v0] Error fetching face images for ${userPrefix}:`, error)
        }
      }
      
      setUserFaceImages(faceImagesMap)
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

  const curatorFolder = currentTheme?.curator?.face_images_folder || 'curator'
  const curatorName = currentTheme?.curator?.display_name || 'Curator'

  return (
    <div className="flex min-h-screen bg-background">
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

        {currentTheme ? (
          <section className="mb-8 md:mb-12 bg-gradient-to-r from-primary/20 to-primary/5 rounded-lg p-8 md:p-12 relative overflow-hidden">
            <div className="flex items-center gap-6 md:gap-8 relative z-10">
              {currentTheme.curator && blobUrls && (
                <div className="relative w-32 h-32 md:w-48 md:h-48 flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-background/30 to-background rounded-full z-10 pointer-events-none" />
                  <FaceTracker
                    memberFolder={currentTheme.curator.face_blob_prefix || 'dave'}
                    blobUrls={blobUrls}
                    size={256}
                  />
                </div>
              )}
              
              <div className="flex-1">
                <p className="text-base md:text-lg text-muted-foreground mb-2">This Week's Theme</p>
                <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-3">{currentTheme.theme_name}</h2>
                {currentTheme.theme_description && (
                  <p className="text-base md:text-lg text-muted-foreground mb-2">{currentTheme.theme_description}</p>
                )}
                <p className="text-base md:text-lg text-muted-foreground">Curated by {curatorName}</p>
              </div>
              <Link href="/set-theme">
                <button className="bg-primary hover:bg-primary-hover text-black font-semibold py-3 px-6 md:px-8 rounded-full transition-all text-base whitespace-nowrap">
                  Set New
                </button>
              </Link>
            </div>
          </section>
        ) : (
          <section className="mb-6 md:mb-8 bg-gradient-to-r from-muted/20 to-muted/5 rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs md:text-sm text-muted-foreground mb-1">This Week's Theme</p>
                <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-1">No theme set</h2>
                <p className="text-xs md:text-sm text-muted-foreground">Create the first weekly theme</p>
              </div>
              <Link href="/set-theme">
                <button className="bg-primary hover:bg-primary-hover text-black font-semibold py-2 px-4 md:px-6 rounded-full transition-all text-sm md:text-base whitespace-nowrap">
                  Set Theme
                </button>
              </Link>
            </div>
          </section>
        )}

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
                    href={pick.platform_url}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {previousPicks
              .slice()
              .sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
              )
              .map((pick, index) => {
                const metadata = previousPickMetadata[pick.url]
                return (
                  <a
                    key={`${pick.date}-${index}`}
                    href={pick.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border bg-surface p-3 shadow-sm transition hover:shadow-md hover:border-primary flex flex-col gap-3 sm:flex-row sm:gap-4"
                  >
                    <div className="w-full sm:w-16 h-32 sm:h-16 rounded-md bg-surface-hover flex items-center justify-center overflow-hidden">
                      {metadata?.albumArtwork ? (
                        <img src={metadata.albumArtwork} alt={metadata.title} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{pick.date}</div>
                      <p className="text-sm font-semibold text-foreground leading-tight mt-1">
                        {metadata?.title || "Album information loading..."}
                      </p>
                      <p className="text-xs text-muted-foreground">{metadata?.artist}</p>
                    <p className="text-sm font-semibold text-primary mt-1">{pick.person}</p>
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-primary">
                        Open link
                        <ExternalLink className="h-4 w-4" />
                      </div>
                    </div>
                  </a>
                )
              })}
          </div>
        </section>
      </main>
    </div>
  )
}
