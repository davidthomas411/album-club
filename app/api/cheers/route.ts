import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'

// Files live in the Vercel Blob bucket under ipas/* (e.g., ipas/1-1.webp).
const CHEERS_PREFIX = 'ipas/'

export async function GET() {
  try {
    const { blobs } = await list({ prefix: CHEERS_PREFIX, limit: 1000 })
    const cheerImages = blobs.filter((blob) => !blob.pathname.endsWith('/'))

    if (cheerImages.length === 0) {
      return NextResponse.json(
        { error: 'No cheers images found' },
        { status: 404 },
      )
    }

    const randomIndex = Math.floor(Math.random() * cheerImages.length)
    const randomBlob = cheerImages[randomIndex]
    const url = randomBlob.url

    return NextResponse.json({ url })
  } catch (error) {
    console.error('[cheers] Failed to fetch cheers image', error)
    return NextResponse.json(
      { error: 'Unable to load cheers image' },
      { status: 500 },
    )
  }
}
