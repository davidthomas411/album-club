import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const FACE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FACE_BUCKET || 'faces'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ folders: [] }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data, error } = await supabase.storage
    .from(FACE_BUCKET)
    .list('', { limit: 1000 })

  if (error) {
    console.error('[v0] Failed to list face folders:', error)
    return NextResponse.json({ folders: [] }, { status: 500 })
  }

  const folders =
    data
      ?.filter((item) => !item.id && item.name)
      .map((item) => item.name)
      .filter(Boolean) ?? []

  return NextResponse.json({ folders })
}
