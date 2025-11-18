import { Music } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SiteLogoProps {
  size?: number
  className?: string
}

export function SiteLogo({ size = 32, className }: SiteLogoProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-primary/15 text-primary flex items-center justify-center',
        className
      )}
      style={{ width: size, height: size }}
      aria-label="AlbumClub logo"
    >
      <Music className="w-3/5 h-3/5" strokeWidth={2.5} />
    </div>
  )
}
