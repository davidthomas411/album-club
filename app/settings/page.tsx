import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserPreferencesForm } from '@/components/user-preferences-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()

  const preferredPlatform = (user.user_metadata as Record<string, string | undefined> | null)?.preferred_platform ?? null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Account</p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mt-2">Preferences</h1>
          <p className="text-muted-foreground mt-3">
            Signed in as <span className="font-semibold text-foreground">{profile?.display_name || user.email}</span>
          </p>
        </div>

        <UserPreferencesForm initialPreference={preferredPlatform} />
      </div>
    </div>
  )
}
