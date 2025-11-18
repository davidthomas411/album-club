'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createBrowserClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  display_name: string | null
  face_images_folder: string | null
}

interface SetThemeFormProps {
  userId: string
  members: Profile[]
}

export function SetThemeForm({ userId, members }: SetThemeFormProps) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    themeName: '',
    description: '',
    curatorId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Deactivate any current active themes
      await supabase
        .from('weekly_themes')
        .update({ is_active: false })
        .eq('is_active', true)

      // Insert new theme
      const { data, error: insertError } = await supabase
        .from('weekly_themes')
        .insert({
          theme_name: formData.themeName,
          theme_description: formData.description || null,
          curator_id: formData.curatorId,
          week_start_date: formData.startDate,
          week_end_date: formData.endDate,
          is_active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('[v0] Error creating theme:', err)
      setError(err instanceof Error ? err.message : 'Failed to create theme')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-surface rounded-lg p-6">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="themeName">Theme Name *</Label>
        <Input
          id="themeName"
          type="text"
          placeholder="e.g., Free Choice, 90s Hip-Hop, Summer Vibes"
          value={formData.themeName}
          onChange={(e) => setFormData({ ...formData, themeName: e.target.value })}
          required
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Optional description or guidelines for this week's theme"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="mt-2"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="curator">Curator *</Label>
        <select
          id="curator"
          value={formData.curatorId}
          onChange={(e) => setFormData({ ...formData, curatorId: e.target.value })}
          required
          className="mt-2 w-full bg-background border border-input rounded-lg px-4 py-2 text-foreground"
        >
          <option value="">Select a curator</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name || 'Unknown'}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date *</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="endDate">End Date *</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            required
            className="mt-2"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/')}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-primary hover:bg-primary-hover text-black font-bold"
        >
          {loading ? 'Creating...' : 'Create Theme'}
        </Button>
      </div>
    </form>
  )
}
