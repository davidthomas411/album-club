import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SetThemeForm } from '@/components/set-theme-form'
import { Music2 } from 'lucide-react'
import Link from 'next/link'

export default async function SetThemePage() {
  const supabase = await createClient()
  

  // Get all members for curator selection
  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Music2 className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Album Club</h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Set Weekly Theme
          </h2>
          <p className="text-muted-foreground">
            Create a new theme for the week and choose the curator
          </p>
        </div>

        <SetThemeForm 
          userId="anonymous" 
          members={members || []}
        />
      </div>
    </div>
  )
}
