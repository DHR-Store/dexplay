import { useEffect, useRef } from 'react'

const BAR_COUNT = 24

export default function Visualizer({ analyserRef, playing }) {
  const containerRef = useRef(null)
  const playingRef   = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    const bars = containerRef.current.querySelectorAll('i')
    const levels = new Array(BAR_COUNT).fill(0.08)
    let freqBuf = null
    let last = performance.now()
    let raf

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const analyser = analyserRef.current

      if (analyser && playingRef.current) {
        if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(freqBuf)
        const len = freqBuf.length
        for (let i = 0; i < BAR_COUNT; i++) {
          const idx = Math.min(len - 1, Math.floor(Math.pow(i / BAR_COUNT, 1.5) * 260) + 2)
          let v = freqBuf[idx] / 255
          v = Math.min(1, Math.pow(v, 1.22) * 1.28)
          levels[i] += (v - levels[i]) * Math.min(1, dt * 16)
          bars[i].style.height = (8 + levels[i] * 92).toFixed(1) + '%'
        }
      } else {
        const tsec = now / 1000
        for (let i = 0; i < BAR_COUNT; i++) {
          const v = 0.07 + 0.05 * (0.5 + 0.5 * Math.sin(tsec * 1.5 + i * 0.55))
          levels[i] += (v - levels[i]) * Math.min(1, dt * 3.2)
          bars[i].style.height = (8 + levels[i] * 92).toFixed(1) + '%'
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [analyserRef])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="flex h-10 shrink-0 items-end gap-[3px] my-3.5 mx-0.5"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <i
          key={i}
          className="
            flex-1 h-[8%] rounded-[3px] opacity-90 will-change-[height]
            bg-[linear-gradient(180deg,hsl(var(--h1)_100%_78%),hsl(var(--h3)_100%_60%))]
            shadow-[0_0_10px_hsl(var(--h2)_100%_62%_/_0.45)]
            transition-[height] duration-[80ms] ease-linear
          "
        />
      ))}
    </div>
  )
}