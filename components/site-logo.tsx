import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SiteLogoProps {
  size?: number
  className?: string
}

export function SiteLogo({ size = 32, className }: SiteLogoProps) {
  return (
    <Image
      src="/larry.svg"
      alt="Larry the Lobster mascot"
      width={size}
      height={size}
      className={cn('rounded-full object-cover', className)}
      priority
    />
  )
}
