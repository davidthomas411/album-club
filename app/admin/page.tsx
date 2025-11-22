'use client'

"use client"

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, RefreshCw, Home, Upload, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  weekly_theme: { id?: string; theme_name: string; week_start_date?: string | null } | null
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
  const [editingPickId, setEditingPickId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<MusicPick>>({})
  const supabase = createBrowserClient()

  async function fetchData() {
    setLoading(true)
    
    // Fetch music picks
    const { data: picksData } = await supabase
      .from('music_picks')
      .select(`
        *,
        user:user_id(display_name),
        weekly_theme:weekly_theme_id(id, theme_name, week_start_date)
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

  function startEditPick(pick: MusicPick) {
    setEditingPickId(pick.id)
    setEditData({
      artist: pick.artist,
      album: pick.album,
      title: pick.album,
      platform: pick.platform,
      platform_url: pick.platform_url,
      weekly_theme_id: pick.weekly_theme?.id as any,
    })
  }

  function cancelEdit() {
    setEditingPickId(null)
    setEditData({})
  }

  async function savePick() {
    if (!editingPickId) return
    const payload: any = {
      artist: editData.artist,
      album: editData.album,
      title: editData.title || editData.album,
      platform: editData.platform,
      platform_url: editData.platform_url,
      weekly_theme_id: editData.weekly_theme_id || null,
    }
    const { error } = await supabase
      .from('music_picks')
      .update(payload)
      .eq('id', editingPickId)

    if (error) {
      alert(error.message)
      return
    }
    setEditingPickId(null)
    setEditData({})
    fetchData()
  }

  async function deleteTheme(id: string) {
    if (!id) {
      alert('Missing theme id')
      return
    }
    if (!confirm('Are you sure you want to delete this theme?')) return
    
    try {
      const response = await fetch(`/api/admin/themes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (!response.ok) {
        console.error('[v0] Error deleting theme:', payload)
        alert(payload?.error || 'Failed to delete theme')
        return
      }
      fetchData()
    } catch (error) {
      console.error('[v0] Error deleting theme:', error)
      alert('Unexpected error deleting theme')
    }
  }

  async function setActiveTheme(id: string) {
    if (!confirm('Set this theme as active? This will deactivate others.')) return
    try {
      const response = await fetch('/api/admin/set-active-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: id }),
      })
      const payload = await response.json()
      if (!response.ok) {
        console.error('[v0] Error setting active theme:', payload)
        alert(payload?.error || 'Failed to set active theme')
        return
      }
      fetchData()
    } catch (error) {
      console.error('[v0] Error setting active theme:', error)
      alert('Unexpected error setting active theme')
    }
  }

  async function setActiveTheme(id: string) {
    if (!confirm('Set this theme as active? This will deactivate others.')) return
    try {
      const response = await fetch('/api/admin/set-active-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: id }),
      })
      const payload = await response.json()
      if (!response.ok) {
        console.error('[v0] Error setting active theme:', payload)
        alert(payload?.error || 'Failed to set active theme')
        return
      }
      fetchData()
    } catch (error) {
      console.error('[v0] Error setting active theme:', error)
      alert('Unexpected error setting active theme')
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
            <Link href="/admin/upload-faces">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload Faces
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
                    {editingPickId === pick.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Artist</Label>
                            <Input
                              value={editData.artist || ''}
                              onChange={(e) => setEditData((prev) => ({ ...prev, artist: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Album/Title</Label>
                            <Input
                              value={editData.album || ''}
                              onChange={(e) =>
                                setEditData((prev) => ({ ...prev, album: e.target.value, title: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Platform URL</Label>
                            <Input
                              value={editData.platform_url || ''}
                              onChange={(e) => setEditData((prev) => ({ ...prev, platform_url: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Platform</Label>
                            <Select
                              value={editData.platform || undefined}
                              onValueChange={(value) => setEditData((prev) => ({ ...prev, platform: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['spotify','tidal','apple_music','youtube_music','soundcloud','deezer','bandcamp','other'].map((p) => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Theme</Label>
                            <Select
                              value={editData.weekly_theme_id as string | undefined}
                              onValueChange={(value) => setEditData((prev) => ({ ...prev, weekly_theme_id: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {themes.map((theme) => (
                                  <SelectItem key={theme.id} value={theme.id}>
                                    {theme.theme_name} {theme.week_start_date ? `(${new Date(theme.week_start_date).toLocaleDateString()})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={cancelEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={savePick}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
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
                            onClick={() => startEditPick(pick)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deletePick(pick.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
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
                        <Link href={`/set-theme?themeId=${theme.id}`}>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant={theme.is_active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setActiveTheme(theme.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {theme.is_active ? 'Active' : 'Set Active'}
                        </Button>
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
