import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { themeId } = await req.json()
    if (!themeId) {
      return NextResponse.json({ error: 'themeId is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { error: resetError } = await supabase
      .from('weekly_themes')
      .update({ is_active: false })
      .neq('id', themeId)

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 })
    }

    const { error: setError } = await supabase
      .from('weekly_themes')
      .update({ is_active: true })
      .eq('id', themeId)

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
