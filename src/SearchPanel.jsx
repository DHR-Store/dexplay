import { useEffect, useRef, useState } from 'react'
import useSearch from './useSearch.js'
import { resolveTrack } from './youtubeApi.js'

const THUMB = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

export default function SearchPanel({ onAdd }) {
  const [open, setOpen]           = useState(false)
  const [busyId, setBusyId]       = useState(null)
  const [playError, setPlayError] = useState(null)
  const { query, setQuery, results, loading, error } = useSearch()
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
    if (!open) setPlayError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  /* ---- resolve the full tunnel URL then hand the track to App ---- */
  const handlePick = async (item) => {
    setBusyId(item.id)
    setPlayError(null)
    try {
      // chain: oEmbed metadata → sanity key → converter → playable tunnel URL
      const track = await resolveTrack(item)
      onAdd({
        ...track,
        // remember the search term so App can auto-queue more from this genre
        query: query.trim()
      })
      setOpen(false)
    } catch (e) {
      setPlayError(e.message || 'Could not load this track')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div
      className={[
        'fixed top-[84px] right-5 z-50 flex flex-col gap-3',
        'max-h-[calc(100dvh-2.5rem)] pointer-events-none',
        open ? 'items-stretch' : 'items-end'
      ].join(' ')}
    >
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Search music"
          aria-label="Search music"
          className="
            pointer-events-auto grid place-items-center h-12 w-12 rounded-full
            border border-white/20
            bg-gradient-to-br from-white/20 via-white/[0.06] to-white/10
            backdrop-blur-2xl backdrop-saturate-150 text-white/90
            shadow-glass-sm transition-all duration-200 ease-out
            hover:-translate-y-0.5 hover:from-white/30 hover:via-white/10 hover:to-white/15
            active:scale-95
          "
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className="h-5 w-5">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      )}

      {open && (
        <div
          className="
            pointer-events-auto flex flex-col
            w-[min(390px,92vw)] max-h-[calc(100dvh-2.5rem)]
            rounded-[28px] overflow-hidden isolate
            border border-white/20
            bg-gradient-to-br from-white/[0.16] via-white/[0.05] to-white/[0.10]
            backdrop-blur-3xl backdrop-saturate-[1.9] shadow-glass
            animate-[searchIn_.4s_cubic-bezier(.2,.9,.25,1)_both]
          "
        >
          {/* search bar */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-4 w-4 text-white/55 shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs…"
              spellCheck="false"
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent outline-none
                         text-white text-[13.5px] tracking-tight
                         placeholder:text-white/40"
            />
            <button
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="Close search"
              className="grid place-items-center h-7 w-7 rounded-full shrink-0
                         border border-white/15 bg-white/[0.06] text-white/70
                         transition-colors duration-200
                         hover:bg-white/[0.14] hover:text-white active:scale-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="h-3 w-3">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* results */}
          <div
            className="
              flex flex-col gap-2.5 p-3 overflow-y-auto
              max-h-[min(600px,calc(100dvh-9rem))]
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-thumb]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-white/25
              [&::-webkit-scrollbar-track]:bg-transparent
            "
          >
            {loading && <Status><Spinner /> Searching…</Status>}
            {!loading && error && <Status variant="err">{error}</Status>}
            {!loading && playError && <Status variant="err">{playError}</Status>}
            {!loading && !error && query.trim() && results.length === 0 && (
              <Status>No results</Status>
            )}
            {!loading && !query.trim() && results.length === 0 && (
              <Status>Type to search songs…</Status>
            )}

            {results.map((r) => {
              const busy = busyId === r.id
              return (
                <button
                  key={r.id}
                  onClick={() => handlePick(r)}
                  disabled={busyId !== null}
                  className={[
                    'group relative flex items-center gap-3 p-3 text-left',
                    'rounded-2xl overflow-hidden',
                    'border border-white/[0.14]',
                    'bg-gradient-to-br from-white/[0.10] via-white/[0.03] to-white/[0.07]',
                    'backdrop-blur-xl',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_6px_20px_-12px_rgba(0,0,0,0.9)]',
                    'transition-all duration-300 ease-out',
                    'hover:-translate-y-0.5 hover:border-white/25',
                    'hover:from-white/[0.18] hover:via-white/[0.06] hover:to-white/[0.12]',
                    'active:translate-y-0 active:scale-[0.985]',
                    'disabled:opacity-60 disabled:cursor-default',
                    busy
                      ? 'border-white/30 from-white/[0.18] to-white/[0.08]'
                      : ''
                  ].join(' ')}
                >
                  {/* hue wash */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-2xl
                               opacity-0 transition-opacity duration-300
                               group-hover:opacity-100
                               bg-[radial-gradient(180px_circle_at_12%_-10%,hsl(var(--h1)_100%_65%_/_0.28),transparent_65%)]"
                  />

                  {/* THUMBNAIL — fixed frame, absolute img inside */}
                  <div
                    className="relative shrink-0 overflow-hidden rounded-xl
                               ring-1 ring-white/15
                               shadow-[0_6px_16px_-8px_rgba(0,0,0,0.9)]
                               bg-black/60"
                    style={{ width: 120, height: 172 }}
                  >
                    <img
                      src={THUMB(r.id)}
                      alt=""
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                      className="absolute inset-0 block h-full w-full object-cover
                                 transition-transform duration-500 ease-out
                                 group-hover:scale-[1.06]"
                    />

                    {/* hover / busy overlay */}
                    <div
                      aria-hidden
                      className={[
                        'absolute inset-0 grid place-items-center text-white',
                        'bg-gradient-to-b from-black/5 to-black/55',
                        'transition-opacity duration-300',
                        busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      ].join(' ')}
                    >
                      {busy ? (
                        <Spinner light />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor"
                             className="h-7 w-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                          <path d="M8.2 4.9v14.2L19.4 12z" />
                        </svg>
                      )}
                    </div>

                    {r.duration && (
                      <span className="absolute right-1.5 bottom-1.5 z-10 rounded-md
                                       bg-black/70 px-1.5 py-0.5
                                       text-[9.5px] font-semibold tracking-wide text-white
                                       backdrop-blur-md">
                        {r.duration}
                      </span>
                    )}
                  </div>

                  {/* text */}
                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium leading-snug text-white line-clamp-2">
                      {r.title}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-white/50">
                      <span className="max-w-[150px] truncate">{r.channelTitle}</span>
                      {r.size && (
                        <>
                          <span className="opacity-50">·</span>
                          <span>{r.size}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Status({ variant, children }) {
  return (
    <div
      className={[
        'flex items-center justify-center gap-2 py-4 text-center text-[12px]',
        variant === 'err' ? 'text-rose-300' : 'text-white/50'
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function Spinner({ light = false }) {
  return (
    <span
      className={[
        'inline-block h-3.5 w-3.5 animate-spin rounded-full border-2',
        light
          ? 'border-white/30 border-t-white'
          : 'border-white/25 border-t-[hsl(var(--h1)_100%_70%)]'
      ].join(' ')}
    />
  )
}