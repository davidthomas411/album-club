import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

type PickPayload = {
  id: string
  artist?: string | null
  title?: string | null
  album?: string | null
  platform_url?: string | null
}

function extractTrackUri(url?: string | null) {
  if (!url) return null
  const match = url.match(/spotify\.com\/track\/([A-Za-z0-9]{16,24})/)
  return match ? `spotify:track:${match[1]}` : null
}

function extractAlbumId(url?: string | null) {
  if (!url) return null
  const match = url.match(/spotify\.com\/album\/([A-Za-z0-9]{16,24})/)
  return match ? match[1] : null
}

async function getAccessToken(userRefreshToken?: string | null) {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const refreshToken = userRefreshToken || process.env.SPOTIFY_REFRESH_TOKEN
  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify client/secret')
  }
  if (!refreshToken) {
    throw new Error('Missing Spotify refresh token')
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to refresh token: ${res.status} ${text}`)
  }
  const json = await res.json()
  return json.access_token as string
}

async function fetchAlbumTracks(token: string, albumId: string) {
  const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const json = await res.json()
  const first = json.items?.[0]?.id
  return first ? `spotify:track:${first}` : null
}

async function searchTrack(token: string, q: string) {
  const res = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const id = json.tracks?.items?.[0]?.id
  return id ? `spotify:track:${id}` : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const picks: PickPayload[] = body?.picks || []
    const name = body?.name || 'Album Club Playlist'
    if (!Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: 'No picks provided' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const cookieRefresh = cookieStore.get('spotify_refresh_token')?.value || null
    const cookieAccess = cookieStore.get('spotify_access_token')?.value || null

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Please sign in to Album Club before creating a playlist.' },
        { status: 401 },
      )
    }

    const userRefreshMeta =
      (user.user_metadata as Record<string, any> | undefined)?.spotify_refresh_token || null
    let userRefreshProfile: string | null = null
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('spotify_refresh_token')
        .eq('id', user.id)
        .single()
      userRefreshProfile = data?.spotify_refresh_token || null
    }
    const userRefresh = userRefreshProfile || userRefreshMeta

    if (!userRefresh && !cookieRefresh && !process.env.SPOTIFY_REFRESH_TOKEN && !cookieAccess) {
      return NextResponse.json(
        { error: 'No Spotify connection found. Please connect Spotify first.' },
        { status: 401 },
      )
    }

    let accessToken: string
    try {
      if (cookieAccess && !userRefresh && !cookieRefresh && !process.env.SPOTIFY_REFRESH_TOKEN) {
        accessToken = cookieAccess
      } else {
        accessToken = await getAccessToken(userRefresh || cookieRefresh)
      }
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || 'Failed to refresh Spotify token' },
        { status: 401 },
      )
    }
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!meRes.ok) {
      const text = await meRes.text()
      return NextResponse.json({ error: `Failed to fetch user: ${text}` }, { status: 500 })
    }
    const me = await meRes.json()
    const userId = me.id

    const uris: string[] = []
    for (const p of picks) {
      // Prefer direct track link
      const trackUri = extractTrackUri(p.platform_url)
      if (trackUri) {
        uris.push(trackUri)
        continue
      }
      // If album link, pick first track
      const albumId = extractAlbumId(p.platform_url)
      if (albumId) {
        const uri = await fetchAlbumTracks(accessToken, albumId)
        if (uri) {
          uris.push(uri)
          continue
        }
      }
      // Fallback search
      const qParts = [p.artist, p.title || p.album].filter(Boolean) as string[]
      if (!qParts.length) continue
      const q = qParts.join(' ')
      const uri = await searchTrack(accessToken, q)
      if (uri) uris.push(uri)
    }

    if (!uris.length) {
      return NextResponse.json({ error: 'No Spotify tracks found for these picks' }, { status: 400 })
    }

    const plRes = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: 'Generated from Album Club filter',
        public: false,
      }),
    })
    if (!plRes.ok) {
      const text = await plRes.text()
      return NextResponse.json({ error: `Create playlist failed: ${text}` }, { status: 500 })
    }
    const playlist = await plRes.json()

    // Add tracks in batches of 100
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100)
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: batch }),
      })
      if (!addRes.ok) {
        const text = await addRes.text()
        return NextResponse.json({ error: `Add tracks failed: ${text}` }, { status: 500 })
      }
    }

    return NextResponse.json({
      playlist_url: playlist.external_urls?.spotify,
      added: uris.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
