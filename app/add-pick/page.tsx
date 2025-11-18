import { createClient } from '@/lib/supabase/server'
import { AddPickForm } from '@/components/add-pick-form'
import { Music2 } from 'lucide-react'
import Link from 'next/link'

export default async function AddPickPage() {
  const supabase = await createClient()
  
  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name')
    .order('display_name', { ascending: true })

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
            Add Album Pick
          </h2>
          <p className="text-muted-foreground">
            Share an album from any streaming platform
          </p>
        </div>

        <AddPickForm members={members || []} />
      </div>
    </div>
  )
}
