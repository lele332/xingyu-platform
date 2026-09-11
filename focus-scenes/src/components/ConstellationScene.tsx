import { useEffect, useRef } from 'react'

type SceneProps = { running?: boolean; progress?: number }
type Star = { x: number; y: number; n: number; found: boolean }
type Best = number

const BEST_KEY = 'xingyu_constellation_best_v1'

function createStars(width: number, height: number, count: number): Star[] {
  const stars: Star[] = []
  let attempts = 0
  while (stars.length < count && attempts < 400) {
    attempts++
    const x = width * (0.08 + Math.random() * 0.84)
    const y = height * (0.14 + Math.random() * 0.60)
    if (stars.some((s) => Math.hypot(s.x - x, s.y - y) < 105)) continue
    stars.push({ x, y, n: stars.length + 1, found: false })
  }
  return stars
}

export default function ConstellationScene({ running = true, progress = 0 }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runningRef = useRef(running)
  const progressRef = useRef(progress)

  useEffect(() => {
    runningRef.current = running
    progressRef.current = progress
  }, [running, progress])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()
    let width = 0
    let height = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let stars: Star[] = []
    let next = 1
    let round = 1
    let score = 0
    let streak = 0
    let flash = 0
    let message = ''
    let messageTimer = 0
    let best = Number(localStorage.getItem(BEST_KEY) || 0)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (stars.length > 0) {
        const old = stars
        stars = createStars(width, height, old.length)
      } else {
        stars = createStars(width, height, 4)
      }
    }

    const regenerate = () => {
      const count = Math.min(9, 4 + Math.floor((round - 1) / 2))
      stars = createStars(width, height, count)
      next = 1
    }

    const setMessage = (text: string, ms = 1000) => {
      message = text
      messageTimer = ms / 1000
    }

    const onClick = (e: PointerEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const hit = stars.find((s) => Math.hypot(s.x - x, s.y - y) < 29)
      if (!hit) return
      if (hit.n === next) {
        hit.found = true
        score += 3 + streak
        streak += 1
        next += 1
        flash = 12
        if (hit.n > best) {
          best = hit.n
          localStorage.setItem(BEST_KEY, String(best))
        }
        if (next > stars.length) {
          round += 1
          score += 12
          setMessage('星图连通', 900)
          window.setTimeout(regenerate, 600)
        } else {
          setMessage(`第 ${hit.n} 颗`, 420)
        }
      } else {
        streak = 0
        flash = 4
        setMessage('顺序断了', 650)
        stars.forEach((s) => (s.found = false))
        next = 1
      }
    }

    const update = (dt: number) => {
      flash = Math.max(0, flash - 44 * dt)
      messageTimer = Math.max(0, messageTimer - dt)
    }

    const draw = (time: number) => {
      const bg = ctx.createRadialGradient(width * 0.5, height * 0.44, 30, width * 0.5, height * 0.5, Math.max(width, height) * 0.8)
      bg.addColorStop(0, '#080f1f')
      bg.addColorStop(1, '#010205')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < 100; i++) {
        const x = ((i * 137) % width) + Math.sin(time * 0.0001 + i) * 4
        const y = ((i * 239) % height) + Math.cos(time * 0.00013 + i) * 5
        const r = ((i % 3) + 1) * 0.35
        ctx.fillStyle = `rgba(191,219,254,${0.10 + (i % 5) * 0.02})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      const found = stars.filter((s) => s.found)
      if (found.length > 1) {
        ctx.strokeStyle = 'rgba(191,219,254,0.5)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(found[0].x, found[0].y)
        for (let i = 1; i < found.length; i++) ctx.lineTo(found[i].x, found[i].y)
        ctx.stroke()
      }

      for (const star of stars) {
        const pulse = star.found ? 1.15 : 0.92 + Math.sin(time * 0.003 + star.n) * 0.08
        ctx.fillStyle = star.found ? '#bfdbfe' : 'rgba(191,219,254,0.22)'
        ctx.shadowColor = star.found ? 'rgba(191,219,254,0.85)' : 'transparent'
        ctx.shadowBlur = star.found ? 18 : 0
        ctx.beginPath()
        ctx.arc(star.x, star.y, 9 * pulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = star.found ? 'rgba(191,219,254,0.25)' : 'rgba(191,219,254,0.38)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(star.x, star.y, 18, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = star.found ? '#0b1220' : 'rgba(226,238,255,0.72)'
        ctx.font = '500 11px Inter, "Segoe UI", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(star.n), star.x, star.y)
      }

      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = 'rgba(226,238,255,0.68)'
      ctx.font = '500 12px Inter, "Segoe UI", sans-serif'
      ctx.fillText(`ROUND ${round}   SCORE ${score}   STREAK ${streak}`, 26, 36)
      ctx.fillStyle = 'rgba(226,238,255,0.36)'
      ctx.font = '400 11px Inter, "Segoe UI", sans-serif'
      ctx.fillText('按编号点亮星图 · 训练专注记忆', 26, 56)
      if (messageTimer > 0) {
        ctx.fillStyle = 'rgba(226,238,255,0.72)'
        ctx.font = '500 14px Inter, "Segoe UI", sans-serif'
        ctx.fillText(message, 26, 80)
      }
      if (!runningRef.current) {
        ctx.fillStyle = 'rgba(226,238,255,0.68)'
        ctx.font = '500 16px Inter, "Segoe UI", sans-serif'
        ctx.fillText('已暂停', 26, 104)
      }
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      if (runningRef.current) update(dt)
      draw(now)
    }

    resize()
    regenerate()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointerdown', onClick)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onClick)
    }
  }, [])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ touchAction: 'none' }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-24 text-center">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/45">Memory Field</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight text-white/85 md:text-6xl">Star Atlas</h1>
      </div>
    </div>
  )
}
