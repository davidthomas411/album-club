'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, ListMusic, Plus, Search, Shield, X, Music, SlidersHorizontal, LogIn, UserPlus } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const [userName, setUserName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    let isMounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return
      if (data.user) {
        setUserName(
          (data.user.user_metadata as Record<string, string> | undefined)?.display_name ||
            data.user.email ||
            null,
        )
        setAvatarUrl(
          (data.user.user_metadata as Record<string, string> | undefined)?.avatar_url || null,
        )
      } else {
        setUserName(null)
        setAvatarUrl(null)
      }
    })
    return () => {
      isMounted = false
    }
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/feed', label: 'Feed', icon: Music },
    { href: '/playlists', label: 'Playlists', icon: ListMusic },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/admin', label: 'Admin', icon: Shield },
    { href: '/settings', label: 'Preferences', icon: SlidersHorizontal },
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
      <div className="mt-auto pt-6 border-t border-border space-y-3">
        {userName ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-lg font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{userName}</p>
                <p className="text-xs text-muted-foreground">Signed in</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full rounded-md border border-border px-4 py-2 text-sm font-semibold hover:border-primary hover:text-foreground transition-colors"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold hover:border-primary hover:text-foreground transition-colors"
              onClick={onClose}
            >
              <LogIn className="w-4 h-4" />
              Log in
            </Link>
            <Link
              href="/auth/sign-up"
              className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black hover:bg-primary-hover transition-colors"
              onClick={onClose}
            >
              <UserPlus className="w-4 h-4" />
              Create account
            </Link>
          </div>
        )}
        <p className="text-sm text-muted-foreground text-center">
          Share music from any platform
        </p>
      </div>
    </div>
  )
}
