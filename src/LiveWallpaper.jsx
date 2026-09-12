import { useEffect, useRef } from 'react'

const BLOB_COUNT = 9
const SCALE = 0.5

export default function LiveWallpaper({ hues, analyserRef, playing, visible = true }) {
  const canvasRef   = useRef(null)
  const visibleRef  = useRef(visible)
  visibleRef.current = visible

  const stateRef = useRef({
    blobs: [],
    curHues: [190, 265, 320],
    bassEnergy: 0,
    pointer: { x: 0, y: 0, tx: 0, ty: 0 }
  })
  const huesRef    = useRef(hues);    huesRef.current = hues
  const playingRef = useRef(playing); playingRef.current = playing

  useEffect(() => {
    stateRef.current.blobs = Array.from({ length: BLOB_COUNT }, () => ({
      cx: 0.14 + Math.random() * 0.82,
      cy: 0.12 + Math.random() * 0.76,
      rx: 0.10 + Math.random() * 0.32,
      ry: 0.10 + Math.random() * 0.30,
      sp: 0.035 + Math.random() * 0.11,
      ph: Math.random() * Math.PI * 2,
      rad: 0.20 + Math.random() * 0.26,
      huePick: Math.floor(Math.random() * 3),
      wob: 0.5 + Math.random()
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const cx = canvas.getContext('2d', { alpha: false })
    let W = 1, H = 1

    const resize = () => {
      W = Math.max(1, window.innerWidth)
      H = Math.max(1, window.innerHeight)
      canvas.width  = Math.max(1, Math.floor(W * SCALE))
      canvas.height = Math.max(1, Math.floor(H * SCALE))
    }
    resize()
    window.addEventListener('resize', resize)

    const onPointer = (e) => {
      stateRef.current.pointer.tx = (e.clientX / window.innerWidth  - 0.5) * 2
      stateRef.current.pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onPointer)

    let freqBuf = null
    let last = performance.now()
    let raf

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (!visibleRef.current) { last = now; return }

      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const t  = now / 1000
      const s  = stateRef.current
      const targetHues = huesRef.current || [190, 265, 320]

      s.pointer.x += (s.pointer.tx - s.pointer.x) * Math.min(1, dt * 4)
      s.pointer.y += (s.pointer.ty - s.pointer.y) * Math.min(1, dt * 4)

      for (let i = 0; i < 3; i++) {
        s.curHues[i] += (targetHues[i] - s.curHues[i]) * Math.min(1, dt * 0.85)
      }
      const r = document.documentElement
      r.style.setProperty('--h1', s.curHues[0].toFixed(1))
      r.style.setProperty('--h2', s.curHues[1].toFixed(1))
      r.style.setProperty('--h3', s.curHues[2].toFixed(1))

      const analyser = analyserRef.current
      if (analyser && playingRef.current) {
        if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(freqBuf)
        let sum = 0
        for (let i = 1; i < 10; i++) sum += freqBuf[i]
        const bass = sum / 9 / 255
        s.bassEnergy += (bass - s.bassEnergy) * Math.min(1, dt * 8)
      } else {
        s.bassEnergy *= Math.pow(0.05, dt)
      }

      cx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
      cx.globalCompositeOperation = 'source-over'
      cx.fillStyle = '#05070d'
      cx.fillRect(0, 0, W, H)
      cx.globalCompositeOperation = 'lighter'

      const [hueA, hueB, hueC] = s.curHues
      const pulse  = 1 + s.bassEnergy * 0.40
      const energy = playingRef.current ? 1 : 0.72

      for (let i = 0; i < s.blobs.length; i++) {
        const b = s.blobs[i]
        const x = (b.cx + Math.cos(t * b.sp + b.ph) * b.rx) * W + s.pointer.x * 0.055 * W
        const y = (b.cy + Math.sin(t * b.sp * 1.27 + b.ph * 1.7) * b.ry) * H + s.pointer.y * 0.055 * H
        const R = b.rad * Math.min(W, H) * pulse * (1 + 0.06 * Math.sin(t * b.wob + b.ph))
        if (R <= 0) continue

        const base = b.huePick === 0 ? hueA : b.huePick === 1 ? hueB : hueC
        const h = base + Math.sin(t * 0.22 + b.ph) * 12

        const g = cx.createRadialGradient(x, y, 0, x, y, R)
        g.addColorStop(0,    `hsla(${h.toFixed(1)},96%,64%,${0.30 * energy})`)
        g.addColorStop(0.34, `hsla(${(h + 18).toFixed(1)},96%,55%,${0.13 * energy})`)
        g.addColorStop(0.68, `hsla(${(h + 38).toFixed(1)},96%,50%,${0.045 * energy})`)
        g.addColorStop(1,    `hsla(${(h + 60).toFixed(1)},96%,50%,0)`)
        cx.fillStyle = g
        cx.beginPath()
        cx.arc(x, y, R, 0, Math.PI * 2)
        cx.fill()
      }

      for (let i = 0; i < 2; i++) {
        const yy = (0.30 + 0.40 * i + Math.sin(t * 0.10 + i * 2.1) * 0.10) * H
        const lg = cx.createLinearGradient(0, yy - 90, 0, yy + 90)
        lg.addColorStop(0,   'rgba(255,255,255,0)')
        lg.addColorStop(0.5, `rgba(255,255,255,${0.018 + s.bassEnergy * 0.02})`)
        lg.addColorStop(1,   'rgba(255,255,255,0)')
        cx.fillStyle = lg
        cx.fillRect(0, yy - 90, W, 180)
      }
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [analyserRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={[
        'pointer-events-none fixed inset-0 z-0 block h-full w-full',
        visible ? '' : 'hidden'
      ].join(' ')}
    />
  )
}