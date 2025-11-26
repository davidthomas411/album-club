import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function generateVerifier() {
  return base64UrlEncode(crypto.randomBytes(64))
}

function challengeFromVerifier(verifier: string) {
  return base64UrlEncode(crypto.createHash('sha256').update(verifier).digest())
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/spotify/callback`

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing SPOTIFY_CLIENT_ID or redirect URI (set SPOTIFY_REDIRECT_URI)' },
      { status: 500 },
    )
  }

  const verifier = generateVerifier()
  const challenge = challengeFromVerifier(verifier)

  const state = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        v: verifier,
        uid: user?.id || null,
      }),
      'utf8',
    ),
  )

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: 'playlist-modify-public playlist-modify-private',
    state,
    show_dialog: 'true',
  })

  const res = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`)
  res.cookies.set('spotify_code_verifier', verifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  })
  return res
}
