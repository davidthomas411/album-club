import { createClient } from '@/lib/supabase/server'
import { PlaylistCard } from '@/components/playlist-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Music2, Plus, ListMusic } from 'lucide-react'
import Link from 'next/link'

export default async function PlaylistsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

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
            <Music2 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">AlbumClub</h1>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/feed">
              <Button variant="ghost">Feed</Button>
            </Link>
            <Link href="/playlists">
              <Button variant="ghost">Playlists</Button>
            </Link>
            {user ? (
              <Link href="/create-playlist">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Playlist
                </Button>
              </Link>
            ) : (
              <Link href="/auth/login">
                <Button>Sign In</Button>
              </Link>
            )}
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
            {playlistsWithCounts.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-4">
                No playlists yet. Create the first one!
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
        )}
      </div>
    </div>
  )
}
