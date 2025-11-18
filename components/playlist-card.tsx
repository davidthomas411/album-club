import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import Link from 'next/link'
import { SiteLogo } from '@/components/site-logo'

interface Playlist {
  id: string
  name: string
  description?: string
  is_collaborative: boolean
  created_at: string
  itemCount: number
  creator?: {
    display_name: string
    avatar_url?: string
  }
  weekly_theme?: {
    theme_name: string
  }
}

interface PlaylistCardProps {
  playlist: Playlist
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  return (
    <Link href={`/playlists/${playlist.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 mb-2">
            <SiteLogo size={48} className="bg-primary/10 p-1 rounded-lg flex-shrink-0" />
            {playlist.is_collaborative && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Collaborative
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl">{playlist.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {playlist.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {playlist.description}
            </p>
          )}

          <div className="space-y-2">
            {playlist.weekly_theme && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Theme:</span>
                <Badge variant="outline" className="text-xs">
                  {playlist.weekly_theme.theme_name}
                </Badge>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {playlist.itemCount} {playlist.itemCount === 1 ? 'track' : 'tracks'}
              </span>
              {playlist.creator && (
                <span className="text-muted-foreground">
                  by {playlist.creator.display_name}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
