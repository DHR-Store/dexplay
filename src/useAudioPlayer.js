import { useCallback, useEffect, useRef, useState } from 'react'
import { loadJSON, saveJSON } from './storage.js'

export default function useAudioPlayer(tracks) {
  const audioRef       = useRef(null)
  const ctxRef         = useRef(null)
  const sourceRef      = useRef(null)
  const gainRef        = useRef(null)
  const analyserRef    = useRef(null)
  const playingRef     = useRef(false)
  const pendingPlayRef = useRef(false)
  const blobUrlRef     = useRef(null)

  const tracksRef     = useRef(tracks)
  const trackIndexRef = useRef(0)
  const repeatRef     = useRef(false)
  const shuffleRef    = useRef(false)

  /* ---- restore persisted settings from localStorage ---- */
  const [trackIndex, setTrackIndex] = useState(() => {
    const saved = loadJSON('trackIndex')
    const idx = Number.isInteger(saved) ? saved : 0
    return idx >= 0 && idx < (tracks?.length || 0) ? idx : 0
  })
  const [playing, setPlaying]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [time, setTime]           = useState(0)
  const [duration, setDuration]   = useState(0)
  const [volume, setVolumeState]  = useState(() => {
    const v = loadJSON('volume')
    return typeof v === 'number' && v >= 0 && v <= 1 ? v : 0.78
  })
  const [shuffle, setShuffle] = useState(() => !!loadJSON('shuffle'))
  const [repeat,  setRepeat]  = useState(() => !!loadJSON('repeat'))
  const [error, setError]     = useState(null)

  const track = tracks[trackIndex]

  /* ---- persist on every change ---- */
  useEffect(() => { saveJSON('trackIndex', trackIndex) }, [trackIndex])
  useEffect(() => { saveJSON('volume',     volume)     }, [volume])
  useEffect(() => { saveJSON('shuffle',    shuffle)    }, [shuffle])
  useEffect(() => { saveJSON('repeat',     repeat)     }, [repeat])

  useEffect(() => { playingRef.current     = playing },     [playing])
  useEffect(() => { tracksRef.current      = tracks },      [tracks])
  useEffect(() => { trackIndexRef.current  = trackIndex },  [trackIndex])
  useEffect(() => { repeatRef.current      = repeat },      [repeat])
  useEffect(() => { shuffleRef.current     = shuffle },     [shuffle])

  /* ---- <audio> element ---- */
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.volume  = 1
    audioRef.current = audio

    const onMeta = () => setDuration(audio.duration || 0)
    const onTime = () => setTime(audio.currentTime)

    const onEnd = () => {
      setTime(0)
      const tl = tracksRef.current?.length || 0
      if (repeatRef.current || tl <= 1) {
        audio.currentTime = 0
        audio.play().catch(() => {})
        return
      }
      if (shuffleRef.current) {
        let n
        do { n = Math.floor(Math.random() * tl) }
        while (n === trackIndexRef.current && tl > 1)
        setTrackIndex(n)
      } else {
        setTrackIndex(i => (i + 1) % tl)
      }
    }

    const onErr = () => {
      const e = audio.error
      setError(e ? `Audio error: ${e.code}` : 'Failed to load audio')
      setPlaying(false)
    }

    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('error', onErr)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('error', onErr)
    }
  }, [])

  /* ---- load track.url → blob ---- */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!track?.url) {
      // restored track with an expired/removed URL — leave it idle
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setError(null)
    setLoading(true)
    setTime(0)
    setDuration(0)

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    fetch(track.url, { mode: 'cors' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`)
        return r.blob()
      })
      .then(blob => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        audio.src = url
        audio.load()
        setLoading(false)
        if (playingRef.current || pendingPlayRef.current) {
          pendingPlayRef.current = false
          audio.play()
            .then(() => { setPlaying(true); setError(null) })
            .catch(e => { setError(e.message || 'Playback blocked'); setPlaying(false) })
        }
      })
      .catch(e => {
        if (cancelled) return
        setError(`Failed to load: ${e.message}`)
        setLoading(false)
        setPlaying(false)
        pendingPlayRef.current = false
      })

    return () => { cancelled = true }
  }, [track?.url])

  /* ---- Web Audio graph ---- */
  const ensureGraph = useCallback(() => {
    if (ctxRef.current) return
    const audio = audioRef.current
    if (!audio) return

    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    try {
      const src = ctx.createMediaElementSource(audio)
      const gain = ctx.createGain()
      gain.gain.value = volume

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.78

      src.connect(gain)
      gain.connect(analyser)
      analyser.connect(ctx.destination)

      ctxRef.current      = ctx
      sourceRef.current   = src
      gainRef.current     = gain
      analyserRef.current = analyser
    } catch (_) {
      ctxRef.current = null
      setError('Visualizer unavailable in this browser')
    }
  }, [volume])

  const play = useCallback(async () => {
    ensureGraph()
    const ctx = ctxRef.current
    if (ctx && ctx.state === 'suspended') {
      try { await ctx.resume() } catch (_) {}
    }
    const audio = audioRef.current
    if (!audio) return

    if (!audio.src) {
      pendingPlayRef.current = true
      setPlaying(true)
      setError(null)
      return
    }
    try {
      await audio.play()
      setPlaying(true)
      setError(null)
      pendingPlayRef.current = false
    } catch (e) {
      setError(e.message || 'Cannot play')
      setPlaying(false)
      pendingPlayRef.current = false
    }
  }, [ensureGraph])

  const pause = useCallback(() => {
    pendingPlayRef.current = false
    audioRef.current && audioRef.current.pause()
    setPlaying(false)
  }, [])

  const toggle = useCallback(() => { playing ? pause() : play() }, [playing, pause, play])

  const next = useCallback(() => {
    const tl = tracksRef.current?.length || 0
    if (tl <= 1) return
    if (shuffleRef.current) {
      let n
      do { n = Math.floor(Math.random() * tl) }
      while (n === trackIndexRef.current && tl > 1)
      setTrackIndex(n)
    } else {
      setTrackIndex(i => (i + 1) % tl)
    }
  }, [])

  const prev = useCallback(() => {
    const a = audioRef.current
    if (a && a.currentTime > 4) { a.currentTime = 0; setTime(0); return }
    const tl = tracksRef.current?.length || 0
    if (tl <= 1) return
    if (shuffleRef.current) {
      let n
      do { n = Math.floor(Math.random() * tl) }
      while (n === trackIndexRef.current && tl > 1)
      setTrackIndex(n)
    } else {
      setTrackIndex(i => (i - 1 + tl) % tl)
    }
  }, [])

  const seek = useCallback((t) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Math.max(0, Math.min(duration || 0, t))
    setTime(a.currentTime)
  }, [duration])

  const setVolume = useCallback((v) => {
    const nv = Math.max(0, Math.min(1, v))
    setVolumeState(nv)
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setTargetAtTime(nv, ctxRef.current.currentTime, 0.02)
    }
  }, [])

  return {
    trackIndex, track, tracks,
    playing, loading, time, duration, volume,
    shuffle, repeat, error,
    analyserRef,
    play, pause, toggle, next, prev, seek, setVolume, setTrackIndex,
    toggleShuffle: () => setShuffle(s => !s),
    toggleRepeat:  () => setRepeat(r => !r)
  }
}