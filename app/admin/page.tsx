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
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importThemeId, setImportThemeId] = useState<string | null>(null)
  const [importDaysBack, setImportDaysBack] = useState('30')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
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
      .order('week_start_date', { ascending: false, nullsLast: true })
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

  async function handleImport() {
    if (!importFile) {
      alert('Please choose a chat .txt file')
      return
    }
    setIsImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      if (importThemeId) formData.append('themeId', importThemeId)
      formData.append('daysBack', importDaysBack || '10')

      const res = await fetch('/api/admin/import-whatsapp', {
        method: 'POST',
        body: formData,
      })
      const payload = await res.json()
      if (!res.ok) {
        setImportResult(payload?.error || 'Import failed')
      } else {
        const debug =
          payload?.debug &&
          ` Debug -> lines:${payload.debug.totalLines}, parsed:${payload.debug.parsedLines}, withinCutoff:${payload.debug.withinCutoffLines}, links:${payload.debug.linksFound}, unique:${payload.debug.uniqueCountBeforeInsert}, sample:${(payload.debug.sampleLinks || []).join(', ')}, users:${(payload.debug.resolvedUsers || []).join(' | ')}, missingEmails:${(payload.debug.missingEmails || []).join(' | ')}, missingAuth:${(payload.debug.missingAuthUsers || []).join(' | ')}, unmatched:${(payload.debug.unmatchedSenders || []).join(' | ')}, profileFail:${(payload.debug.profileInsertFailures || []).join(' | ')}, traces:${(payload.debug.mappingTraces || payload.mappingTraces || []).join(' || ')}`.trim()
        const summary = `Found ${payload.found}, inserted ${payload.inserted}${
          payload.errors?.length ? `. Errors: ${payload.errors.join('; ')}` : ''
        }${debug ? `.${debug}` : ''}`
        setImportResult(summary)
        fetchData()
      }
    } catch (error: any) {
      setImportResult(error?.message || 'Unexpected error')
    } finally {
      setIsImporting(false)
    }
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
          <CardContent className="overflow-x-auto">
            {picks.length === 0 ? (
              <p className="text-muted-foreground">No picks in database</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3">Artist / Album</th>
                    <th className="text-left py-2 pr-3">User</th>
                    <th className="text-left py-2 pr-3">Theme</th>
                    <th className="text-left py-2 pr-3">Platform</th>
                    <th className="text-left py-2 pr-3">Link</th>
                    <th className="text-left py-2 pr-3">Created</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick) => {
                    const isEditing = editingPickId === pick.id
                    return (
                      <tr key={pick.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 align-top">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editData.artist || ''}
                                onChange={(e) => setEditData((prev) => ({ ...prev, artist: e.target.value }))}
                                placeholder="Artist"
                                className="h-9"
                              />
                              <Input
                                value={editData.album || ''}
                                onChange={(e) =>
                                  setEditData((prev) => ({ ...prev, album: e.target.value, title: e.target.value }))
                                }
                                placeholder="Album"
                                className="h-9"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground">{pick.artist}</div>
                              <div className="text-muted-foreground">{pick.album}</div>
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          {pick.user?.display_name || 'Unknown'}
                        </td>
                        <td className="py-2 pr-3 align-top min-w-[160px]">
                          {isEditing ? (
                            <Select
                              value={editData.weekly_theme_id as string | undefined}
                              onValueChange={(value) => setEditData((prev) => ({ ...prev, weekly_theme_id: value }))}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Theme" />
                              </SelectTrigger>
                              <SelectContent>
                                {themes.map((theme) => (
                                  <SelectItem key={theme.id} value={theme.id}>
                                    {theme.theme_name} {theme.week_start_date ? `(${new Date(theme.week_start_date).toLocaleDateString()})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            pick.weekly_theme?.theme_name || 'No theme'
                          )}
                        </td>
                        <td className="py-2 pr-3 align-top min-w-[120px]">
                          {isEditing ? (
                            <Select
                              value={editData.platform || undefined}
                              onValueChange={(value) => setEditData((prev) => ({ ...prev, platform: value }))}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Platform" />
                              </SelectTrigger>
                              <SelectContent>
                                {['spotify','tidal','apple_music','youtube_music','soundcloud','deezer','bandcamp','other'].map((p) => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{pick.platform || 'n/a'}</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3 align-top max-w-[220px]">
                          {isEditing ? (
                            <Input
                              value={editData.platform_url || ''}
                              onChange={(e) => setEditData((prev) => ({ ...prev, platform_url: e.target.value }))}
                              placeholder="https://"
                              className="h-9"
                            />
                          ) : (
                            <a href={pick.platform_url} target="_blank" className="text-primary hover:underline break-all">
                              {pick.platform_url}
                            </a>
                          )}
                        </td>
                        <td className="py-2 pr-3 align-top whitespace-nowrap">
                          {new Date(pick.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 align-top text-right space-x-2">
                          {isEditing ? (
                            <>
                              <Button variant="outline" size="sm" onClick={cancelEdit}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={savePick}>
                                Save
                              </Button>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Import */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Import from WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Chat export (.txt)</Label>
                <Input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Theme (optional)</Label>
                <Select
                  value={importThemeId || undefined}
                  onValueChange={(value) => setImportThemeId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((theme) => (
                      <SelectItem key={theme.id} value={theme.id}>
                        {theme.theme_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Days back</Label>
                <Input
                  type="number"
                  min="0"
                  value={importDaysBack}
                  onChange={(e) => setImportDaysBack(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Default 30 days. Set 0 to scan all.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={isImporting || !importFile}>
                {isImporting ? 'Importing...' : 'Import Chat'}
              </Button>
              {importResult && (
                <p className="text-sm text-muted-foreground">{importResult}</p>
              )}
            </div>
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
