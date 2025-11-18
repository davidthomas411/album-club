import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePlatformUrl } from '@/lib/songlink'

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('url')

  if (!source) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  let targetUrl =
    source.startsWith('http://') || source.startsWith('https://')
      ? source
      : `https://${source.replace(/^\/+/, '')}`

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const preferredPlatform =
      (user?.user_metadata as Record<string, string | undefined> | undefined)?.preferred_platform

    if (preferredPlatform) {
      const preferredUrl = await resolvePlatformUrl(targetUrl, preferredPlatform)
      if (preferredUrl) {
        targetUrl = preferredUrl
      }
    }
  } catch (error) {
    console.error('[link-resolver:query] Unable to resolve platform link:', error)
  }

  return NextResponse.redirect(targetUrl)
}
