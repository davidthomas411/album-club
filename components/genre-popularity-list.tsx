'use client'

import React, { useMemo, useState } from 'react'

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

  const [selectedFamily, setSelectedFamily] = useState<string | null>(
    familyStats.length ? familyStats[0].family : null,
  )
  const [selectedGenre, setSelectedGenre] = useState<string | null>(
    genreStats.length ? genreStats[0].name : null,
  )
  const [showFamilyList, setShowFamilyList] = useState(true)

  const visibleGenres = useMemo(() => {
    const filtered = genreStats.filter((g) => (selectedFamily ? g.family === selectedFamily : true))
    if (!selectedFamily) {
      const allPicks = genreStats.flatMap((g) => g.picks)
      return [
        {
          name: 'All albums',
          family: 'All',
          count: allPicks.length,
          picks: allPicks.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
        },
        ...filtered,
      ]
    }
    const familyPicks = filtered.flatMap((g) => g.picks)
    const totalCount = familyPicks.length
    if (!totalCount) return filtered
    return [
      {
        name: `All ${selectedFamily}`,
        family: selectedFamily,
        count: totalCount,
        picks: familyPicks.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
      },
      ...filtered,
    ]
  }, [genreStats, selectedFamily])

  const selectedGenreEntry =
    visibleGenres.find((g) => g.name === selectedGenre) ||
    genreStats.find((g) => g.name === selectedGenre)
  const timelineData = useMemo(() => {
    if (!selectedGenreEntry || !selectedGenreEntry.picks.length) return null
    const picks = selectedGenreEntry.picks
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
  }, [selectedGenreEntry])

  const chartOffset = timelineData && timelineData.artists.length <= 10 ? '18rem' : '0'

  return (
    <div className="relative">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-md relative">
        <div className="absolute top-3 left-3 z-10 w-64 max-w-[70vw] rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg p-3 space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Filters</span>
            {selectedFamily && (
              <button
                className="text-xs text-foreground font-semibold underline"
                onClick={() => {
                  setSelectedFamily(null)
                  setSelectedGenre(null)
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
                {selectedFamily ? `Family: ${selectedFamily}` : 'Choose family'}
              </span>
              {selectedFamily && (
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
                    selectedFamily === null
                      ? 'bg-primary/10 text-foreground border border-primary/30'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => {
                    setSelectedFamily(null)
                    setSelectedGenre('All albums')
                  }}
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
                      selectedFamily === f.family
                        ? 'bg-primary/10 text-foreground border border-primary/30'
                        : 'hover:bg-muted text-foreground'
                    }`}
                    onClick={() => {
                      setSelectedFamily(f.family)
                      const firstGenre = visibleGenres.find((g) => g.family === f.family)
                      if (firstGenre) setSelectedGenre(firstGenre.name)
                      setShowFamilyList(false)
                    }}
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
                {selectedFamily ? `Genres in ${selectedFamily}` : 'Genres'}
              </span>
              {selectedGenre && (
                <button
                  className="text-xs text-foreground underline"
                  onClick={() => setSelectedGenre(null)}
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
                    selectedGenre === g.name
                      ? 'bg-primary/10 text-foreground border border-primary/30'
                      : 'hover:bg-muted text-foreground'
                  }`}
                  onClick={() => setSelectedGenre(g.name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">{g.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4" style={{ marginLeft: chartOffset }}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg text-muted-foreground">Selected genre</div>
              <div className="text-4xl font-extrabold text-foreground">{selectedGenre || '—'}</div>
            </div>
            {selectedGenreEntry && (
              <div className="text-2xl font-semibold text-foreground">
                {selectedGenreEntry.count} picks
              </div>
            )}
          </div>

          {selectedGenreEntry && timelineData ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
              <div className="mb-4 flex items-center justify-between text-lg text-foreground font-semibold">
                <span>Timeline (year vs artist)</span>
                <span>
                  Showing {timelineData.artists.length} of {timelineData.totalArtists} artists •{' '}
                  {timelineData.domainMin} – {timelineData.domainMax}
                </span>
              </div>

              <div className="grid grid-cols-[1fr_260px] gap-3">
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

                <div className="rounded-lg border border-border/60">
                  <div style={{ height: timelineData.canvasHeight, position: 'relative' }}>
                    {timelineData.artists.map((artist, idx) => {
                      const y =
                        timelineData.axisTop +
                        (timelineData.artists.length - 1 - idx) * timelineData.rowGap +
                        4
                      return (
                        <div
                          key={`label-${artist}`}
                          style={{ position: 'absolute', top: y - 12, left: 12 }}
                          className="text-[20px] font-extrabold text-foreground"
                        >
                          {artist}
                        </div>
                      )
                    })}
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
