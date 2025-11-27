import { createClient } from '@/lib/supabase/server'
import { SiteLogo } from '@/components/site-logo'
import Link from 'next/link'
import { GenrePopularityList } from '@/components/genre-popularity-list'

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

export default async function MusicMapPage() {
  const supabase = await createClient()
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
