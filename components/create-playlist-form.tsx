"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

interface Theme {
  id: string
  theme_name: string
  is_active: boolean
}

interface CreatePlaylistFormProps {
  userId: string
  allThemes: Theme[]
}

export function CreatePlaylistForm({ userId, allThemes }: CreatePlaylistFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    weekly_theme_id: '',
    is_collaborative: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { data, error: insertError } = await supabase
        .from('playlists')
        .insert({
          name: formData.name,
          description: formData.description || null,
          weekly_theme_id: formData.weekly_theme_id || null,
          is_collaborative: formData.is_collaborative,
          created_by: userId,
        })
        .select()
        .single()

      if (insertError) throw insertError

      router.push(`/playlists/${data.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playlist Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Playlist Name *</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter playlist name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What's this playlist about?"
              rows={3}
            />
          </div>

          {/* Weekly Theme */}
          {allThemes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="theme">Link to Weekly Theme (optional)</Label>
              <Select
                value={formData.weekly_theme_id}
                onValueChange={(value) => setFormData({ ...formData, weekly_theme_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No theme</SelectItem>
                  {allThemes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.theme_name} {theme.is_active && '(Active)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Collaborative */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="collaborative"
              checked={formData.is_collaborative}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, is_collaborative: checked as boolean })
              }
            />
            <Label htmlFor="collaborative" className="font-normal cursor-pointer">
              Allow other members to add tracks
            </Label>
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
              {isLoading ? 'Creating...' : 'Create Playlist'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
