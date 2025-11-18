'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ListMusic, Plus, Search, Settings, X, Music2 } from 'lucide-react'

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/feed', label: 'Feed', icon: Music2 },
    { href: '/playlists', label: 'Playlists', icon: ListMusic },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/admin', label: 'Admin', icon: Settings },
  ]

  return (
    <div className="relative md:fixed left-0 top-0 h-full w-64 bg-sidebar flex flex-col p-6 gap-6 shadow-xl md:shadow-none z-50">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 md:hidden text-muted-foreground hover:text-foreground"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Banner */}
      <div className="mb-6 space-y-1 rounded-xl border border-primary/40 bg-primary/10 p-4 text-primary-foreground shadow-sm">
        <p className="text-lg font-bold text-primary">Album Club</p>
        <p className="text-xs text-muted-foreground">Neil made us quit Spotify because morals</p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-4 px-4 py-3 rounded-md transition-colors ${
                isActive
                  ? 'bg-surface-hover text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
              onClick={onClose}
            >
              <Icon className="w-6 h-6" />
              <span className="font-semibold">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Add Pick Button */}
      <Link href="/add-pick" className="mt-4 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-black font-bold py-3 px-6 rounded-full transition-colors" onClick={onClose}>
        <Plus className="w-5 h-5" />
        Add Pick
      </Link>

      {/* Bottom section */}
      <div className="mt-auto pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Share music from any platform
        </p>
      </div>
    </div>
  )
}
