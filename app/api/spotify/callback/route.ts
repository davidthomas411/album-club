import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const stateParam = url.searchParams.get('state')
  let stateVerifier: string | null = null
  let stateUserId: string | null = null
  if (stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf8'))
      if (decoded?.v) stateVerifier = decoded.v as string
      if (decoded?.uid) stateUserId = decoded.uid as string
    } catch {}
  }
  const cookieStore = await cookies()
  const verifier = cookieStore.get('spotify_code_verifier')?.value || stateVerifier

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  if (!code || !verifier) {
    return NextResponse.json({ error: 'Missing code or verifier' }, { status: 400 })
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/spotify/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET' },
      { status: 500 },
    )
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: verifier,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return NextResponse.json({ error: `Token exchange failed: ${tokenRes.status} ${text}` }, { status: 500 })
    }

    const tokens = await tokenRes.json()
    // Clear verifier cookie
    // Persist refresh token for the logged-in user if available.
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!tokens.refresh_token) {
      return NextResponse.json({ error: 'Missing refresh token from Spotify' }, { status: 500 })
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing SUPABASE service role env vars', refresh_token: tokens.refresh_token },
        { status: 500 },
      )
    }
    const admin = createAdminClient(supabaseUrl, serviceRoleKey)
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const targetUserId = stateUserId || user?.id
    if (!targetUserId) {
      return NextResponse.json(
        { error: 'No signed-in user to attach Spotify token', refresh_token: tokens.refresh_token },
        { status: 401 },
      )
    }
    try {
      await admin
        .from('profiles')
        .upsert(
          { id: targetUserId, spotify_refresh_token: tokens.refresh_token },
          { onConflict: 'id' },
        )
      await admin.auth.admin.updateUserById(targetUserId, {
        user_metadata: { spotify_refresh_token: tokens.refresh_token },
      })
    } catch (err: any) {
      return NextResponse.json(
        { error: `Failed to save Spotify token: ${err?.message || err}`, refresh_token: tokens.refresh_token },
        { status: 500 },
      )
    }

    // Redirect back to Music Map (or homepage) after success
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${url.protocol}//${url.host}`
    let redirectUrl: URL
    try {
      redirectUrl = new URL('/music-map', siteUrl)
    } catch {
      // Fallback if NEXT_PUBLIC_SITE_URL is malformed
      redirectUrl = new URL('/music-map', url.origin)
    }
    const res = NextResponse.redirect(redirectUrl)
    res.cookies.set('spotify_code_verifier', '', { path: '/', maxAge: 0 })
    if (tokens.refresh_token) {
      res.cookies.set('spotify_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }
    if (tokens.access_token) {
      res.cookies.set('spotify_access_token', tokens.access_token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: tokens.expires_in ? tokens.expires_in : 3600,
      })
    }

    return res
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
