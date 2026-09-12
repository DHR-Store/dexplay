import { useCallback, useEffect, useRef, useState } from 'react'
import Player from './Player.jsx'
import Wallpaper from './Wallpaper.jsx'
import SearchPanel from './SearchPanel.jsx'
import WallpaperPicker from './WallpaperPicker.jsx'
import ProfileAvatar from './ProfileAvatar.jsx'
import MusicNotes from './MusicNotes.jsx'
import useAudioPlayer from './useAudioPlayer.js'
import { TRACKS as INITIAL_TRACKS } from './tracks.js'
import { searchYouTube, resolveTrack } from './youtubeApi.js'
import { loadJSON, saveJSON, loadBlob, saveBlob, removeBlob } from './storage.js'

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>\")"

const VIGNETTE =
  'radial-gradient(120% 90% at 62% 45%, transparent 40%, rgba(0,0,0,.62) 100%),' +
  'linear-gradient(180deg, rgba(0,0,0,.25), transparent 35%, transparent 70%, rgba(0,0,0,.35))'

function huesFromTitle(title) {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0
  const a = Math.abs(h)
  const base = a % 360
  return [
    base,
    (base + 55 + (a % 40)) % 360,
    (base + 130 + ((a >> 8) % 60)) % 360
  ]
}

const GENRE_BATCH     = 10
const GENRE_MIN_AHEAD = 3

