import LiveWallpaper from './LiveWallpaper.jsx'

export default function Wallpaper({ src, kind, hues, analyserRef, playing }) {
  const hasUser = !!src

  return (
    <>
      {/* default animated wallpaper — kept mounted so hue transitions stay smooth */}
      <LiveWallpaper
        hues={hues}
        analyserRef={analyserRef}
        playing={playing}
        visible={!hasUser}
      />

      {/* user's own wallpaper — video or image */}
      {hasUser && kind === 'video' && (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 block h-full w-full object-cover"
        />
      )}
      {hasUser && kind !== 'video' && (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 block h-full w-full object-cover"
        />
      )}
    </>
  )
}