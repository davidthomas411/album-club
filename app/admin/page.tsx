'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

interface MusicPick {
  id: string
  artist: string
  album: string
  platform_url: string
  platform: string | null
  notes: string | null
  created_at: string
  album_artwork_url: string | null
  user: { display_name: string } | null
  weekly_theme: { theme_name: string } | null
}

interface WeeklyTheme {
  id: string
  theme_name: string
  theme_description: string | null
  is_active: boolean
  week_start_date: string
  week_end_date: string
  curator: { display_name: string } | null
}

export default function AdminPage() {
  const [picks, setPicks] = useState<MusicPick[]>([])
  const [themes, setThemes] = useState<WeeklyTheme[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  async function fetchData() {
    setLoading(true)
    
    // Fetch music picks
    const { data: picksData } = await supabase
      .from('music_picks')
      .select(`
        *,
        user:user_id(display_name),
        weekly_theme:weekly_theme_id(theme_name)
      `)
      .order('created_at', { ascending: false })

    // Fetch weekly themes
    const { data: themesData } = await supabase
      .from('weekly_themes')
      .select(`
        *,
        curator:curator_id(display_name)
      `)
      .order('created_at', { ascending: false })

    setPicks(picksData || [])
    setThemes(themesData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function deletePick(id: string) {
    if (!confirm('Are you sure you want to delete this pick?')) return
    
    const { error } = await supabase
      .from('music_picks')
      .delete()
      .eq('id', id)

    if (!error) {
      fetchData()
    }
  }

  async function deleteTheme(id: string) {
    if (!confirm('Are you sure you want to delete this theme?')) return
    
    console.log('[v0] Attempting to delete theme:', id)
    const { error } = await supabase
      .from('weekly_themes')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[v0] Error deleting theme:', error)
      alert(`Failed to delete theme: ${error.message}`)
    } else {
      console.log('[v0] Theme deleted successfully')
      fetchData()
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Database Inspector</h1>
            <p className="text-muted-foreground">View and manage all database entries</p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" size="sm">
                Users
              </Button>
            </Link>
            <Button onClick={fetchData} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Music Picks Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Music Picks ({picks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {picks.length === 0 ? (
              <p className="text-muted-foreground">No picks in database</p>
            ) : (
              <div className="space-y-4">
                {picks.map((pick) => (
                  <div key={pick.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      {pick.album_artwork_url && (
                        <img 
                          src={pick.album_artwork_url || "/placeholder.svg"} 
                          alt={`${pick.album} by ${pick.artist}`}
                          className="w-16 h-16 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-foreground">{pick.artist} - {pick.album}</h3>
                          {pick.platform && (
                            <Badge variant="outline">{pick.platform}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>User:</strong> {pick.user?.display_name || 'Unknown'}</p>
                          <p><strong>Theme:</strong> {pick.weekly_theme?.theme_name || 'No theme'}</p>
                          <p><strong>Link:</strong> <a href={pick.platform_url} target="_blank" className="text-primary hover:underline">{pick.platform_url}</a></p>
                          {pick.notes && <p><strong>Notes:</strong> {pick.notes}</p>}
                          <p><strong>Created:</strong> {new Date(pick.created_at).toLocaleString()}</p>
                          <p className="text-xs opacity-70"><strong>ID:</strong> {pick.id}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePick(pick.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Themes Section */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Themes ({themes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {themes.length === 0 ? (
              <p className="text-muted-foreground">No themes in database</p>
            ) : (
              <div className="space-y-4">
                {themes.map((theme) => (
                  <div key={theme.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-foreground">{theme.theme_name}</h3>
                          {theme.is_active && (
                            <Badge className="bg-primary text-black">Active</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Curator:</strong> {theme.curator?.display_name || 'Unknown'}</p>
                          {theme.theme_description && (
                            <p><strong>Description:</strong> {theme.theme_description}</p>
                          )}
                          <p><strong>Period:</strong> {new Date(theme.week_start_date).toLocaleDateString()} - {new Date(theme.week_end_date).toLocaleDateString()}</p>
                          <p className="text-xs opacity-70"><strong>ID:</strong> {theme.id}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTheme(theme.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
