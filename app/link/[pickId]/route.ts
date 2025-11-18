import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePlatformUrl } from '@/lib/songlink'

export async function GET(request: NextRequest, { params }: { params: { pickId: string } }) {
  const supabase = await createClient()
  const pickId = params.pickId

  if (!pickId) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const { data: pick } = await supabase
    .from('music_picks')
    .select('platform_url')
    .eq('id', pickId)
    .maybeSingle()

  if (!pick?.platform_url) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  let targetUrl = pick.platform_url

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const preferredPlatform =
      (user?.user_metadata as Record<string, string | undefined> | undefined)?.preferred_platform

    if (preferredPlatform) {
      const preferredUrl = await resolvePlatformUrl(
        pick.platform_url,
        preferredPlatform,
      )

      if (preferredUrl) {
        targetUrl = preferredUrl
      }
    }
  } catch (error) {
    console.error('[link-resolver] Unable to resolve platform link:', error)
  }

  return NextResponse.redirect(targetUrl)
}
