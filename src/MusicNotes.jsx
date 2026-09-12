import { useMemo } from 'react'

/* glyphs — a mix of music notes and clefs */
const GLYPHS = ['♪', '♫', '♩', '♬', '♭', '♯', '𝄞', '𝄢', '𝄡']

/* colour palette pulled from the current track's hues */
const HUE_VARS = ['--h1', '--h2', '--h3']

export default function MusicNotes({ playing, count = 26 }) {
  /* one-time random seeding so positions don't jump on re-render */
  const notes = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      glyph:    GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      hueVar:   HUE_VARS[Math.floor(Math.random() * HUE_VARS.length)],
      size:     14 + Math.random() * 30,          // 14–44 px
      left:     6 + Math.random() * 88,           // 6–94 %
      drift:    (Math.random() - 0.5) * 120,      // ±60 px sideways
      duration: 7 + Math.random() * 6,            // 7–13 s
      delay:    -Math.random() * 13,              // negative → already mid-flight
      spin:     (Math.random() - 0.5) * 360,      // ±180° total rotation
      alpha:    0.35 + Math.random() * 0.5
    }))
  }, [])

  return (
    <div
      aria-hidden="true"
      className="
        pointer-events-none fixed inset-y-0 right-0 z-[5]
        w-[180px] overflow-hidden
        [mask-image:linear-gradient(to_top,transparent_0%,black_14%,black_86%,transparent_100%)]
        [-webkit-mask-image:linear-gradient(to_top,transparent_0%,black_14%,black_86%,transparent_100%)]
      "
    >
      {notes.map((n) => (
        <span
          key={n.id}
          style={{
            left: `${n.left}%`,
            fontSize: n.size,
            color: `hsl(var(${n.hueVar}) 100% 74%)`,
            '--tx': `${n.drift}px`,
            '--rot': `${n.spin}deg`,
            opacity: playing ? n.alpha : 0,
            animationName: 'notesRise',
            animationDuration: `${n.duration}s`,
            animationDelay: `${n.delay}s`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationPlayState: playing ? 'running' : 'paused',
            transition: 'opacity 400ms ease-out'
          }}
          className="
            absolute bottom-[-60px] select-none
            leading-none font-serif
            [text-shadow:0_0_14px_currentColor,0_0_4px_currentColor]
            will-change-transform
          "
        >
          {n.glyph}
        </span>
      ))}
    </div>
  )
}