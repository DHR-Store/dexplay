import { useEffect, useRef, useState } from 'react'
import { loadJSON, saveJSON } from './storage.js'

/* SVG fallback — used only if the default JPG fails to load */
const SVG_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>
       <defs>
         <linearGradient id='g1' x1='0' y1='0' x2='1' y2='1'>
           <stop offset='0'   stop-color='hsl(318 96% 68%)'/>
           <stop offset='0.5' stop-color='hsl(262 96% 62%)'/>
           <stop offset='1'   stop-color='hsl(200 96% 62%)'/>
         </linearGradient>
         <radialGradient id='g2' cx='0.5' cy='0.45' r='0.55'>
           <stop offset='0'   stop-color='white' stop-opacity='0.45'/>
           <stop offset='1'   stop-color='white' stop-opacity='0'/>
         </radialGradient>
       </defs>
       <rect width='200' height='200' fill='url(%23g1)'/>
       <circle cx='100' cy='100' r='100' fill='url(%23g2)'/>
       <circle cx='100' cy='82'  r='34' fill='rgba(10,12,20,0.55)'/>
       <path d='M34 200 Q34 132 100 132 Q166 132 166 200 Z' fill='rgba(10,12,20,0.55)'/>
       <circle cx='100' cy='82'  r='34' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='1.5'/>
     </svg>`
  )

/* built-in default profile picture served from /public */
const DEFAULT_PHOTO = './IMG_20241218_223942.jpg'

export default function ProfileAvatar({
  src,
  onPick,
  onClear,
  hasCustom,
  trackTitle,
  trackArtist,
  defaultSrc = DEFAULT_PHOTO
}) {
  const fileRef = useRef(null)
  const [open, setOpen]         = useState(false)
  const [viewerOpen, setViewer] = useState(false)
  const [name, setName]         = useState(() => loadJSON('userName') || 'Listener')
  const [editing, setEditing]   = useState(false)
  const [imgErr, setImgErr]     = useState(false)

  /* what actually gets rendered */
  const displaySrc = (hasCustom && src)
    ? src
    : (imgErr ? SVG_FALLBACK : (defaultSrc || SVG_FALLBACK))

  /* persist name */
  useEffect(() => { saveJSON('userName', name) }, [name])

  /* reset error state when the source changes */
  useEffect(() => { setImgErr(false) }, [src, defaultSrc])

  /* Escape closes whichever layer is open */
  useEffect(() => {
    if (!open && !viewerOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (viewerOpen) { setViewer(false); return }
      setOpen(false); setEditing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, viewerOpen])

  const closeModal  = () => { setOpen(false); setEditing(false) }
  const closeViewer = () => setViewer(false)

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) onPick(f)
    e.target.value = ''
  }

  const openFilePicker = () => fileRef.current && fileRef.current.click()

  const handleReset = () => {
    if (typeof onClear === 'function') onClear()
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFile}
      />

      {/* ---------- avatar button (top-right) ---------- */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open profile"
        aria-label="Open profile"
        className="
          pointer-events-auto group relative z-40
          h-14 w-14 shrink-0 rounded-full
          cursor-pointer transition-transform duration-300 ease-out
          hover:scale-105 active:scale-95
          [-webkit-tap-highlight-color:transparent]
        "
      >
        <span
          aria-hidden
          className="
            absolute inset-0 rounded-full opacity-90 blur-[1.5px]
            bg-[conic-gradient(from_0deg,
              hsl(var(--h1)_100%_72%),
              hsl(var(--h2)_100%_66%),
              hsl(var(--h3)_100%_70%),
              hsl(var(--h2)_100%_66%),
              hsl(var(--h1)_100%_72%))]
          "
        />
        <span
          aria-hidden
          className="absolute inset-[2px] rounded-full
                     ring-1 ring-white/35
                     shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
        />
        <span className="absolute inset-[3px] rounded-full overflow-hidden bg-black/70">
          <img
            src={displaySrc}
            alt=""
            onError={() => setImgErr(true)}
            className="h-full w-full object-cover"
          />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[3px] rounded-full
                     bg-[radial-gradient(circle_at_32%_22%,rgba(255,255,255,0.55),transparent_46%)]
                     mix-blend-screen"
        />
      </button>

      {/* ---------- profile modal ---------- */}
      {open && (
        <div
          className="pointer-events-auto fixed inset-0 z-[60] grid place-items-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile"
        >
          <div
            onClick={closeModal}
            className="absolute inset-0 z-0 bg-black/60 backdrop-blur-xl"
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className="
              relative z-10
              w-[min(340px,100%)]
              rounded-[28px] overflow-hidden
              border border-white/20
              bg-gradient-to-br from-white/[0.16] via-white/[0.06] to-white/[0.10]
              backdrop-blur-3xl backdrop-saturate-[1.9]
              shadow-[0_30px_80px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.35)]
              animate-[searchIn_.4s_cubic-bezier(.2,.9,.25,1)_both]
            "
          >
            {/* close */}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close profile"
              title="Close"
              className="
                absolute right-3 top-3 z-20
                grid place-items-center h-8 w-8 rounded-full
                border border-white/15 bg-white/[0.06] text-white/70
                transition-colors duration-200
                hover:bg-white/[0.18] hover:text-white active:scale-90
                [-webkit-tap-highlight-color:transparent]
              "
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="h-3.5 w-3.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* big avatar — click for full-size */}
            <div className="flex justify-center pt-8 pb-3">
              <button
                type="button"
                onClick={() => setViewer(true)}
                title="View full-size photo"
                aria-label="View full-size photo"
                className="
                  relative h-32 w-32 rounded-full cursor-zoom-in
                  transition-transform duration-200
                  hover:scale-[1.03] active:scale-100
                  [-webkit-tap-highlight-color:transparent]
                  group/avatar
                "
              >
                <span
                  aria-hidden
                  className="
                    absolute inset-0 rounded-full opacity-90 blur-[2px]
                    bg-[conic-gradient(from_0deg,
                      hsl(var(--h1)_100%_72%),
                      hsl(var(--h2)_100%_66%),
                      hsl(var(--h3)_100%_70%),
                      hsl(var(--h2)_100%_66%),
                      hsl(var(--h1)_100%_72%))]
                  "
                />
                <span
                  aria-hidden
                  className="absolute inset-[3px] rounded-full
                             ring-1 ring-white/35
                             shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                />
                <span className="absolute inset-[4px] rounded-full overflow-hidden bg-black/70">
                  <img
                    src={displaySrc}
                    alt=""
                    onError={() => setImgErr(true)}
                    className="h-full w-full object-cover"
                  />
                </span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-[4px] rounded-full
                             bg-[radial-gradient(circle_at_32%_22%,rgba(255,255,255,0.55),transparent_46%)]
                             mix-blend-screen"
                />
                <span
                  aria-hidden
                  className="
                    absolute inset-[3px] grid place-items-center rounded-full
                    bg-black/50 text-white backdrop-blur-[3px]
                    opacity-0 transition-opacity duration-200
                    group-hover/avatar:opacity-100
                  "
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       className="h-7 w-7">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-4.3-4.3" />
                    <path d="M11 8v6M8 11h6" />
                  </svg>
                </span>
              </button>
            </div>

            {/* action buttons row */}
            <div className="flex items-center justify-center gap-2 pb-4">
              <button
                type="button"
                onClick={openFilePicker}
                className="
                  inline-flex items-center gap-1.5 px-3.5 py-1.5
                  rounded-full border border-white/15 bg-white/[0.06]
                  text-[11px] uppercase tracking-[0.14em] text-white/80
                  transition-colors duration-200
                  hover:bg-white/[0.14] hover:text-white active:scale-95
                  [-webkit-tap-highlight-color:transparent]
                "
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     className="h-3 w-3">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                {hasCustom ? 'Change' : 'Upload'}
              </button>

              {hasCustom && (
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset to default photo"
                  className="
                    inline-flex items-center gap-1.5 px-3.5 py-1.5
                    rounded-full border border-white/15 bg-white/[0.06]
                    text-[11px] uppercase tracking-[0.14em] text-white/70
                    transition-colors duration-200
                    hover:bg-white/[0.14] hover:text-white active:scale-95
                    [-webkit-tap-highlight-color:transparent]
                  "
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       className="h-3 w-3">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Reset
                </button>
              )}
            </div>

            {/* name */}
            <div className="px-6 text-center">
              {editing ? (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setEditing(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false) }}
                  maxLength={32}
                  className="
                    w-full text-center bg-transparent outline-none
                    text-white text-[20px] font-[620] tracking-[-0.015em]
                    border-b border-white/25 pb-1
                  "
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  title="Click to rename"
                  className="
                    text-white text-[20px] font-[620] tracking-[-0.015em]
                    cursor-text
                    border-b border-transparent hover:border-white/25
                    px-1 pb-0.5 transition-colors
                  "
                >
                  {name}
                </button>
              )}
            </div>

            {/* now playing */}
            <div className="px-6 pt-5 pb-7">
              <div
                className="
                  rounded-2xl p-3.5
                  border border-white/[0.12]
                  bg-white/[0.05]
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]
                "
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 mb-1.5">
                  {trackTitle ? 'Now Playing' : 'Nothing playing'}
                </div>
                <div className="text-[13px] font-medium text-white truncate">
                  {trackTitle || '—'}
                </div>
                {trackArtist && (
                  <div className="text-[11px] text-white/55 truncate mt-0.5">
                    {trackArtist}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- full-size image viewer ---------- */}
      {viewerOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-[70] grid place-items-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo"
          onClick={closeViewer}
        >
          <div className="absolute inset-0 z-0 bg-black/85 backdrop-blur-2xl" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="
              relative z-10 max-w-[min(560px,92vw)] max-h-[86vh]
              rounded-[28px] overflow-hidden
              border border-white/20
              shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.35)]
              animate-[searchIn_.35s_cubic-bezier(.2,.9,.25,1)_both]
            "
          >
            <img
              src={displaySrc}
              alt=""
              className="block max-w-full max-h-[86vh] object-contain bg-black/40"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0
                         bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.18),transparent_55%)]
                         mix-blend-screen"
            />
          </div>

          <button
            type="button"
            onClick={closeViewer}
            aria-label="Close photo"
            title="Close"
            className="
              absolute right-5 top-5 z-20
              grid place-items-center h-10 w-10 rounded-full
              border border-white/20 bg-white/[0.08] text-white/80
              backdrop-blur-md
              transition-colors duration-200
              hover:bg-white/[0.18] hover:text-white active:scale-90
              [-webkit-tap-highlight-color:transparent]
            "
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}