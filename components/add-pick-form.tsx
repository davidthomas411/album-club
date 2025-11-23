"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

interface Member {
  id: string
  display_name: string
}

interface Theme {
  id: string
  theme_name: string
  week_start_date?: string | null
  is_active?: boolean | null
}

interface AddPickFormProps {
  members: Member[]
  themes?: Theme[]
}

const platforms = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'soundcloud', label: 'SoundCloud' },
  { value: 'tidal', label: 'Tidal' },
  { value: 'bandcamp', label: 'Bandcamp' },
  { value: 'other', label: 'Other' },
]

export function AddPickForm({ members, themes = [] }: AddPickFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null)
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    platform: 'spotify',
    platform_url: '',
    member_id: members[0]?.id || '',
    album_artwork_url: '',
  })

  useEffect(() => {
    if (members.length > 0 && !members.find((m) => m.id === formData.member_id)) {
      setFormData((prev) => ({ ...prev, member_id: members[0].id }))
    }
  }, [members, formData.member_id])

  useEffect(() => {
    if (themes.length > 0) {
      const active = themes.find((t) => t.is_active)
      setCurrentThemeId(active?.id || themes[0].id)
    }
  }, [themes])

  const fetchMetadataFromUrl = async (url: string) => {
    if (!url || url.length < 10) return

    setIsFetchingMetadata(true)
    try {
      const response = await fetch(`/api/fetch-album-metadata?url=${encodeURIComponent(url)}`)
      if (response.ok) {
        const data = await response.json()
        const decodeHTML = (text: string) => {
          const textarea = document.createElement('textarea')
          textarea.innerHTML = text
          return textarea.value
        }
        
        setFormData(prev => ({
          ...prev,
          title: data.title ? decodeHTML(data.title) : prev.title,
          artist: data.artist ? decodeHTML(data.artist) : prev.artist,
          platform: data.platform || prev.platform,
          album_artwork_url: data.albumArtwork || prev.album_artwork_url,
        }))
      }
    } catch (err) {
      console.error('[v0] Failed to fetch metadata:', err)
    } finally {
      setIsFetchingMetadata(false)
    }
  }

  useEffect(() => {
    if (formData.platform_url) {
      const timer = setTimeout(() => {
        fetchMetadataFromUrl(formData.platform_url)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [formData.platform_url])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentThemeId) {
      setError('Please choose a theme before adding a pick.')
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      console.log('[v0] Submitting pick with theme ID:', currentThemeId)
      console.log('[v0] Full submission data:', {
        user_id: formData.member_id,
        title: formData.title,
        album: formData.title,
        artist: formData.artist,
        platform: formData.platform,
        platform_url: formData.platform_url,
        pick_type: 'album',
        weekly_theme_id: currentThemeId,
        album_artwork_url: formData.album_artwork_url || null,
      })

      const { data, error: insertError } = await supabase
        .from('music_picks')
        .insert({
          user_id: formData.member_id,
          title: formData.title,
          album: formData.title,
          artist: formData.artist,
          platform: formData.platform,
          platform_url: formData.platform_url,
          pick_type: 'album',
          weekly_theme_id: currentThemeId,
          album_artwork_url: formData.album_artwork_url || null,
        })
        .select()

      console.log('[v0] Insert result:', { data, error: insertError })

      if (insertError) {
        console.error('[v0] Database insert error:', insertError)
        throw insertError
      }

      console.log('[v0] Pick added successfully, redirecting to home')
      window.location.href = '/'
    } catch (err) {
      console.error('[v0] Submission error:', err)
      setError(err instanceof Error ? err.message : 'Failed to add pick')
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Album</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Platform URL */}
          <div className="space-y-2">
            <Label htmlFor="platform_url">
              Album Link * {isFetchingMetadata && <span className="text-sm text-muted-foreground">(fetching info...)</span>}
            </Label>
            <Input
              id="platform_url"
              type="url"
              required
              value={formData.platform_url}
              onChange={(e) => setFormData({ ...formData, platform_url: e.target.value })}
              placeholder="Paste your album link here..."
            />
          </div>

          {formData.album_artwork_url && (
            <div className="space-y-2">
              <Label>Album Artwork Preview</Label>
              <img 
                src={formData.album_artwork_url || "/placeholder.svg"} 
                alt="Album artwork" 
                className="w-32 h-32 rounded shadow-lg object-cover"
              />
            </div>
          )}

          {/* Theme Picker */}
          <div className="space-y-2">
            <Label htmlFor="theme">Theme *</Label>
            <Select
              value={currentThemeId || undefined}
              onValueChange={(value) => setCurrentThemeId(value)}
              disabled={themes.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.theme_name} {theme.is_active ? '(Active)' : ''}{' '}
                    {theme.week_start_date ? `– ${new Date(theme.week_start_date).toLocaleDateString()}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {themes.length === 0 && (
              <p className="text-xs text-muted-foreground">No themes found. Create one first.</p>
            )}
          </div>

          {/* Member Picker */}
          <div className="space-y-2">
            <Label htmlFor="member">Member *</Label>
            <Select
              value={formData.member_id}
              onValueChange={(value) => setFormData({ ...formData, member_id: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Artist */}
          <div className="space-y-2">
            <Label htmlFor="artist">Artist *</Label>
            <Input
              id="artist"
              required
              value={formData.artist}
              onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
              placeholder="David Holmes"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Album Title *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Let's Get Killed"
            />
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform *</Label>
            <Select
              value={formData.platform}
              onValueChange={(value) => setFormData({ ...formData, platform: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform.value} value={platform.value}>
                    {platform.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Adding...' : 'Add Album'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
