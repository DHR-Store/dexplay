import { useEffect, useRef } from 'react'
import Visualizer from './Visualizer.jsx'

const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

/* bar drag hook — toggles a `data-dragging` attr so Tailwind can style it */
function useBarDrag(onSet) {
  const ref = useRef(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const set = (e) => {
      const r = el.getBoundingClientRect()
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      onSet(f)
    }
    const onDown = (e) => {
      draggingRef.current = true
      el.dataset.dragging = 'true'
      try { el.setPointerCapture(e.pointerId) } catch (_) {}
      set(e)
    }
    const onMove = (e) => { if (draggingRef.current) set(e) }
    const onUp = () => {
      draggingRef.current = false
      delete el.dataset.dragging
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [onSet])

  return ref
}

/* shared classes for the seek + volume bar */
const BAR_BASE =
  'group/bar relative flex-1 h-1.5 rounded-full bg-white/[0.13] ' +
  'shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] cursor-pointer touch-none ' +
  'data-[dragging]:cursor-grabbing'

const BAR_FILL =
  'absolute left-0 top-0 bottom-0 rounded-full ' +
  'bg-[linear-gradient(90deg,hsl(var(--h1)_98%_68%),hsl(var(--h3)_98%_66%))] ' +
  'shadow-[0_0_14px_hsl(var(--h1)_100%_65%_/_0.6)]'

const BAR_KNOB =
  'pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ' +
  'h-3 w-3 rounded-full bg-white scale-0 ' +
  'transition-transform duration-200 ease-[cubic-bezier(.2,.9,.3,1)] ' +
  'shadow-[0_0_14px_hsl(var(--h1)_100%_70%),0_1px_3px_rgba(0,0,0,0.6)] ' +
  'group-hover/bar:scale-100 group-data-[dragging]/bar:scale-100'

const CTL_BASE =
  'grid place-items-center h-10 w-10 rounded-full ' +
  'border border-white/[0.16] text-white/[0.85] cursor-pointer ' +
  'bg-[linear-gradient(160deg,rgba(255,255,255,0.15),rgba(255,255,255,0.04))] ' +
  'backdrop-blur-[10px] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_18px_-10px_rgba(0,0,0,0.9)] ' +
  'transition-all duration-200 ease-out ' +
  'hover:-translate-y-0.5 hover:text-white ' +
  'hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08))] ' +
  'active:translate-y-0 active:scale-[0.93] [-webkit-tap-highlight-color:transparent] ' +
  '[&_svg]:h-4 [&_svg]:w-4'

export default function Player({
  track,
  tracks,
  trackIndex,
  playing,
  time,
  duration,
  volume,
  shuffle,
  repeat,
  error,
  analyserRef,
  toggle,
  next,
  prev,
  seek,
  setVolume,
  setTrackIndex,
  toggleShuffle,
  toggleRepeat
}) {
  const playerRef = useRef(null)

  const onPointerMove = (e) => {
    const el = playerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%')
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%')
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && e.target.tagName === 'INPUT') return
      if (e.code === 'Space') { e.preventDefault(); toggle() }
      if (e.code === 'ArrowRight') seek(time + 5)
      if (e.code === 'ArrowLeft')  seek(Math.max(0, time - 5))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, seek, time])

  const seekRef = useBarDrag((f) => seek(f * (duration || 0)))
  const volRef  = useBarDrag((f) => setVolume(f))

  const pct    = duration > 0 ? Math.min(100, (time / duration) * 100) : 0
  const volPct = volume * 100

  return (
    <main
      ref={playerRef}
      onPointerMove={onPointerMove}
      className="
        fixed left-0 top-0 z-30
        flex flex-col isolate overflow-hidden
        w-[min(330px,86vw)] h-[100dvh]
        rounded-r-[30px]
        border border-white/[0.16] border-l-0
        bg-[linear-gradient(160deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.05)_45%,rgba(255,255,255,0.09)_100%)]
        backdrop-blur-[34px] backdrop-saturate-[1.85]
        shadow-[26px_0_70px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.35),inset_-1px_0_0_rgba(255,255,255,0.10),inset_0_0_60px_rgba(255,255,255,0.03)]
        pt-[calc(26px_+_env(safe-area-inset-top))]
        px-5
        pb-[calc(20px_+_env(safe-area-inset-bottom))]
        animate-[slideIn_.8s_cubic-bezier(.2,.9,.25,1)_both]

        before:content-[''] before:absolute before:right-0 before:top-0 before:bottom-0
        before:w-px before:z-[5] before:pointer-events-none
        before:bg-[linear-gradient(180deg,rgba(255,255,255,0.45),rgba(255,255,255,0.06)_38%,rgba(255,255,255,0.04)_62%,rgba(255,255,255,0.30))]

        after:content-[''] after:absolute after:inset-0 after:rounded-[inherit]
        after:pointer-events-none after:z-[4] after:mix-blend-screen
        after:bg-[radial-gradient(300px_circle_at_var(--mx,50%)_var(--my,0%),rgba(255,255,255,0.18),transparent_62%)]
      "
    >
      {/* ---------- DISC / ALBUM ART ---------- */}
      <div className="relative flex justify-center shrink-0 pt-0.5 pb-3.5">
        {/* halo behind the disc */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     h-[150px] w-[150px] rounded-full blur-[26px]"
          style={{ background: 'radial-gradient(circle, hsl(var(--h2) 100% 60% / .55), transparent 68%)' }}
        />

        {/* disc */}
        <div
          className="
            relative h-32 w-32 rounded-full overflow-hidden
            saturate-[1.15]
            shadow-[0_0_60px_hsl(var(--h2)_95%_55%_/_0.45),inset_0_0_50px_rgba(0,0,0,0.42)]
          "
          style={{ animation: playing ? 'spin 22s linear infinite' : 'none' }}
        >
          {/* gradient base — always rendered so the colour bleeds through transparent PNGs */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 30% 26%, hsl(var(--h1) 100% 74% / .95), transparent 58%),' +
                'conic-gradient(from 0deg,' +
                  'hsl(var(--h1) 96% 58%),' +
                  'hsl(var(--h2) 96% 55%),' +
                  'hsl(var(--h3) 96% 62%),' +
                  'hsl(var(--h2) 96% 50%),' +
                  'hsl(var(--h1) 96% 58%))'
            }}
          />

          {/* album art (thumbnail) */}
          {track?.thumb && (
            <img
              src={track.thumb}
              alt=""
              draggable="false"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* soft darkening + inner shadow so the label text stays legible */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full
                       bg-[radial-gradient(circle_at_50%_50%,transparent_38%,rgba(0,0,0,0.55)_100%)]
                       shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"
          />

          {/* centre hole */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                       h-7 w-7 rounded-full bg-[rgba(7,9,15,0.88)]
                       shadow-[inset_0_0_12px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.14)]"
          />

          {/* specular sheen over everything */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full mix-blend-screen
                       bg-[radial-gradient(circle_at_34%_24%,rgba(255,255,255,0.5),transparent_44%)]"
          />
        </div>
      </div>

      {/* ---------- META ---------- */}
      <div className="shrink-0 min-w-0 text-center mb-0.5">
        <h1
          title={track.title}
          className="text-[18px] font-[620] tracking-[-0.015em] text-white
                     truncate [text-shadow:0_1px_20px_rgba(0,0,0,0.5)]"
        >
          {track.title}
        </h1>
        <p
          title={track.artist}
          className="mt-[3px] text-[11px] uppercase tracking-[0.06em] text-white/50 truncate"
        >
          {track.artist}
        </p>
      </div>

      <Visualizer analyserRef={analyserRef} playing={playing} />

      {/* ---------- SEEK ---------- */}
      <div className="flex items-center gap-2.5 text-[10.5px] tabular-nums tracking-[0.03em] text-white/55 shrink-0">
        <span>{fmt(time)}</span>
        <div ref={seekRef} role="slider" aria-label="Seek" className={BAR_BASE}>
          <div className={BAR_FILL} style={{ width: pct + '%' }} />
          <div className={BAR_KNOB} style={{ left: pct + '%' }} />
        </div>
        <span>{fmt(duration)}</span>
      </div>

      {/* ---------- CONTROLS ---------- */}
      <div className="flex items-center justify-center gap-2.5 my-[18px] shrink-0">
        <button
          onClick={toggleShuffle}
          title="Shuffle"
          aria-label="Shuffle"
          className={
            CTL_BASE +
            (shuffle
              ? ' text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_0_1px_hsl(var(--h1)_100%_70%_/_0.55),0_0_20px_hsl(var(--h1)_100%_62%_/_0.55)]'
              : '')
          }
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5" /><path d="M4 20 21 3" />
            <path d="M21 16v5h-5" /><path d="m15 15 6 6" /><path d="m4 4 5 5" />
          </svg>
        </button>

        <button onClick={prev} title="Previous" aria-label="Previous" className={CTL_BASE}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h2.2v14H6zM19 5.6v12.8L9.8 12z" />
          </svg>
        </button>

        {/* ---------- MAIN PLAY / PAUSE ---------- */}
        <button
          onClick={toggle}
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause' : 'Play'}
          className="
            grid place-items-center h-[58px] w-[58px] rounded-full cursor-pointer
            border border-white/50 text-[#0a0c14]
            bg-[linear-gradient(150deg,hsl(var(--h1)_100%_74%),hsl(var(--h3)_96%_58%))]
            shadow-[inset_0_2px_6px_rgba(255,255,255,0.65),inset_0_-7px_14px_rgba(0,0,0,0.22),0_12px_34px_-10px_hsl(var(--h2)_100%_60%_/_0.9),0_0_46px_-6px_hsl(var(--h1)_100%_64%_/_0.7)]
            transition-transform duration-200 ease-out
            hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.93]
            [&_svg]:h-[22px] [&_svg]:w-[22px]
          "
        >
          {playing ? (
            /* pause */
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6.8" y="4.8" width="3.7" height="14.4" rx="1.5" />
              <rect x="13.5" y="4.8" width="3.7" height="14.4" rx="1.5" />
            </svg>
          ) : (
            /* play */
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8.2 4.9v14.2L19.4 12z" />
            </svg>
          )}
        </button>

        <button onClick={next} title="Next" aria-label="Next" className={CTL_BASE}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.8 5H18v14h-2.2zM5 5.6v12.8L14.2 12z" />
          </svg>
        </button>

        <button
          onClick={toggleRepeat}
          title="Repeat"
          aria-label="Repeat"
          className={
            CTL_BASE +
            (repeat
              ? ' text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_0_1px_hsl(var(--h1)_100%_70%_/_0.55),0_0_20px_hsl(var(--h1)_100%_62%_/_0.55)]'
              : '')
          }
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
      </div>

      {/* ---------- VOLUME ---------- */}
      <div className="flex items-center gap-2.5 px-1 text-white/60 shrink-0">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 opacity-85">
          <path d="M11 5 6.6 9H3v6h3.6L11 19z" />
          <path d="M15 8.6a5 5 0 0 1 0 6.8" stroke="currentColor" strokeWidth="1.8"
                fill="none" strokeLinecap="round" />
          <path d="M18 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8"
                fill="none" strokeLinecap="round" />
        </svg>
        <div
          ref={volRef}
          role="slider"
          aria-label="Volume"
          className={BAR_BASE + ' !h-1'}
        >
          <div className={BAR_FILL} style={{ width: volPct + '%' }} />
          <div className={BAR_KNOB} style={{ left: volPct + '%' }} />
        </div>
      </div>

      {/* ---------- PLAYLIST ---------- */}
      <ul
        className="
          flex flex-col gap-0.5 flex-1 min-h-16 overflow-y-auto
          mt-4 -mx-1.5 px-1.5 pt-2.5 pb-1
          border-t border-white/10
          [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]
          [&::-webkit-scrollbar]:w-[5px]
          [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full
        "
      >
        {tracks.map((t, i) => {
          const active = i === trackIndex
          return (
            <li
              key={t.id || i}
              onClick={() => setTrackIndex(i)}
              className={[
                'flex items-center gap-2.5 px-2 py-1.5 rounded-[13px]',
                'text-[12px] cursor-pointer border border-transparent shrink-0',
                'transition-all duration-200 [-webkit-tap-highlight-color:transparent]',
                active
                  ? 'text-white border-white/[0.16] ' +
                    'bg-[linear-gradient(100deg,hsl(var(--h1)_100%_70%_/_0.22),hsl(var(--h3)_100%_65%_/_0.12))] ' +
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_20px_-8px_hsl(var(--h1)_100%_65%_/_0.8)]'
                  : 'text-white/[0.62] hover:bg-white/[0.08] hover:text-white/[0.92]'
              ].join(' ')}
            >
              {/* mini thumbnail */}
              <span
                className={[
                  'relative h-7 w-7 shrink-0 rounded-md overflow-hidden',
                  'ring-1 ring-white/15 bg-black/50'
                ].join(' ')}
              >
                {t.thumb && (
                  <img
                    src={t.thumb}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                    className="h-full w-full object-cover"
                  />
                )}
              </span>

              <span className="flex-1 truncate">{t.title}</span>
              <span className="shrink-0 text-[10px] opacity-50">
                {active && playing ? '▶' : '—'}
              </span>
            </li>
          )
        })}
      </ul>

      {error && (
        <div
          role="alert"
          className="shrink-0 mt-2 px-2.5 py-1.5 rounded-[10px] text-[11px] text-rose-200
                     bg-rose-500/[0.08] border border-rose-400/20"
        >
          {error}
        </div>
      )}
    </main>
  )
}