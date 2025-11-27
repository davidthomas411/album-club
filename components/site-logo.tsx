/* eslint-disable react/jsx-no-undef */
'use client'

import { FaceTracker } from '@/components/face-tracker'
import { cn } from '@/lib/utils'

interface SiteLogoProps {
  size?: number
  className?: string
}

export function SiteLogo({ size = 32, className }: SiteLogoProps) {
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_FACE_BUCKET || 'faces'
  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/bobby`
    : null

  return (
    <div
      className={cn('inline-flex items-center justify-center rounded-full overflow-hidden bg-muted', className)}
      style={{ width: size, height: size }}
      aria-label="AlbumClub logo"
    >
      {supabaseBase ? (
        <FaceTracker
          memberFolder="bobby"
          size={256}
          fallbackBasePath={supabaseBase}
          disablePointerTracking={false}
          disableOnMobile={false}
          autoAnimate
          autoAnimateOnMobile
          initialDirection={{ x: 0, y: 0 }}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </div>
  )
}
