import { createClient } from '@/lib/supabase/server'
import { SiteLogo } from '@/components/site-logo'
import Link from 'next/link'
import { GenrePopularityList } from '@/components/genre-popularity-list'

const PLAYLIST_ID = '7beGL2PIiYMXSsiVUdNIP3'
const RECENT_DAYS = 14

type PickRow = {
  id: string
  title: string | null
  album: string | null
  artist: string | null
  album_artwork_url: string | null
  platform_url: string
  album_genres: string[] | null
  artist_genres: string[] | null
  album_release_year: number | null
  created_at: string | null
  album_artwork_url: string | null
  user: { display_name: string | null } | null
}

export const dynamic = 'force-dynamic'

const albumIdFromUrl = (url?: string | null) => {
  if (!url) return null
  const m = url.match(/album\/([A-Za-z0-9]{16,24})/)
  return m ? m[1] : null
}

function isAlbumUrl(url?: string | null) {
  if (!url) return false
  const u = url.toLowerCase()
  const isTrack =
    u.includes('/track/') ||
    u.includes('spotify:track') ||
    u.includes('/song/') ||
    u.includes('/single/')
  if (isTrack) return false
  const isAlbum =
    u.includes('/album/') ||
    u.includes('album?') ||
    u.includes('album=')
  return isAlbum
}

async function getSpotifyToken() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) return null
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.access_token as string
}

async function fetchPlaylistAlbumIds(): Promise<Set<string>> {
  const token = await getSpotifyToken()
  if (!token) return new Set()
  const ids: Set<string> = new Set()
  let url: string | null = `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks?limit=100`
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!res.ok) break
    const json = await res.json()
    for (const item of json.items || []) {
      const aid = item.track?.album?.id
      if (aid) ids.add(aid)
    }
    url = json.next
  }
  return ids
}

export default async function MusicMapPage() {
  const supabase = await createClient()
  const playlistAlbumIds = await fetchPlaylistAlbumIds()
  const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
  const pageSize = 1000
  let data: any[] = []
  for (let offset = 0; offset < 6000; offset += pageSize) {
    const { data: chunk, error } = await supabase
      .from('music_picks')
      .select(
        `
        id,
        title,
        album,
        artist,
        album_artwork_url,
        platform_url,
        album_genres,
        artist_genres,
        album_release_year,
        created_at,
        user:user_id(display_name),
        album_artwork_url
      `,
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) break
    if (!chunk || chunk.length === 0) break
    data = data.concat(chunk)
    if (chunk.length < pageSize) break
  }

  const picks =
    data
      ?.filter((row) => isAlbumUrl(row.platform_url))
      .map((row) => {
        const primaryGenre =
          (row.album_genres && row.album_genres[0]) ||
          (row.artist_genres && row.artist_genres[0]) ||
          'Unknown'
        const genres =
          (row.album_genres && row.album_genres.length ? row.album_genres : []) ||
          (row.artist_genres && row.artist_genres.length ? row.artist_genres : []) ||
          []
        const year =
          row.album_release_year ||
          (row.created_at ? new Date(row.created_at).getFullYear() : null)
        return {
          id: row.id,
          title: row.album || row.title || 'Untitled',
          artist: row.artist || 'Unknown artist',
          genre: primaryGenre,
          genres,
          artwork: row.album_artwork_url,
          picker: row.user?.display_name || undefined,
          platformUrl: row.platform_url,
          year,
          createdAt: row.created_at || undefined,
        }
      })
      .filter((p) => {
        const albumId = albumIdFromUrl(p.platformUrl)
        const isRecent = p.createdAt ? new Date(p.createdAt).getTime() >= recentCutoff : false
        if (isRecent) return true
        if (!albumId) return false
        // If playlist fetch failed, show recent only
        if (playlistAlbumIds.size === 0) return false
        return playlistAlbumIds.has(albumId)
      }) || []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SiteLogo size={40} className="bg-primary/10 p-1" />
            <h1 className="text-2xl font-bold text-foreground">AlbumClub</h1>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/feed" className="text-muted-foreground hover:text-foreground transition-colors">
              Feed
            </Link>
            <Link href="/playlists" className="text-muted-foreground hover:text-foreground transition-colors">
              Playlist
            </Link>
            <span className="text-foreground font-semibold">Genre Playlists</span>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-foreground">Genre Playlists</h2>
        </div>

        <GenrePopularityList picks={picks} />
      </div>
    </div>
  )
}
