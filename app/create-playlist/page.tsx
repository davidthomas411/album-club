import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatePlaylistForm } from '@/components/create-playlist-form'
import { Music2 } from 'lucide-react'
import Link from 'next/link'

export default async function CreatePlaylistPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Get all themes for dropdown
  const { data: allThemes } = await supabase
    .from('weekly_themes')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Music2 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">AlbumClub</h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Create Playlist
          </h2>
          <p className="text-muted-foreground">
            Build a collaborative collection from community picks
          </p>
        </div>

        <CreatePlaylistForm userId={user.id} allThemes={allThemes || []} />
      </div>
    </div>
  )
}
