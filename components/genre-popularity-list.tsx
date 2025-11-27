'use client'

import React, { useEffect, useMemo, useState } from 'react'

type PickInput = {
  id: string
  genre: string
  year: number | null
  title: string
  artwork?: string | null
  artist?: string
  genres?: string[]
  picker?: string
  createdAt?: string
  platformUrl?: string
}

interface GenrePopularityListProps {
  picks: PickInput[]
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function genreFamily(name: string) {
  if (!name || name.toLowerCase() === 'unknown') return 'Other / Unknown'
  const clean = name.toLowerCase()
  const checks: Array<[string, RegExp[]]> = [
    ['Rock', [/rock/, /psych/, /shoegaze/, /alt/, /indie/]],
    ['Metal', [/metal/, /doom/, /sludge/]],
    ['Pop', [/pop/, /synth/, /k-pop/, /dance pop/, /electropop/]],
    ['Electronic', [/electronic/, /edm/, /house/, /techno/, /trance/, /drum.*bass/, /dubstep/, /garage/]],
    ['Hip-Hop / Rap', [/hip ?hop/, /\brap\b/, /trap/, /grime/, /drill/]],
    ['R&B / Soul / Funk', [/r&b/, /soul/, /funk/, /disco/, /motown/]],
    ['Jazz / Blues', [/jazz/, /blues/]],
    ['Folk / Country', [/folk/, /country/, /americana/, /bluegrass/, /roots/, /singer/, /acoustic/]],
    ['Punk / Hardcore', [/punk/, /hardcore/, /emo/, /screamo/]],
    ['Classical / Score', [/classical/, /orchestral/, /score/, /soundtrack/, /ost/, /stage/, /broadway/]],
    ['Reggae / Dub / Ska', [/reggae/, /dub\b/, /ska/]],
    ['Latin', [/latin/, /reggaeton/, /salsa/, /cumbia/, /bachata/, /tango/]],
    ['World / Global', [/afro/, /afrobeats/, /world/, /balkan/, /celtic/, /fado/, /klezmer/]],
    ['Experimental / Ambient', [/experimental/, /ambient/, /drone/, /noise/, /industrial/, /post-rock/]],
  ]
  for (const [fam, regexes] of checks) {
    if (regexes.some((r) => r.test(clean))) return fam
  }
  // Fallback to first word.
  const firstWord = clean.replace(/[^a-z0-9\s-]/g, '').trim().split(/\s|-/)[0]
  return firstWord ? titleCase(firstWord) : 'Other / Unknown'
}

function normalizeArtistName(raw?: string | null) {
  const decoded = (raw || '')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s*\|\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const label = decoded || 'Unknown artist'
  const key = label.toLowerCase()
  return { key, label }
}

export function GenrePopularityList({ picks }: GenrePopularityListProps) {
  const genreStats = useMemo(() => {
    // Count all genres across picks (primary + alternates) to help cluster singletons.
    const allGenreCounts = new Map<string, number>()
    picks.forEach((p) => {
      const all = [p.genre, ...(p.genres || [])].filter(Boolean) as string[]
      all.forEach((g) => {
        allGenreCounts.set(g, (allGenreCounts.get(g) || 0) + 1)
      })
    })

    const map = new Map<
      string,
      { name: string; count: number; picks: PickInput[]; family: string }
    >()
    picks.forEach((p) => {
      const name = p.genre || 'Unknown'
      if (!map.has(name)) {
        map.set(name, { name, family: '', count: 0, picks: [] })
      }
      const entry = map.get(name)!
      entry.count += 1
      entry.picks.push(p)
    })

    const resolveFamily = (name: string, picksForGenre: PickInput[]) => {
      const defaultFam = genreFamily(name)
      if (picksForGenre.length > 1) return defaultFam
      // For singleton genres, look at alternate genres on the same pick(s) and choose the most common alt.
      const alt = picksForGenre
        .flatMap((p) => p.genres || [])
        .filter((g) => g.toLowerCase() !== name.toLowerCase())
      if (!alt.length) return defaultFam
      const bestAlt = alt.reduce(
        (best, curr) => {
          const freq = allGenreCounts.get(curr) || 0
          return freq > best.freq ? { genre: curr, freq } : best
        },
        { genre: '', freq: 0 },
      )
      return bestAlt.genre ? genreFamily(bestAlt.genre) : defaultFam
    }

    let entries = Array.from(map.values()).map((g) => {
      const family = resolveFamily(g.name, g.picks)
      return {
        ...g,
        family,
        picks: g.picks.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
      }
    })

    // Collapse very small families into Other / Misc to reduce clutter.
    const familyCounts = entries.reduce<Record<string, number>>((acc, g) => {
      acc[g.family] = (acc[g.family] || 0) + g.count
      return acc
    }, {})
    entries = entries.map((g) => ({
      ...g,
      family: familyCounts[g.family] < 3 ? 'Other / Misc' : g.family,
    }))

    return entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [picks])

  const familyStats = useMemo(() => {
    const map = new Map<string, { family: string; count: number }>()
    genreStats.forEach((g) => {
      if (!map.has(g.family)) map.set(g.family, { family: g.family, count: 0 })
      map.get(g.family)!.count += g.count
    })
    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.family.localeCompare(b.family),
    )
  }, [genreStats])

  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([])
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [excludedGenres, setExcludedGenres] = useState<string[]>([])
  const [excludedPickers, setExcludedPickers] = useState<string[]>([])
  const [showFamilyList, setShowFamilyList] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  const pickerCounts = useMemo(() => {
    const map = new Map<string, number>()
    picks.forEach((p) => {
      const name = p.picker || 'Unknown'
      map.set(name, (map.get(name) || 0) + 1)
    })
    return Array.from(map.entries()).map(([picker, count]) => ({ picker, count })).sort(
      (a, b) => b.count - a.count || a.picker.localeCompare(b.picker),
    )
  }, [picks])

  const visibleGenres = useMemo(() => {
    const filtered =
      selectedFamilies.length === 0
        ? genreStats
        : genreStats.filter((g) => selectedFamilies.includes(g.family))
    return filtered
  }, [genreStats, selectedFamilies])

  const sortByDate = (list: PickInput[]) =>
    [...list].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bTime - aTime
    })

  const selectedPicks = useMemo(() => {
    const isExcluded = (p: PickInput) => {
      const combinedGenres = [p.genre, ...(p.genres || [])].filter(Boolean) as string[]
      const genreBlocked = excludedGenres.length
        ? combinedGenres.some((g) => excludedGenres.includes(g))
        : false
      const pickerBlocked =
        excludedPickers.length && p.picker ? excludedPickers.includes(p.picker) : false
      return genreBlocked || pickerBlocked
    }

    if (selectedGenres.length > 0) {
      return sortByDate(
        genreStats
        .filter((g) => selectedGenres.includes(g.name))
        .flatMap((g) => g.picks)
        .filter((p) => !isExcluded(p)),
      )
    }
    const base =
      selectedFamilies.length === 0
        ? genreStats
        : genreStats.filter((g) => selectedFamilies.includes(g.family))
    const filtered = base.flatMap((g) => g.picks)
    return sortByDate(filtered.filter((p) => !isExcluded(p)))
  }, [genreStats, selectedFamilies, selectedGenres, excludedGenres, excludedPickers])

  const selectionLabel = useMemo(() => {
    if (selectedGenres.length > 0) {
      return selectedGenres.join(', ')
    }
    if (selectedFamilies.length > 0) {
      return selectedFamilies.join(', ')
    }
    return 'All albums'
  }, [selectedFamilies, selectedGenres])

  const exclusionLabel = useMemo(() => {
    const parts: string[] = []
    if (excludedPickers.length) {
      const who = excludedPickers.join(', ')
      parts.push(`excluding picks from ${who}`)
    }
    if (excludedGenres.length) {
      const gs = excludedGenres.join(', ')
      parts.push(`excluding genres ${gs}`)
    }
    return parts.join(' • ')
  }, [excludedGenres, excludedPickers])

  const clusterData = useMemo(() => {
    if (!selectedPicks.length) return null
    const maxNodes = Math.min(selectedPicks.length, 200)
    const padding = 24
    const cols = 10
    const spacing = 74
    const seen = new Set<string>()
    const nodes: Array<{
      x: number
      y: number
      title: string
      artist: string
      artwork?: string | null
      id: string
      shortArtist: string
    }> = []

    for (let idx = 0; idx < selectedPicks.length && nodes.length < maxNodes; idx++) {
      const p = selectedPicks[idx]
      const { label: artistName, key: artistKey } = normalizeArtistName(p.artist)
      const albumTitle = (p.title || p.album || 'Untitled').trim()
      const uniqueKey = `${artistKey}::${albumTitle.toLowerCase()}`
      if (seen.has(uniqueKey)) continue
      seen.add(uniqueKey)

      const col = nodes.length % cols
      const row = Math.floor(nodes.length / cols)
      const x = padding + col * spacing
      const y = padding + row * spacing

      const maxLabel = 14
      const shortArtist =
        artistName.length > maxLabel ? `${artistName.slice(0, maxLabel - 1)}…` : artistName

      nodes.push({
        x,
        y,
        title: albumTitle,
        artist: artistName,
        artwork: p.artwork,
        id: p.id,
        shortArtist,
        platformUrl: p.platformUrl,
      })
    }

    const width = padding * 2 + spacing * (cols - 1)
    const height = padding * 2 + spacing * (Math.ceil(maxNodes / cols) - 1 || 1)
    return { nodes, width, height }
  }, [selectedPicks])

  const overlayWidth = 240
  const contentOffsetClass = showFilters ? 'md:pl-[260px]' : ''

  const toggleFamily = (fam: string | null) => {
    if (fam === null) {
      setSelectedFamilies([])
      setSelectedGenres([])
      return
    }
    setSelectedFamilies((prev) =>
      prev.includes(fam) ? prev.filter((f) => f !== fam) : [...prev, fam],
    )
    setSelectedGenres([])
  }

  const toggleGenre = (name: string) => {
    setSelectedGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    )
  }

  const toggleExcludedGenre = (name: string) => {
    setExcludedGenres((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    )
  }

  const toggleExcludedPicker = (name: string) => {
    setExcludedPickers((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    )
  }

  const buildPayload = () => ({
    name: (() => {
      const parts = [`Album Club — ${selectionLabel}`]
      const excludes: string[] = []
      if (excludedPickers.length) excludes.push(`excluding picks from ${excludedPickers.join(', ')}`)
      if (excludedGenres.length) excludes.push(`excluding genres ${excludedGenres.join(', ')}`)
      if (excludes.length) parts.push(`[${excludes.join(' | ')}]`)
      return parts.join(' ')
    })(),
    picks: selectedPicks.map((p) => ({
      id: p.id,
      artist: p.artist,
      title: p.title,
      album: p.album,
      platform_url: p.platform_url,
    })),
  })

  async function createPlaylistFromPayload(payload: any, fromPending = false) {
    if (!payload?.picks?.length || isCreating) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/spotify/create-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          const msg = ((json.error as string) || '').toLowerCase()
          // If we already tried once after login, stop looping and prompt.
          if (fromPending) {
            sessionStorage.removeItem('pendingPlaylist')
            alert(json.error || 'Please connect Spotify and try again.')
            return
          }
          // Store payload and send user to Spotify login.
          sessionStorage.setItem('pendingPlaylist', JSON.stringify(payload))
          window.location.href = '/api/spotify/login'
          return
        }
        alert(json.error || 'Failed to create playlist')
        return
      }
      sessionStorage.removeItem('pendingPlaylist')
      if (json.playlist_url) {
        window.open(json.playlist_url, '_blank')
      } else {
        alert(`Created playlist with ${json.added} tracks`)
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create playlist')
    } finally {
      setIsCreating(false)
    }
  }

  async function createPlaylist() {
    const payload = buildPayload()
    await createPlaylistFromPayload(payload)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const pending = sessionStorage.getItem('pendingPlaylist')
    if (pending && !isCreating) {
      try {
        const payload = JSON.parse(pending)
        createPlaylistFromPayload(payload, true)
      } catch {
        sessionStorage.removeItem('pendingPlaylist')
      }
    }
  }, [isCreating])

  return (
    <div className="relative">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-md relative">
        {showFilters ? (
          <div
            className="absolute top-3 left-3 z-10 w-[240px] max-w-[70vw] rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg p-3 space-y-4"
          >
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Filters</span>
            {selectedFamilies.length > 0 && (
              <button
                className="text-xs text-foreground font-semibold underline"
                onClick={() => {
                  setSelectedFamilies([])
                  setSelectedGenres([])
                  setShowFamilyList(true)
                }}
              >
                Clear family
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {selectedFamilies.length ? `Families: ${selectedFamilies.length}` : 'Choose family'}
              </span>
              {selectedFamilies.length > 0 && (
                <button
                  className="text-xs text-foreground underline"
                  onClick={() => setShowFamilyList((v) => !v)}
                >
                  {showFamilyList ? 'Hide' : 'Change'}
                </button>
              )}
            </div>
            {showFamilyList && (
              <div className="space-y-1 mb-1">
                <button
                  className={`w-full rounded px-3 py-2 text-left transition ${
                    selectedFamilies.length === 0
                      ? 'bg-primary/10 text-foreground border border-primary/30'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => toggleFamily(null)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">All albums</span>
                  </div>
                </button>
              </div>
            )}
            {showFamilyList && (
              <div className="max-h-[30vh] overflow-y-auto pr-1 space-y-1">
                {familyStats.map((f) => (
                  <button
                    key={f.family}
                    className={`w-full rounded px-3 py-2 text-left transition ${
                      selectedFamilies.includes(f.family)
                        ? 'bg-primary/10 text-foreground border border-primary/30'
                        : 'hover:bg-muted text-foreground'
                    }`}
                    onClick={() => toggleFamily(f.family)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{f.family}</span>
                      <span className="text-xs text-muted-foreground">{f.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {selectedFamilies.length ? `Genres in ${selectedFamilies.join(', ')}` : 'Genres'}
              </span>
              {selectedGenres.length > 0 && (
                <button
                  className="text-xs text-foreground underline"
                  onClick={() => setSelectedGenres([])}
                >
                  Clear genre
                </button>
              )}
            </div>
            <div className="max-h-[40vh] overflow-y-auto pr-1 space-y-1">
              {visibleGenres.map((g) => (
                <button
                  key={g.name}
                  className={`w-full rounded px-3 py-2 text-left transition ${
                    selectedGenres.includes(g.name)
                      ? 'bg-primary/10 text-foreground border border-primary/30'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => toggleGenre(g.name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">{g.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Exclude genres</span>
              {excludedGenres.length > 0 && (
                <button
                  className="text-xs text-foreground underline"
                  onClick={() => setExcludedGenres([])}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-[30vh] overflow-y-auto pr-1 space-y-1">
              {genreStats.map((g) => (
                <button
                  key={`ex-${g.name}`}
                  className={`w-full rounded px-3 py-2 text-left transition ${
                    excludedGenres.includes(g.name)
                      ? 'bg-destructive/20 text-foreground border border-destructive/40'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => toggleExcludedGenre(g.name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">{g.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Exclude pickers</span>
              {excludedPickers.length > 0 && (
                <button
                  className="text-xs text-foreground underline"
                  onClick={() => setExcludedPickers([])}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-[30vh] overflow-y-auto pr-1 space-y-1">
              {pickerCounts.map((p) => (
                <button
                  key={`picker-${p.picker}`}
                  className={`w-full rounded px-3 py-2 text-left transition ${
                    excludedPickers.includes(p.picker)
                      ? 'bg-destructive/20 text-foreground border border-destructive/40'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => toggleExcludedPicker(p.picker)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.picker}</span>
                    <span className="text-xs text-muted-foreground">{p.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
            <div className="flex justify-end">
              <button
                className="text-xs text-foreground underline"
                onClick={() => setShowFilters(false)}
              >
                Hide filters
              </button>
            </div>
          </div>
        ) : (
          <button
            className="absolute top-3 left-3 z-10 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow"
            onClick={() => setShowFilters(true)}
          >
            Show filters
          </button>
        )}

        <div className={`mt-4 ${contentOffsetClass}`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg text-muted-foreground">Selected</div>
              <div className="text-4xl font-extrabold text-foreground">{selectionLabel}</div>
              {exclusionLabel && (
                <div className="text-sm text-muted-foreground font-semibold mt-1">
                  {exclusionLabel}
                </div>
              )}
            </div>
            {selectedPicks.length > 0 && (
              <div className="text-2xl font-semibold text-foreground">
                {selectedPicks.length} picks
              </div>
            )}
          </div>

          {clusterData ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-lg text-foreground font-semibold">
                <div className="flex items-center gap-3">
                  <span>
                    Showing {clusterData.nodes.length} of {selectedPicks.length} picks
                  </span>
                </div>
                {selectedPicks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={createPlaylist}
                      disabled={isCreating}
                      className={`rounded-full bg-primary text-black font-semibold px-4 py-2 text-sm transition ${
                        isCreating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-hover'
                      }`}
                    >
                      {isCreating ? 'Creating…' : 'Create Spotify playlist'}
                    </button>
                  </div>
                )}
              </div>

              <div className="relative border border-border/60 rounded-lg bg-background/60">
                <div className="w-full overflow-auto">
                  <svg
                    viewBox={`0 0 ${clusterData.width} ${clusterData.height}`}
                    className="block w-full h-full min-h-[320px]"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {clusterData.nodes.map((p) => (
                      <a
                        key={p.id}
                        href={p.platformUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="cursor-pointer"
                      >
                        <g transform={`translate(${p.x},${p.y})`}>
                          <circle
                            r={22}
                            fill="rgba(255,255,255,0.08)"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth={1}
                          />
                          <foreignObject x={-22} y={-22} width={44} height={44}>
                            <div className="relative h-[44px] w-[44px]" title={`${p.artist} — ${p.title}`}>
                              <div
                                className="absolute inset-0 rounded-full blur-md opacity-70"
                                style={{
                                  backgroundImage: p.artwork ? `url(${p.artwork})` : undefined,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  filter: 'blur(6px)',
                                  transform: 'scale(1.3)',
                                }}
                                aria-hidden="true"
                              />
                              <div
                                className="relative h-[44px] w-[44px] rounded-full border border-border/60 bg-muted bg-cover bg-center shadow transition-transform duration-300 hover:scale-105"
                                style={{ backgroundImage: p.artwork ? `url(${p.artwork})` : undefined }}
                              />
                            </div>
                          </foreignObject>
                          <text
                            x={0}
                            y={32}
                            textAnchor="middle"
                            className="text-[10px] fill-foreground/80 font-semibold pointer-events-none"
                          >
                            {p.shortArtist}
                          </text>
                        </g>
                      </a>
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No genre selected.</div>
          )}
        </div>
      </div>
    </div>
  )
}
