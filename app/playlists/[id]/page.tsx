import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music2, Users, ExternalLink, Plus } from 'lucide-react'
import Link from 'next/link'
import { AddToPlaylistButton } from '@/components/add-to-playlist-button'

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  // Get playlist details
  const { data: playlist } = await supabase
    .from('playlists')
    .select(`
      *,
      creator:profiles!created_by(display_name, avatar_url),
      weekly_theme:weekly_themes(theme_name)
    `)
    .eq('id', id)
    .single()

  if (!playlist) {
    redirect('/playlists')
  }

  // Get playlist items with pick details
  const { data: playlistItems } = await supabase
    .from('playlist_items')
    .select(`
      *,
      music_pick:music_picks(
        *,
        user:profiles(display_name, avatar_url)
      ),
      added_by_user:profiles!added_by(display_name)
    `)
    .eq('playlist_id', id)
    .order('position', { ascending: true })

  // Get available picks to add (if collaborative or user is creator)
  const canEdit = user && (playlist.is_collaborative || playlist.created_by === user.id)
  
  let availablePicks = null
  if (canEdit && user) {
    const { data } = await supabase
      .from('music_picks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    
    availablePicks = data
  }

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
            <Link href="/playlists">
              <Button variant="ghost">Back to Playlists</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Playlist Header */}
        <div className="mb-8">
          <div className="flex items-start gap-6 mb-6">
            <div className="h-24 w-24 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Music2 className="h-12 w-12 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-4xl font-bold text-foreground">
                  {playlist.name}
                </h2>
                {playlist.is_collaborative && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Collaborative
                  </Badge>
                )}
              </div>
              {playlist.description && (
                <p className="text-lg text-muted-foreground mb-4">
                  {playlist.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {playlist.creator && (
                  <span>Created by {playlist.creator.display_name}</span>
                )}
                {playlist.weekly_theme && (
                  <Badge variant="outline">{playlist.weekly_theme.theme_name}</Badge>
                )}
                <span>{playlistItems?.length || 0} tracks</span>
              </div>
            </div>
          </div>

          {canEdit && availablePicks && (
            <AddToPlaylistButton 
              playlistId={id} 
              userId={user.id}
              availablePicks={availablePicks}
            />
          )}
        </div>

        {/* Playlist Items */}
        {playlistItems && playlistItems.length > 0 ? (
          <div className="space-y-2">
            {playlistItems.map((item, index) => {
              const pick = item.music_pick
              if (!pick) return null

              return (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground font-mono text-sm w-8">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {pick.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {pick.artist}
                          {pick.album && ` • ${pick.album}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {pick.platform}
                        </Badge>
                          <a
                            href={`/link/${pick.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Music2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">
                No tracks in this playlist yet
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
