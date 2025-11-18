'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const PLATFORMS = [
  { value: 'spotify', label: 'Spotify' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'tidal', label: 'Tidal' },
  { value: 'soundcloud', label: 'SoundCloud' },
  { value: 'deezer', label: 'Deezer' },
  { value: 'bandcamp', label: 'Bandcamp' },
  { value: 'other', label: 'Other / Browser' },
]

interface UserPreferencesFormProps {
  initialPreference?: string | null
}

export function UserPreferencesForm({ initialPreference }: UserPreferencesFormProps) {
  const [preference, setPreference] = useState(initialPreference || 'spotify')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage('You need to be logged in to save preferences.')
        setIsSaving(false)
        return
      }
      const { error } = await supabase.auth.updateUser({
        data: { preferred_platform: preference },
      })
      if (error) throw error
      setMessage('Preference updated!')
    } catch (error) {
      console.error('[preferences] Failed to save preference:', error)
      setMessage('Failed to save preference. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playback Preference</CardTitle>
        <CardDescription>
          Choose the streaming service links should redirect to when club members share music.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="preferred-platform">Streaming service</Label>
          <Select value={preference} onValueChange={setPreference}>
            <SelectTrigger id="preferred-platform" className="w-full">
              <SelectValue placeholder="Select a platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((platform) => (
                <SelectItem key={platform.value} value={platform.value}>
                  {platform.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? 'Saving...' : 'Save preference'}
        </Button>
        {message && (
          <p className="text-sm text-muted-foreground text-center">{message}</p>
        )}
      </CardContent>
    </Card>
  )
}
