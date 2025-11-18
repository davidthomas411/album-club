import { list } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberName = searchParams.get('member')

    if (!memberName) {
      return NextResponse.json(
        { error: 'Member name required' },
        { status: 400 }
      )
    }

    // List all files in the member's folder
    const { blobs } = await list({
      prefix: `faces/${memberName}/`,
    })

    // Create a map of filename to URL
    const imageMap: Record<string, string> = {}
    blobs.forEach((blob) => {
      // Extract just the filename from the full path
      const filename = blob.pathname.split('/').pop()
      if (filename) {
        imageMap[filename] = blob.url
      }
    })

    console.log('[v0] Found face images for', memberName, ':', Object.keys(imageMap).length)

    return NextResponse.json({ images: imageMap })
  } catch (error) {
    console.error('[v0] Error fetching face images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}
