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

    const preferredPlatformRaw =
      (user?.user_metadata as Record<string, string | undefined> | undefined)?.preferred_platform
    const preferredPlatform = preferredPlatformRaw?.trim().toLowerCase() || null

    if (preferredPlatform) {
      const alreadyMatches =
        (preferredPlatform === 'tidal' && targetUrl.includes('tidal.com')) ||
        (preferredPlatform === 'spotify' && targetUrl.includes('spotify.com')) ||
        (preferredPlatform === 'apple_music' && targetUrl.includes('music.apple.com')) ||
        (preferredPlatform === 'youtube_music' && targetUrl.includes('music.youtube.com')) ||
        (preferredPlatform === 'soundcloud' && targetUrl.includes('soundcloud.com')) ||
        (preferredPlatform === 'deezer' && targetUrl.includes('deezer.com'))

      if (!alreadyMatches) {
        const preferredUrl = await resolvePlatformUrl(targetUrl, preferredPlatform)
        if (preferredUrl) {
          targetUrl = preferredUrl
        } else {
          // If we can't resolve, send to song.link chooser with preferred platform hint
          targetUrl = `https://song.link/${encodeURIComponent(targetUrl)}?platform=${encodeURIComponent(preferredPlatform)}`
        }
      }
    }
  } catch (error) {
    console.error('[link-resolver:query] Unable to resolve platform link:', error)
  }

  return NextResponse.redirect(targetUrl)
}
