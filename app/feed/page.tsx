import { createClient } from '@/lib/supabase/server'
import { MusicPickCard } from '@/components/music-pick-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music2, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function FeedPage() {
  const supabase = await createClient()
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  // Get current active theme
  const { data: activeTheme } = await supabase
    .from('weekly_themes')
    .select(`
      *,
      curator:profiles(id, display_name, avatar_url)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get all music picks with user info, ordered by most recent
  const { data: musicPicks } = await supabase
    .from('music_picks')
    .select(`
      *,
      user:profiles(id, display_name, avatar_url),
      weekly_theme:weekly_themes(theme_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get picks count for current theme
  const { count: themePicksCount } = await supabase
    .from('music_picks')
    .select('*', { count: 'exact', head: true })
    .eq('weekly_theme_id', activeTheme?.id || '')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
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
              <Link href="/add-pick">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pick
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

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          {/* Main Feed */}
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Music Feed
              </h2>
              <p className="text-muted-foreground">
                Latest picks from the community
              </p>
            </div>

            {musicPicks && musicPicks.length > 0 ? (
              <div className="space-y-4">
                {musicPicks.map((pick) => (
                  <MusicPickCard key={pick.id} pick={pick} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Music2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg text-muted-foreground mb-4">
                    No picks yet. Be the first to share!
                  </p>
                  {user && (
                    <Link href="/add-pick">
                      <Button>Add Your First Pick</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Theme Card */}
            {activeTheme ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    This Week's Theme
                    <Badge>Active</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {activeTheme.curator?.avatar_url ? (
                      <img
                        src={activeTheme.curator.avatar_url || "/placeholder.svg"}
                        alt={activeTheme.curator.display_name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Music2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Curator</p>
                      <p className="font-semibold text-foreground">
                        {activeTheme.curator?.display_name}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {activeTheme.theme_name}
                    </h3>
                    {activeTheme.theme_description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {activeTheme.theme_description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Picks this week</span>
                      <span className="font-bold text-foreground">{themePicksCount || 0}</span>
                    </div>
                  </div>

                  {user && (
                    <Link href="/add-pick">
                      <Button className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your Pick
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Active Theme</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start a new weekly theme to get the community sharing.
                  </p>
                  {user && (
                    <Button className="w-full">Create Theme</Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/playlists">
                  <Button variant="outline" className="w-full justify-start">
                    View Playlists
                  </Button>
                </Link>
                {user && (
                  <>
                    <Link href="/create-theme">
                      <Button variant="outline" className="w-full justify-start">
                        Create New Theme
                      </Button>
                    </Link>
                    <Link href="/profile">
                      <Button variant="outline" className="w-full justify-start">
                        My Profile
                      </Button>
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