export default function App() {
  const [tracks, setTracks] = useState(() => {
    const saved = loadJSON('tracks')
    return Array.isArray(saved) && saved.length ? saved : INITIAL_TRACKS
  })
  const [autoplayIndex, setAutoplayIndex] = useState(null)

  const [wallSource, setWallSource] = useState(null)
  const [profileSrc, setProfileSrc] = useState(null)

  const prevUrlRef        = useRef(null)
  const prevProfileUrlRef = useRef(null)
  const inflightRef       = useRef(new Set())
  const genreStateRef     = useRef(new Map())

  const player = useAudioPlayer(tracks)

  /* ---- persist tracks ---- */
  useEffect(() => {
    saveJSON('tracks', tracks)
  }, [tracks])

  /* ---- restore wallpaper blob on mount ---- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const blob = await loadBlob('wallpaper')
      if (cancelled || !blob) return
      const meta = loadJSON('wallpaperMeta') || {}
      const url = URL.createObjectURL(blob)
      prevUrlRef.current = url
      setWallSource({ url, kind: meta.kind || 'image', name: meta.name || '' })
    })()
    return () => { cancelled = true }
  }, [])

  /* ---- restore profile blob on mount ---- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const blob = await loadBlob('profile')
      if (cancelled || !blob) return
      const url = URL.createObjectURL(blob)
      prevProfileUrlRef.current = url
      setProfileSrc(url)
    })()
    return () => { cancelled = true }
  }, [])

  /* ---------- genre prefetch ---------- */
  const prefetchGenre = useCallback(async (query, { force = false } = {}) => {
    const q = (query || '').trim()
    if (!q) return

    let st = genreStateRef.current.get(q)
    if (!st) {
      st = { ids: new Set(), lastAt: 0 }
      genreStateRef.current.set(q, st)
    }
    const now = Date.now()
    if (!force && now - st.lastAt < 4000) return
    st.lastAt = now

    let items
    try { items = await searchYouTube(q) }
    catch (_) { return }

    const fresh = items.filter(
      (it) => !st.ids.has(it.id) && !inflightRef.current.has(it.id)
    )
    const batch = fresh.slice(0, GENRE_BATCH)
    if (!batch.length) return

    for (const item of batch) {
      st.ids.add(item.id)
      inflightRef.current.add(item.id)
      try {
        const t = await resolveTrack(item)
        setTracks((prev) => {
          if (prev.some((x) => x.id === t.id)) return prev
          return [...prev, { ...t, hues: huesFromTitle(t.title), query: q }]
        })
      } catch (_) {}
      finally { inflightRef.current.delete(item.id) }
    }
  }, [])

  /* ---------- user adds a search result ---------- */
  const handleAdd = useCallback((incoming) => {
    const newTrack = { ...incoming, hues: huesFromTitle(incoming.title || 'untitled') }
    let newIndex = 0
    setTracks((prev) => {
      newIndex = prev.length
      return [...prev, newTrack]
    })
    setAutoplayIndex(newIndex)
    player.setTrackIndex(newIndex)
    if (incoming.query) prefetchGenre(incoming.query, { force: true })
  }, [player.setTrackIndex, prefetchGenre])

  /* autoplay after adding */
  useEffect(() => {
    if (autoplayIndex === null) return
    if (player.trackIndex !== autoplayIndex) return
    if (player.loading) return
    if (!player.playing) player.play()
    setAutoplayIndex(null)
  }, [
    autoplayIndex,
    player.trackIndex,
    player.loading,
    player.playing,
    player.play
  ])

  /* genre top-up */
  const currentTrack = player.track
  useEffect(() => {
    if (!player.playing) return
    const q = currentTrack?.query
    if (!q) return
    let ahead = 0
    for (let i = player.trackIndex + 1; i < tracks.length; i++) {
      if (tracks[i].query === q) ahead++
    }
    if (ahead < GENRE_MIN_AHEAD) prefetchGenre(q)
  }, [
    player.playing,
    player.trackIndex,
    tracks,
    currentTrack?.query,
    prefetchGenre
  ])

  /* ---------- wallpaper handlers ---------- */
  const handleWallPick = useCallback(async (file) => {
    if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current)
    const kind = file.type.startsWith('video/') ? 'video' : 'image'
    const url  = URL.createObjectURL(file)
    prevUrlRef.current = url
    setWallSource({ url, kind, name: file.name })
    saveJSON('wallpaperMeta', { kind, name: file.name })
    await saveBlob('wallpaper', file)
  }, [])

  const handleWallClear = useCallback(async () => {
    if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current)
    prevUrlRef.current = null
    setWallSource(null)
    saveJSON('wallpaperMeta', null)
    await removeBlob('wallpaper')
  }, [])

  /* ---------- avatar handlers ---------- */
  const handleProfilePick = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) return
    if (prevProfileUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevProfileUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    prevProfileUrlRef.current = url
    setProfileSrc(url)
    await saveBlob('profile', file)
  }, [])

  const handleProfileClear = useCallback(async () => {
    if (prevProfileUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevProfileUrlRef.current)
    }
    prevProfileUrlRef.current = null
    setProfileSrc(null)
    await removeBlob('profile')
  }, [])

  /* revoke blobs on unmount */
  useEffect(() => () => {
    if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current)
    if (prevProfileUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevProfileUrlRef.current)
    }
  }, [])

  return (
    <>
      <Wallpaper
        src={wallSource?.url || null}
        kind={wallSource?.kind || null}
        hues={player.track.hues}
        analyserRef={player.analyserRef}
        playing={player.playing}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{ background: VIGNETTE }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[2] opacity-[0.18] mix-blend-overlay bg-[length:220px_220px]"
        style={{ backgroundImage: NOISE }}
      />

      <MusicNotes playing={player.playing} count={26} />

      <div className="pointer-events-none fixed top-5 right-5 z-40">
        <ProfileAvatar
          src={profileSrc}
          onPick={handleProfilePick}
          onClear={handleProfileClear}
          hasCustom={!!profileSrc}
          trackTitle={player.track?.title}
          trackArtist={player.track?.artist}
          defaultSrc="./IMG_20241218_223942.jpg"
        />
      </div>

      <Player {...player} />
      <SearchPanel onAdd={handleAdd} />
      <WallpaperPicker
        onPick={handleWallPick}
        onClear={handleWallClear}
        hasCustom={!!wallSource}
      />
    </>
  )
}