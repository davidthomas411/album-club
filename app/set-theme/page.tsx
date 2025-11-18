import { createClient } from '@/lib/supabase/server'
import { SetThemeForm } from '@/components/set-theme-form'
import { SiteLogo } from '@/components/site-logo'
import Link from 'next/link'

export default async function SetThemePage({
  searchParams,
}: {
  searchParams?: Promise<{ themeId?: string }>
}) {
  const supabase = await createClient()
  const resolvedParams = (await searchParams) || {}
  const themeId = resolvedParams.themeId

  // Get all members for curator selection
  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .order('display_name')

  let themeToEdit = null
  if (themeId) {
    const { data } = await supabase
      .from('weekly_themes')
      .select('*')
      .eq('id', themeId)
      .maybeSingle()
    themeToEdit = data
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <SiteLogo size={40} className="bg-primary/10 p-1" />
            <h1 className="text-2xl font-bold text-foreground">Album Club</h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            {themeToEdit ? 'Edit Weekly Theme' : 'Set Weekly Theme'}
          </h2>
          <p className="text-muted-foreground">
            {themeToEdit
              ? 'Update theme details, curator, or schedule.'
              : 'Create a new theme for the week and choose the curator.'}
          </p>
        </div>

        <SetThemeForm 
          userId="anonymous" 
          members={members || []}
          initialTheme={themeToEdit}
        />
      </div>
    </div>
  )
}
