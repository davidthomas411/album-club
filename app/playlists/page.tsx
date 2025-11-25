import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { SiteLogo } from '@/components/site-logo'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

type PickRow = {
  id: string
  album: string | null
  artist: string | null
  title: string | null
  platform: string | null
  platform_url: string
  album_artwork_url: string | null
  created_at: string
  album_label?: string | null
  album_release_date?: string | null
  album_release_year?: number | null
  album_popularity?: number | null
  album_total_tracks?: number | null
  album_markets_count?: number | null
  album_genres?: string[] | null
  artist_genres?: string[] | null
  user: { display_name: string } | null
  weekly_theme: { theme_name: string | null } | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function PlaylistsPage() {
  const supabase = await createClient()

  const { data: picks } = await supabase
    .from('music_picks')
    .select(`
      id,
      album,
      artist,
      title,
      platform,
      platform_url,
      album_artwork_url,
      created_at,
      album_label,
      album_release_date,
      album_release_year,
      album_popularity,
      album_total_tracks,
      album_markets_count,
      album_genres,
      artist_genres,
      user:user_id(display_name),
      weekly_theme:weekly_theme_id(theme_name)
    `)
    .order('created_at', { ascending: false })

  const rows: PickRow[] = picks || []

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toISOString().slice(0, 10)
    } catch {
      return '—'
    }
  }

  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SiteLogo size={40} className="bg-primary/10 p-1" />
            <h1 className="text-2xl font-bold text-foreground">AlbumClub</h1>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/feed" className="text-muted-foreground hover:text-foreground transition-colors">Feed</Link>
            <Link href="/playlists" className="text-foreground font-semibold">Playlist</Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-foreground">Album Club Playlist</h2>
          <p className="text-muted-foreground">
            The full catalogue of picks. Filterable, sortable, and ready for deeper stats.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Album</th>
                <th className="px-4 py-3 text-left font-semibold">Artist</th>
                <th className="px-4 py-3 text-left font-semibold">Picker</th>
                <th className="px-4 py-3 text-left font-semibold">Theme</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Platform</th>
                <th className="px-4 py-3 text-left font-semibold">Label</th>
                <th className="px-4 py-3 text-left font-semibold">Year</th>
                <th className="px-4 py-3 text-left font-semibold">Genres</th>
                <th className="px-4 py-3 text-left font-semibold">Popularity</th>
                <th className="px-4 py-3 text-left font-semibold">Tracks</th>
                <th className="px-4 py-3 text-left font-semibold">Origin</th>
                <th className="px-4 py-3 text-left font-semibold">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pick) => {
                const albumTitle = pick.album || pick.title || 'Untitled'
                const artist = pick.artist || 'Unknown artist'
                const picker = pick.user?.display_name || 'Unknown'
                const theme = pick.weekly_theme?.theme_name || 'No theme'
                const date = pick.created_at ? formatDate(pick.created_at) : '—'
                const platform = pick.platform || 'other'
                const label = pick.album_label || '—'
                const releaseYear =
                  pick.album_release_year ||
                  (pick.album_release_date ? new Date(pick.album_release_date).getFullYear() : null) ||
                  '—'
                const genres = pick.album_genres?.length
                  ? pick.album_genres.join(', ')
                  : pick.artist_genres?.slice(0, 3).join(', ') || '—'
                const popularity = pick.album_popularity ?? '—'
                const tracks = pick.album_total_tracks ?? '—'
                const origin = pick.artist_genres?.length ? pick.artist_genres[0] : '—'
                return (
                  <tr key={pick.id} className="border-t border-border/70 hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {pick.album_artwork_url ? (
                          <img
                            src={pick.album_artwork_url}
                            alt={albumTitle}
                            className="w-12 h-12 rounded-md object-cover border border-border/60"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md border border-border/60 bg-muted/40" />
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{albumTitle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{artist}</td>
                    <td className="px-4 py-3 text-foreground">{picker}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{theme}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{date}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize">
                        {platform}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{label}</td>
                    <td className="px-4 py-3 text-muted-foreground">{releaseYear}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[220px] truncate">{genres}</td>
                    <td className="px-4 py-3 text-muted-foreground">{popularity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{tracks}</td>
                    <td className="px-4 py-3 text-muted-foreground">{origin}</td>
                    <td className="px-4 py-3">
                      <a
                        href={pick.platform_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Open <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Stats columns (Label, Producer, Origin) are placeholders. We can enrich these with Spotify API data next to power queries like “Ferg picks female American artists 23% of the time.”
        </div>
      </div>
    </div>
  )
}
