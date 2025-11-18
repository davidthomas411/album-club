'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, UserPlus, Home, Database } from 'lucide-react'
import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'

interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  whatsapp_number: string | null
  face_images_folder: string | null
  created_at: string
}

export default function UsersAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const supabase = createBrowserClient()

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  async function addUser() {
    if (!displayName.trim()) {
      alert('Please enter a display name')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        display_name: displayName,
        whatsapp_number: whatsappNumber || null,
      })
      .select()

    if (error) {
      alert('Failed to add user: ' + error.message)
    } else {
      setDisplayName('')
      setWhatsappNumber('')
      fetchUsers()
    }
  }

  async function deleteUser(id: string) {
    console.log('[v0] Starting deletion for user:', id)
    setDeleting(true)
    
    try {
      console.log('[v0] Deleting music picks...')
      const { error: picksError, count: picksCount } = await supabase
        .from('music_picks')
        .delete({ count: 'exact' })
        .eq('user_id', id)
      
      if (picksError) {
        console.error('[v0] Error deleting picks:', picksError)
        alert('Failed to delete user picks: ' + picksError.message)
        setDeleting(false)
        return
      }
      console.log(`[v0] Deleted ${picksCount} music picks`)
      
      console.log('[v0] Deleting weekly themes...')
      const { error: themesError, count: themesCount } = await supabase
        .from('weekly_themes')
        .delete({ count: 'exact' })
        .eq('curator_id', id)
      
      if (themesError) {
        console.error('[v0] Error deleting themes:', themesError)
        alert('Failed to delete user themes: ' + themesError.message)
        setDeleting(false)
        return
      }
      console.log(`[v0] Deleted ${themesCount} themes`)
      
      console.log('[v0] Deleting profile...')
      const { error: profileError, count: profileCount } = await supabase
        .from('profiles')
        .delete({ count: 'exact' })
        .eq('id', id)

      if (profileError) {
        console.error('[v0] Error deleting profile:', profileError)
        alert('Failed to delete user: ' + profileError.message)
        setDeleting(false)
        return
      }
      
      console.log(`[v0] Successfully deleted profile (${profileCount} row)`)
      alert('User deleted successfully!')
      await fetchUsers()
      
    } catch (err) {
      console.error('[v0] Unexpected error:', err)
      alert('An unexpected error occurred: ' + String(err))
    } finally {
      setDeleting(false)
    }
  }

  async function deleteSelectedUsers() {
    if (selectedIds.size === 0) {
      alert('Please select users to delete')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} user(s)? This will also delete all their picks and themes.`)) {
      return
    }

    console.log('[v0] Deleting multiple users:', Array.from(selectedIds))
    setDeleting(true)

    let successCount = 0
    let failCount = 0

    for (const id of selectedIds) {
      try {
        await supabase.from('music_picks').delete().eq('user_id', id)
        await supabase.from('weekly_themes').delete().eq('curator_id', id)
        
        const { error } = await supabase.from('profiles').delete().eq('id', id)
        
        if (error) {
          console.error(`[v0] Failed to delete user ${id}:`, error)
          failCount++
        } else {
          successCount++
        }
      } catch (err) {
        console.error(`[v0] Error deleting user ${id}:`, err)
        failCount++
      }
    }

    setDeleting(false)
    setSelectedIds(new Set())
    
    alert(`Deleted ${successCount} user(s). Failed: ${failCount}`)
    await fetchUsers()
  }

  function toggleUserSelection(id: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  function toggleSelectAll() {
    if (selectedIds.size === profiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(profiles.map(p => p.id)))
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Users Management</h1>
            <p className="text-muted-foreground">Add, invite, and manage club members</p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Database
              </Button>
            </Link>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New Member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Input
                  id="whatsapp"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addUser} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Club Members ({profiles.length})</CardTitle>
              {profiles.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    {selectedIds.size === profiles.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedUsers}
                      disabled={deleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {selectedIds.size} Selected
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : profiles.length === 0 ? (
              <p className="text-muted-foreground">No members yet</p>
            ) : (
              <div className="space-y-4">
                {profiles.map((profile) => (
                  <div key={profile.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Checkbox
                          checked={selectedIds.has(profile.id)}
                          onCheckedChange={() => toggleUserSelection(profile.id)}
                        />
                        {profile.avatar_url ? (
                          <img 
                            src={profile.avatar_url || "/placeholder.svg"} 
                            alt={profile.display_name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                            <span className="text-lg font-bold text-foreground">
                              {profile.display_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-foreground">{profile.display_name}</h3>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {profile.whatsapp_number && (
                              <p><strong>WhatsApp:</strong> {profile.whatsapp_number}</p>
                            )}
                            {profile.bio && (
                              <p><strong>Bio:</strong> {profile.bio}</p>
                            )}
                            {profile.face_images_folder && (
                              <p><strong>Face Folder:</strong> {profile.face_images_folder}</p>
                            )}
                            <p><strong>Joined:</strong> {new Date(profile.created_at).toLocaleDateString()}</p>
                            <p className="text-xs opacity-70"><strong>ID:</strong> {profile.id}</p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${profile.display_name}? This will also delete all their picks and themes.`)) {
                            deleteUser(profile.id)
                          }
                        }}
                        disabled={deleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
