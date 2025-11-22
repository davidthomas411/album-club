const PLATFORM_KEY_MAP: Record<string, string> = {
  spotify: 'spotify',
  apple_music: 'appleMusic',
  youtube_music: 'youtubeMusic',
  tidal: 'tidal',
  soundcloud: 'soundcloud',
  deezer: 'deezer',
  bandcamp: 'bandcamp',
  other: '',
}

interface SonglinkResponse {
  linksByPlatform?: Record<string, { url: string }>
}

type CachedPlatforms = {
  expires: number
  platforms: Record<string, string>
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours
const songlinkCache = new Map<string, CachedPlatforms>()

export async function resolvePlatformUrl(
  sourceUrl: string,
  preferredPlatform?: string | null,
): Promise<string | null> {
  if (!preferredPlatform) {
    return null
  }

  const normalized = preferredPlatform.trim().toLowerCase()
  const platformKey = PLATFORM_KEY_MAP[normalized] ?? normalized
  if (!platformKey) {
    return null
  }

  const cachedEntry = songlinkCache.get(sourceUrl)
  if (cachedEntry && cachedEntry.expires > Date.now()) {
    const cachedUrl = cachedEntry.platforms[platformKey]
    if (cachedUrl) {
      return cachedUrl
    }
    // If cached but missing the requested platform, fall through to refetch
  }

  try {
    const response = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(sourceUrl)}`,
      { cache: 'no-store' },
    )
    if (!response.ok) {
      return null
    }
    const data = (await response.json()) as SonglinkResponse
    const platforms: Record<string, string> = {}
    Object.entries(data.linksByPlatform ?? {}).forEach(([key, value]) => {
      platforms[key] = value.url
    })

    songlinkCache.set(sourceUrl, {
      expires: Date.now() + CACHE_TTL_MS,
      platforms,
    })

    const matchedPlatform = platforms[platformKey]
    return matchedPlatform ?? null
  } catch (error) {
    console.error('[songlink] Failed to resolve platform link', error)
    return null
  }
}
