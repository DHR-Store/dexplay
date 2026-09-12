import { useRef } from 'react'

export default function WallpaperPicker({
  onPick,
  onClear,
  onPickDefault,
  hasCustom,
  isDefault,
  defaultName = 'Anime'
}) {
  const fileRef = useRef(null)

  const handleChange = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) onPick(f)
    e.target.value = ''   // allow re-picking the same file
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5">
      <div
        className="
          pointer-events-auto flex items-center gap-1.5 p-1.5
          rounded-full border border-white/20
          bg-gradient-to-br from-white/20 via-white/[0.06] to-white/10
          backdrop-blur-2xl backdrop-saturate-150
          shadow-glass-sm
        "
      >
        {/* -------- default built-in video (anime.mp4) -------- */}
        <button
          type="button"
          onClick={onPickDefault}
          title={isDefault ? `${defaultName} is active` : `Use built-in ${defaultName} video`}
          aria-label={`Use built-in ${defaultName} video`}
          className={[
            'grid place-items-center h-9 w-9 rounded-full',
            'transition-all duration-200',
            'hover:-translate-y-px active:scale-95',
            '[-webkit-tap-highlight-color:transparent]',
            isDefault
              ? 'bg-white/[0.18] text-white ' +
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_0_1px_hsl(var(--h1)_100%_70%_/_0.55),0_0_18px_hsl(var(--h1)_100%_62%_/_0.55)]'
              : 'text-white/85 hover:bg-white/[0.14] hover:text-white'
          ].join(' ')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
               className="h-[18px] w-[18px]">
            {/* film strip */}
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M7 4v16M17 4v16" />
            <path d="M7 8h10M7 12h10M7 16h10" opacity="0.55" />
          </svg>
        </button>

        {/* -------- upload your own -------- */}
        <button
          type="button"
          onClick={() => fileRef.current.click()}
          title="Upload your own wallpaper (image or video)"
          aria-label="Upload wallpaper"
          className="
            grid place-items-center h-9 w-9 rounded-full
            text-white/85 transition-all duration-200
            hover:bg-white/[0.14] hover:text-white hover:-translate-y-px
            active:scale-95 [-webkit-tap-highlight-color:transparent]
          "
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
               className="h-[18px] w-[18px]">
            <rect x="3" y="3" width="18" height="18" rx="2.5" />
            <circle cx="8.5" cy="8.5" r="1.6" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </button>

        {/* -------- clear / back to live canvas -------- */}
        {hasCustom && (
          <button
            type="button"
            onClick={onClear}
            title="Use the default live wallpaper"
            aria-label="Clear wallpaper"
            className="
              grid place-items-center h-9 w-9 rounded-full
              text-white/70 transition-all duration-200
              hover:bg-white/[0.14] hover:text-white active:scale-95
              [-webkit-tap-highlight-color:transparent]
            "
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={handleChange}
        />
      </div>
    </div>
  )
}