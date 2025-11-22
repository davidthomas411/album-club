import { createClient } from '@/lib/supabase/server'
import { AddPickForm } from '@/components/add-pick-form'
import { SiteLogo } from '@/components/site-logo'
import Link from 'next/link'

export default async function AddPickPage() {
  const supabase = await createClient()
  
  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name')
    .order('display_name', { ascending: true })

  const { data: themesData } = await supabase
    .from('weekly_themes')
    .select('id, theme_name, week_start_date, is_active')
    .order('is_active', { ascending: false })
    .order('week_start_date', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false })

  const themes =
    themesData?.filter((theme, index, arr) => arr.findIndex(t => t.id === theme.id) === index) || []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SiteLogo size={48} className="bg-transparent" />
            <span className="sr-only">AlbumClub</span>
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

        <AddPickForm members={members || []} themes={themes || []} />
      </div>
    </div>
  )
}
