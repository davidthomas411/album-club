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
  const [showFamilyList, setShowFamilyList] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  const visibleGenres = useMemo(() => {
    const filtered =
      selectedFamilies.length === 0
        ? genreStats
        : genreStats.filter((g) => selectedFamilies.includes(g.family))
    return filtered
  }, [genreStats, selectedFamilies])

  const selectedPicks = useMemo(() => {
    if (selectedGenres.length > 0) {
      return genreStats
        .filter((g) => selectedGenres.includes(g.name))
        .flatMap((g) => g.picks)
    }
    const base =
      selectedFamilies.length === 0
        ? genreStats
        : genreStats.filter((g) => selectedFamilies.includes(g.family))
    return base.flatMap((g) => g.picks)
  }, [genreStats, selectedFamilies, selectedGenres])

  const selectionLabel = useMemo(() => {
    if (selectedGenres.length > 0) {
      return selectedGenres.join(', ')
    }
    if (selectedFamilies.length > 0) {
      return selectedFamilies.join(', ')
    }
    return 'All albums'
  }, [selectedFamilies, selectedGenres])
  const timelineData = useMemo(() => {
    if (!selectedPicks.length) return null
    const picks = selectedPicks
    const years = picks.map((p) => p.year).filter((y): y is number => !!y)
    const minY = years.length ? Math.min(...years) : 1990
    const maxY = years.length ? Math.max(...years) : 2025
    const pad = Math.max(1, Math.round((maxY - minY) * 0.05))
    const domainMin = minY - pad
    const domainMax = maxY + pad
    const artistMinYear = new Map<string, { label: string; year: number }>()
    picks.forEach((p) => {
      const { key, label } = normalizeArtistName(p.artist)
      const yr = p.year ?? maxY
      const current = artistMinYear.get(key)
      if (!current || yr < current.year) artistMinYear.set(key, { label, year: yr })
    })
    const artists = Array.from(artistMinYear.values())
      .sort((a, b) => (a.year ?? maxY) - (b.year ?? maxY) || a.label.localeCompare(b.label))
      .map((a) => a.label)
    const totalArtists = artists.length
    const rowGap = 48
    const axisTop = 10
    const axisBottomPad = 34
    const canvasHeight = Math.max(320, artists.length * rowGap + axisBottomPad + axisTop)
    const visibleHeight =
      artists.length <= 3
        ? Math.max(240, axisTop + rowGap * Math.max(3, artists.length) + axisBottomPad + 40)
        : Math.min(canvasHeight, axisTop + rowGap * 10 + axisBottomPad + 40)
    const spanYears = Math.max(1, domainMax - domainMin)
    const centerYears =
      spanYears <= 2
        ? { min: domainMin - 1, max: domainMax + 1 }
        : { min: domainMin, max: domainMax }
    const effectiveSpan = centerYears.max - centerYears.min
    const canvasWidth = Math.max(760, Math.min(1200, 22 * effectiveSpan))
    const leftPad = 80
    const rightPad = 80
    const usableWidth = canvasWidth - leftPad - rightPad
    const logDenom = Math.log(spanYears + 1)

    const points = picks.map((p) => {
      const { label: artistName } = normalizeArtistName(p.artist)
      const yIdx = artists.indexOf(artistName)
      if (yIdx === -1) return null
      const yOffset = artists.length <= 10 ? (visibleHeight - canvasHeight) / 2 : 0
      const y = axisTop + (artists.length - 1 - yIdx) * rowGap + 4 + yOffset // oldest at bottom
      const year = p.year ?? minY
      const logT =
        logDenom > 0
          ? Math.log(Math.max(0, year - centerYears.min) + 1) /
            Math.log(Math.max(1, centerYears.max - centerYears.min) + 1)
          : 0.5
      const t = Math.min(1, Math.max(0, logT))
      const x = leftPad + t * usableWidth
      return {
        x,
        y,
        title: p.title,
        artist: artistName,
        year,
        artwork: p.artwork,
      }
    }).filter(Boolean) as {
      x: number
      y: number
      title: string
      artist: string
      year: number
      artwork?: string | null
    }[]

    return {
      canvasHeight,
      canvasWidth,
      leftPad,
      rightPad,
      axisTop,
      axisBottomPad,
      domainMin,
      domainMax,
      artists,
      totalArtists,
      rowGap,
      visibleHeight,
      points,
    }
  }, [selectedPicks])

  const overlayWidth = 240
  const contentOffset = showFilters ? `${overlayWidth + 16}px` : '0'

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

  const buildPayload = () => ({
    name: `Album Club — ${selectionLabel}`,
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
            className="absolute top-3 left-3 z-10 w-[240px] max-w-[70vw] rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg p-3 space-y-3"
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

          <div className="space-y-2">
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

        <div className="mt-4" style={{ paddingLeft: contentOffset }}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg text-muted-foreground">Selected</div>
              <div className="text-4xl font-extrabold text-foreground">{selectionLabel}</div>
            </div>
            {selectedPicks.length > 0 && (
              <div className="text-2xl font-semibold text-foreground">
                {selectedPicks.length} picks
              </div>
            )}
          </div>

          {timelineData ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-lg text-foreground font-semibold">
                <div className="flex items-center gap-3">
                  <span>Timeline (year vs artist)</span>
                  <span>
                    Showing {timelineData.artists.length} of {timelineData.totalArtists} artists •{' '}
                    {timelineData.domainMin} – {timelineData.domainMax}
                  </span>
                </div>
                {selectedPicks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={createPlaylist}
                      className="rounded-full bg-primary text-black font-semibold px-4 py-2 text-sm hover:bg-primary-hover transition"
                    >
                      Create Spotify playlist
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-[1fr_300px] gap-6 items-start">
                <div className="relative border border-border/60 rounded-lg">
                  <svg width={timelineData.canvasWidth} height={timelineData.canvasHeight} className="block">
                    <line
                      x1={timelineData.leftPad}
                      x2={timelineData.canvasWidth - timelineData.rightPad}
                      y1={timelineData.canvasHeight - timelineData.axisBottomPad}
                      y2={timelineData.canvasHeight - timelineData.axisBottomPad}
                      stroke="rgba(255,255,255,0.2)"
                    />
                    <text
                      x={timelineData.leftPad}
                      y={timelineData.canvasHeight - timelineData.axisBottomPad + 16}
                      className="text-[20px] font-extrabold fill-foreground"
                    >
                      {timelineData.domainMin}
                    </text>
                    <text
                      x={timelineData.canvasWidth - timelineData.rightPad}
                      y={timelineData.canvasHeight - timelineData.axisBottomPad + 16}
                      textAnchor="end"
                      className="text-[20px] font-extrabold fill-foreground"
                    >
                      {timelineData.domainMax}
                    </text>

                    {timelineData.artists.map((artist, idx) => {
                      const y =
                        timelineData.axisTop +
                        (timelineData.artists.length - 1 - idx) * timelineData.rowGap +
                        4
                      return (
                        <line
                          key={`grid-${artist}`}
                          x1={timelineData.leftPad}
                          x2={timelineData.canvasWidth - timelineData.rightPad}
                          y1={y}
                          y2={y}
                          stroke="rgba(255,255,255,0.06)"
                        />
                      )
                    })}

                    {timelineData.points.map((p, idx) => (
                      <g key={`${p.artist}-${p.title}-${idx}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={18}
                          fill="rgba(255,255,255,0.08)"
                          stroke="rgba(255,255,255,0.3)"
                          strokeWidth={1}
                        />
                        <foreignObject x={p.x - 18} y={p.y - 18} width={36} height={36}>
                          <div
                            className="h-[36px] w-[36px] rounded-full border border-border/60 bg-muted bg-cover bg-center shadow"
                            style={{ backgroundImage: p.artwork ? `url(${p.artwork})` : undefined }}
                            title={`${p.artist} — ${p.title}${p.year ? ` (${p.year})` : ''}`}
                          />
                        </foreignObject>
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="rounded-lg border border-border/60 p-3">
                  <div className="space-y-3">
                    {timelineData.artists.map((artist, idx) => (
                      <div key={`label-${artist}`} className="text-[18px] font-extrabold text-foreground">
                        {artist}
                      </div>
                    ))}
                  </div>
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
