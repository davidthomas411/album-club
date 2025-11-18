import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { memberName, urls } = await request.json()
    
    const supabase = await createServerClient()
    
    // Create or update profile with blob URLs mapping
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, face_blob_urls')
      .eq('face_images_folder', memberName)
      .single()
    
    if (profile) {
      // Update existing profile with new URLs
      const urlMap: Record<string, string> = profile.face_blob_urls || {}
      
      urls.forEach(({ filename, url }: { filename: string; url: string }) => {
        urlMap[filename] = url
      })
      
      await supabase
        .from('profiles')
        .update({ face_blob_urls: urlMap })
        .eq('id', profile.id)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Save URLs error:', error)
    return NextResponse.json({ error: 'Failed to save URLs' }, { status: 500 })
  }
}
