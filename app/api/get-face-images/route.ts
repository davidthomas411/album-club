import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const FACE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FACE_BUCKET || 'faces'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const supabase = await createServerClient()
    const storageClient = supabase.storage.from(FACE_BUCKET)

    const { data: files, error } = await storageClient
      .list(memberName, {
        limit: 500,
        sortBy: { column: 'name', order: 'asc' },
      })

    if (error) {
      console.error('[v0] Supabase storage error:', error)
      return NextResponse.json(
        { error: 'Failed to list images' },
        { status: 500 }
      )
    }

    const imageMap: Record<string, string> = {}

    for (const file of files || []) {
      if (!file.name) continue
      const { data: publicUrl } = storageClient.getPublicUrl(
        `${memberName}/${file.name}`,
      )
      if (publicUrl?.publicUrl) {
        const version = file.updated_at
          ? new Date(file.updated_at).getTime()
          : Date.now()
        imageMap[file.name] = `${publicUrl.publicUrl}?v=${version}`
      }
    }

    console.log(
      '[v0] Found face images for',
      memberName,
      ':',
      Object.keys(imageMap).length
    )

    return NextResponse.json({ images: imageMap })
  } catch (error) {
    console.error('[v0] Error fetching face images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}
