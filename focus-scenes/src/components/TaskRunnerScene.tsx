import { useEffect, useRef } from 'react'

type SceneProps = { running?: boolean; progress?: number }
type Item = { x: number; y: number; vy: number; kind: 'star' | 'block' }

const BEST_KEY = 'xingyu_runner_best_v1'

export default function TaskRunnerScene({ running = true, progress = 0 }: SceneProps) {
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
    const player = { x: 0, y: 0, vy: 0, size: 34 }
    let items: Item[] = []
    let score = 0
    let combo = 0
    let elapsed = 0
    let spawnIn = 0.9
    let shake = 0
    let best = Number(localStorage.getItem(BEST_KEY) || 0)

    const groundY = () => height * 0.76
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      player.x = Math.max(90, width * 0.17)
      player.y = groundY() - player.size / 2
    }

    const jump = () => {
      if (player.y >= groundY() - player.size / 2 - 2) player.vy = -730
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'KeyK') {
        e.preventDefault()
        jump()
      }
    }
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      jump()
    }

    const spawn = () => {
      const star = Math.random() < 0.68
      if (star) {
        items.push({
          x: width + 40,
          y: groundY() - 48 - Math.random() * height * 0.34,
          vy: 0,
          kind: 'star',
        })
      } else {
        items.push({ x: width + 40, y: groundY() - 26, vy: 0, kind: 'block' })
      }
      spawnIn = 0.52 + Math.random() * 0.55
    }

    const update = (dt: number) => {
      elapsed += dt
      const speed = 265 + progressRef.current * 240 + Math.min(95, elapsed * 4)
      player.vy += 2050 * dt
      player.y += player.vy * dt
      const floor = groundY() - player.size / 2
      if (player.y > floor) {
        player.y = floor
        player.vy = 0
      }
      spawnIn -= dt
      if (spawnIn <= 0) spawn()

      for (const item of items) {
        item.x -= speed * dt
        if (item.kind === 'star') item.y += Math.sin(elapsed * 6 + item.x * 0.02) * 18 * dt
      }
      items = items.filter((item) => item.x > -80)

      for (const item of items) {
        const dx = Math.abs(item.x - player.x)
        const dy = Math.abs(item.y - player.y)
        if (dx < 30 && dy < 30) {
          if (item.kind === 'star') {
            score += 1 + Math.floor(combo / 5)
            combo += 1
            item.x = -999
          } else {
            score = Math.max(0, score - 2)
            combo = 0
            shake = 11
            item.x = -999
          }
        }
      }
      if (score > best) {
        best = score
        localStorage.setItem(BEST_KEY, String(best))
      }
      shake = Math.max(0, shake - 48 * dt)
    }

    const draw = () => {
      const ox = shake > 0 ? (Math.random() - 0.5) * shake : 0
      const oy = shake > 0 ? (Math.random() - 0.5) * shake : 0
      const bg = ctx.createLinearGradient(0, 0, 0, height)
      bg.addColorStop(0, '#020408')
      bg.addColorStop(0.45, '#07110d')
      bg.addColorStop(1, '#010402')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)
      ctx.save()
      ctx.translate(ox, oy)

      ctx.strokeStyle = 'rgba(167,243,208,0.055)'
      ctx.lineWidth = 1
      for (let i = 0; i < 9; i++) {
        const y = 70 + i * height * 0.075
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const gy = groundY()
      ctx.strokeStyle = 'rgba(167,243,208,0.24)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(width, gy)
      ctx.stroke()
      for (let i = 0; i < 14; i++) {
        const x = ((elapsed * 180 + i * 92) % (width + 80)) * -1 + width + 40
        ctx.strokeStyle = 'rgba(167,243,208,0.08)'
        ctx.beginPath()
        ctx.moveTo(x, gy)
        ctx.lineTo(x - 34, height)
        ctx.stroke()
      }

      for (const item of items) {
        if (item.kind === 'star') {
          ctx.fillStyle = '#a7f3d0'
          ctx.shadowColor = 'rgba(167,243,208,0.8)'
          ctx.shadowBlur = 16
          ctx.beginPath()
          ctx.arc(item.x, item.y, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
        } else {
          ctx.fillStyle = 'rgba(255,132,132,0.8)'
          ctx.fillRect(item.x - 17, item.y - 17, 34, 34)
          ctx.strokeStyle = 'rgba(255,190,190,0.4)'
          ctx.strokeRect(item.x - 17, item.y - 17, 34, 34)
        }
      }

      ctx.fillStyle = '#eafff5'
      ctx.beginPath()
      ctx.ellipse(player.x, player.y, 16, 20, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(167,243,208,0.75)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(player.x, player.y, 26, 0, Math.PI * 2)
      ctx.stroke()

      ctx.fillStyle = 'rgba(234,255,245,0.62)'
      ctx.font = '500 12px Inter, "Segoe UI", sans-serif'
      ctx.fillText(`SCORE ${score}   COMBO ${combo}   BEST ${best}`, 26, 36)
      ctx.fillStyle = 'rgba(234,255,245,0.32)'
      ctx.font = '400 11px Inter, "Segoe UI", sans-serif'
      ctx.fillText('W / 点击 跳过干扰 · 收集专注星', 26, 56)
      if (!runningRef.current) {
        ctx.fillStyle = 'rgba(234,255,245,0.68)'
        ctx.font = '500 16px Inter, "Segoe UI", sans-serif'
        ctx.fillText('已暂停', 26, 82)
      }
      ctx.restore()
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      if (runningRef.current) update(dt)
      draw()
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onPointerDown)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onPointerDown)
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
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/45">Zero Arcade</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight text-white/85 md:text-6xl">Task Runner</h1>
      </div>
    </div>
  )
}
