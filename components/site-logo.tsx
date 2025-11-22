import { cn } from '@/lib/utils'

interface SiteLogoProps {
  size?: number
  className?: string
}

export function SiteLogo({ size = 32, className }: SiteLogoProps) {
  return (
    <div
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-label="AlbumClub logo"
    />
  )
}
