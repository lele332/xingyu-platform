import { useEffect, useRef } from 'react'

type SceneProps = { running?: boolean; progress?: number }
type Falling = { x: number; y: number; vy: number; kind: 'card' | 'phone'; rot: number }

const BEST_KEY = 'xingyu_paperflow_best_v1'

export default function PaperFlowScene({ running = true, progress = 0 }: SceneProps) {
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
    let items: Falling[] = []
    let trayX = 0.5
    let targetX = 0.5
    let score = 0
    let streak = 0
    let elapsed = 0
    let spawnIn = 0.7
    let flash = 0
    let best = Number(localStorage.getItem(BEST_KEY) || 0)

    const trayY = () => height * 0.74
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawn = () => {
      const phone = Math.random() < 0.26
      items.push({
        x: 36 + Math.random() * (width - 72),
        y: -30,
        vy: 105 + Math.random() * 40 + progressRef.current * 65,
        kind: phone ? 'phone' : 'card',
        rot: (Math.random() - 0.5) * 0.5,
      })
      spawnIn = 0.58 + Math.random() * 0.48
    }

    const movePointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetX = Math.min(0.94, Math.max(0.06, (e.clientX - rect.left) / rect.width))
    }

    const update = (dt: number) => {
      elapsed += dt
      flash = Math.max(0, flash - 48 * dt)
      trayX += (targetX - trayX) * Math.min(1, dt * 9)
      spawnIn -= dt
      if (spawnIn <= 0) spawn()

      for (const item of items) {
        item.y += item.vy * dt
        item.rot += dt * 0.7
        const hit = Math.abs(item.x - width * trayX) < 62 && Math.abs(item.y - trayY()) < 26
        if (hit) {
          if (item.kind === 'card') {
            score += 1 + Math.floor(streak / 4)
            streak += 1
            flash = 8
          } else {
            score = Math.max(0, score - 2)
            streak = 0
            flash = 4
          }
          item.y = height + 120
        }
      }
      items = items.filter((item) => item.y < height + 80)

      if (score > best) {
        best = score
        localStorage.setItem(BEST_KEY, String(best))
      }
    }

    const draw = () => {
      const bg = ctx.createLinearGradient(0, 0, width, height)
      bg.addColorStop(0, '#0b0905')
      bg.addColorStop(0.5, '#141009')
      bg.addColorStop(1, '#050403')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)

      for (let i = 0; i < 8; i++) {
        const y = 80 + i * height * 0.078
        ctx.strokeStyle = 'rgba(253,230,138,0.045)'
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      for (const item of items) {
        ctx.save()
        ctx.translate(item.x, item.y)
        ctx.rotate(item.rot)
        if (item.kind === 'card') {
          ctx.fillStyle = '#fde68a'
          ctx.shadowColor = 'rgba(253,230,138,0.75)'
          ctx.shadowBlur = 14
          ctx.beginPath()
          ctx.roundRect(-18, -12, 36, 24, 4)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.fillStyle = '#78350f'
          ctx.fillRect(-10, -4, 20, 2)
          ctx.fillRect(-10, 1, 13, 2)
        } else {
          ctx.fillStyle = 'rgba(255,132,132,0.86)'
          ctx.shadowColor = 'rgba(255,132,132,0.6)'
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.roundRect(-9, -17, 18, 34, 5)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.fillStyle = '#7f1d1d'
          ctx.fillRect(-6, -13, 12, 22)
        }
        ctx.restore()
      }

      const tx = width * trayX
      ctx.fillStyle = flash > 2 ? '#fff7ed' : '#fde68a'
      ctx.beginPath()
      ctx.roundRect(tx - 56, trayY() - 9, 112, 18, 7)
      ctx.fill()
      ctx.strokeStyle = 'rgba(253,230,138,0.5)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(tx, trayY() - 2, 72, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()

      ctx.fillStyle = 'rgba(253,247,237,0.66)'
      ctx.font = '500 12px Inter, "Segoe UI", sans-serif'
      ctx.fillText(`SCORE ${score}   STREAK ${streak}   BEST ${best}`, 26, 36)
      ctx.fillStyle = 'rgba(253,247,237,0.34)'
      ctx.font = '400 11px Inter, "Segoe UI", sans-serif'
      ctx.fillText('移动鼠标 / A D 接住卡片 · 避开手机', 26, 56)
      if (!runningRef.current) {
        ctx.fillStyle = 'rgba(253,247,237,0.68)'
        ctx.font = '500 16px Inter, "Segoe UI", sans-serif'
        ctx.fillText('已暂停', 26, 82)
      }
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      if (runningRef.current) update(dt)
      draw()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyA') targetX = Math.max(0.06, targetX - 0.07)
      if (e.code === 'KeyD') targetX = Math.min(0.94, targetX + 0.07)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('pointermove', movePointer)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('pointermove', movePointer)
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
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/45">Paper Stream</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight text-white/85 md:text-6xl">Paperflow</h1>
      </div>
    </div>
  )
}
