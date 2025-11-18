import { createClient } from '@/lib/supabase/server'
import { PlaylistCard } from '@/components/playlist-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, ListMusic, ExternalLink } from 'lucide-react'
import { SiteLogo } from '@/components/site-logo'
import Link from 'next/link'

export default async function PlaylistsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const albumPlaylistUrl = 'https://open.spotify.com/playlist/4P2eOkTLUDOdSoBC71PRsP?si=40e5b828d0c54846'
  const singlesPlaylistUrl = 'https://open.spotify.com/playlist/5YM1TTHvtf8Do3ntWHK7ya?si=6456c03a613f4055'
  const featuredPlaylists = [
    {
      title: 'Singles Club Playlist',
      description: 'A living mix of every single shared by the crew.',
      href: singlesPlaylistUrl,
      badge: 'Featured',
    },
    {
      title: 'Album Club Official Playlist',
      description: 'Curated highlights of recent picks. Opens on Spotify and keeps everyone in sync.',
      href: albumPlaylistUrl,
      badge: 'Featured',
    },
  ]

  // Get all playlists with creator info and item counts
  const { data: playlists } = await supabase
    .from('playlists')
    .select(`
      *,
      creator:profiles!created_by(display_name, avatar_url),
      weekly_theme:weekly_themes(theme_name)
    `)
    .order('created_at', { ascending: false })

  // Get playlist item counts
  const playlistsWithCounts = await Promise.all(
    (playlists || []).map(async (playlist) => {
      const { count } = await supabase
        .from('playlist_items')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id)
      
      return { ...playlist, itemCount: count || 0 }
    })
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SiteLogo size={40} className="bg-primary/10 p-1" />
            <h1 className="text-2xl font-bold text-foreground">AlbumClub</h1>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/feed">
              <Button variant="ghost">Feed</Button>
            </Link>
            <Link href="/playlists">
              <Button variant="ghost">Playlists</Button>
            </Link>
            <Link href="/create-playlist">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Playlist
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Community Playlists
          </h2>
          <p className="text-muted-foreground">
            Collaborative collections from weekly picks
          </p>
        </div>

        {playlistsWithCounts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPlaylists.map((playlist) => (
              <a
                key={playlist.title}
                href={playlist.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                <Card className="hover:shadow-lg transition-shadow h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <SiteLogo size={48} className="bg-primary/10 p-1 rounded-lg" />
                      <Badge variant="secondary">{playlist.badge}</Badge>
                    </div>
                    <CardTitle className="text-xl">{playlist.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {playlist.description}
                    </p>
                    <div className="flex items-center justify-between text-sm text-primary font-semibold">
                      Open Playlist
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
            {playlistsWithCounts.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredPlaylists.map((playlist) => (
              <a
                key={playlist.title}
                href={playlist.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                <Card className="hover:shadow-lg transition-shadow h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <SiteLogo size={48} className="bg-primary/10 p-1 rounded-lg" />
                      <Badge variant="secondary">{playlist.badge}</Badge>
                    </div>
                    <CardTitle className="text-xl">{playlist.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {playlist.description}
                    </p>
                    <div className="flex items-center justify-between text-sm text-primary font-semibold">
                      Open Playlist
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
            <Card>
              <CardContent className="p-12 text-center">
                <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground mb-4">
                  No community playlists yet. Create the first one!
                </p>
                {user && (
                  <Link href="/create-playlist">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Playlist
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
