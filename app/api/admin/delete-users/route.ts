import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DeletePayload = {
  ids?: string[]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    console.error('[admin/delete-users] Missing SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json(
      { error: 'Service role key not configured on server' },
      { status: 500 },
    )
  }

  let payload: DeletePayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No user IDs provided' }, { status: 400 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  const results = []

  for (const id of ids) {
    try {
      await adminClient.from('music_picks').delete().eq('user_id', id)
      await adminClient.from('weekly_themes').delete().eq('curator_id', id)
      await adminClient.from('profiles').delete().eq('id', id)
      await adminClient.auth.admin.deleteUser(id)
      results.push({ id, status: 'deleted' })
    } catch (error) {
      console.error(`[admin/delete-users] Failed to delete user ${id}:`, error)
      results.push({ id, status: 'error' })
    }
  }

  const failureCount = results.filter((result) => result.status === 'error').length

  return NextResponse.json({
    success: failureCount === 0,
    results,
  })
}
