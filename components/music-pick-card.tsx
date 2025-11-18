import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'
import { SiteLogo } from '@/components/site-logo'
import { Button } from '@/components/ui/button'

interface MusicPick {
  id: string
  title: string
  artist: string
  album?: string
  platform: string
  platform_url: string
  pick_type: 'song' | 'album'
  notes?: string
  created_at: string
  user?: {
    display_name: string
    avatar_url?: string
  }
  weekly_theme?: {
    theme_name: string
  }
}

interface MusicPickCardProps {
  pick: MusicPick
}

const platformColors: Record<string, string> = {
  spotify: 'bg-green-500',
  apple_music: 'bg-red-500',
  youtube_music: 'bg-red-600',
  soundcloud: 'bg-orange-500',
  tidal: 'bg-blue-500',
  bandcamp: 'bg-cyan-500',
}

const platformNames: Record<string, string> = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube_music: 'YouTube Music',
  soundcloud: 'SoundCloud',
  tidal: 'Tidal',
  bandcamp: 'Bandcamp',
}

export function MusicPickCard({ pick }: MusicPickCardProps) {
  const platformColor = platformColors[pick.platform] || 'bg-primary'
  const platformName = platformNames[pick.platform] || pick.platform

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* User Avatar */}
          <div className="flex-shrink-0">
            {pick.user?.avatar_url ? (
              <img
                src={pick.user.avatar_url || "/placeholder.svg"}
                alt={pick.user.display_name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <SiteLogo size={48} className="bg-primary/10 p-1 rounded-full" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">
                  {pick.user?.display_name || 'Anonymous'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(pick.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{pick.pick_type}</Badge>
                {pick.weekly_theme && (
                  <Badge variant="outline">{pick.weekly_theme.theme_name}</Badge>
                )}
              </div>
            </div>

            {/* Music Info */}
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">
                {pick.title}
              </h3>
              <p className="text-muted-foreground">
                by {pick.artist}
                {pick.album && ` • ${pick.album}`}
              </p>
            </div>

            {/* Notes */}
            {pick.notes && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pick.notes}
              </p>
            )}

            {/* Platform Link */}
            <div className="flex items-center gap-3 pt-2">
              <div className={`h-2 w-2 rounded-full ${platformColor}`} />
              <span className="text-sm text-muted-foreground">{platformName}</span>
              <a
                href={`/link/${pick.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Listen
                </Button>
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
