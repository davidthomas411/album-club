"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Check } from 'lucide-react'

interface MusicPick {
  id: string
  title: string
  artist: string
  album?: string
  platform: string
}

interface AddToPlaylistButtonProps {
  playlistId: string
  userId: string
  availablePicks: MusicPick[]
}

export function AddToPlaylistButton({ 
  playlistId, 
  userId,
  availablePicks 
}: AddToPlaylistButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [addedPicks, setAddedPicks] = useState<Set<string>>(new Set())

  const handleAddPick = async (pickId: string) => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      // Get current max position
      const { data: items } = await supabase
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition = items && items.length > 0 ? items[0].position + 1 : 0

      const { error } = await supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          music_pick_id: pickId,
          position: nextPosition,
          added_by: userId,
        })

      if (error) throw error

      setAddedPicks(prev => new Set(prev).add(pickId))
      router.refresh()
    } catch (err) {
      console.error('Failed to add pick:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Tracks
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tracks to Playlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-4">
          {availablePicks.map((pick) => {
            const isAdded = addedPicks.has(pick.id)
            
            return (
              <Card key={pick.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">
                        {pick.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {pick.artist}
                        {pick.album && ` • ${pick.album}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={isLoading || isAdded}
                      onClick={() => handleAddPick(pick.id)}
                      variant={isAdded ? 'secondary' : 'default'}
                    >
                      {isAdded ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
