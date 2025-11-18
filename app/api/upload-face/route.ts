import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Buffer } from 'node:buffer'

export const runtime = 'nodejs'

const FACE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FACE_BUCKET || 'faces'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const memberName = formData.get('memberName') as string
    const filename = formData.get('filename') as string

    if (!file || !memberName || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 },
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    const arrayBuffer = await file.arrayBuffer()
    const filePath = `${memberName.toLowerCase()}/${filename}`

    const { error } = await supabase.storage
      .from(FACE_BUCKET)
      .upload(filePath, Buffer.from(arrayBuffer), {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      })

    if (error) {
      console.error('[v0] Supabase upload error:', error)
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 },
      )
    }

    const { data: publicUrl } = supabase.storage
      .from(FACE_BUCKET)
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl.publicUrl })
  } catch (error) {
    console.error('[v0] Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 },
    )
  }
}
