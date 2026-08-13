import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
import PrismaScene from './components/PrismaScene'
import ViktorScene from './components/ViktorScene'
import AsmeScene from './components/AsmeScene'

const SCENES = [
  { name: 'Prisma', component: PrismaScene },
  { name: 'Viktor', component: ViktorScene },
  { name: 'Asme', component: AsmeScene },
]

export default function App() {
  // 从 URL 参数读取专注时长（分钟），默认 25
  const [minutes, setMinutes] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('minutes')
    const n = p ? parseInt(p, 10) : 25
    return Number.isFinite(n) && n > 0 ? n : 25
  })
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60)
  const [running, setRunning] = useState(true)
  const [scene, setScene] = useState(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  // 键盘：左右切换场景，空格暂停/继续，Esc 退出
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setScene((s) => (s + 1) % SCENES.length)
      else if (e.key === 'ArrowLeft') setScene((s) => (s - 1 + SCENES.length) % SCENES.length)
      else if (e.key === ' ') {
        e.preventDefault()
        setRunning((r) => !r)
      } else if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function exit() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'xingyu-focus-exit' }, '*')
    } else {
      window.close()
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  const Scene = SCENES[scene].component

  return (
    <div className="relative min-h-screen bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Scene />
        </motion.div>
      </AnimatePresence>

      {/* 顶部控制栏 */}
      <div className="fixed right-0 top-0 z-50 flex items-center gap-2 p-4 md:p-5">
        {/* 计时 */}
        <div className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="text-white/80 transition-colors hover:text-white"
            aria-label={running ? '暂停' : '继续'}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="min-w-[52px] text-center text-sm font-medium tabular-nums text-white">
            {mm}:{ss}
          </span>
        </div>

        {/* 场景切换 */}
        <div className="liquid-glass flex items-center gap-1 rounded-full px-2 py-2">
          <button
            onClick={() => setScene((s) => (s - 1 + SCENES.length) % SCENES.length)}
            className="rounded-full p-1 text-white/70 transition-colors hover:text-white"
            aria-label="上一个场景"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {SCENES.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setScene(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === scene ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {s.name}
            </button>
          ))}
          <button
            onClick={() => setScene((s) => (s + 1) % SCENES.length)}
            className="rounded-full p-1 text-white/70 transition-colors hover:text-white"
            aria-label="下一个场景"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* 退出 */}
        <button
          onClick={exit}
          className="liquid-glass rounded-full p-2.5 text-white/80 transition-all hover:bg-white/10 hover:text-white"
          aria-label="退出专注"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 底部提示 */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
        <p className="rounded-full bg-black/40 px-4 py-1.5 text-[11px] text-white/50">
          ← → 切换场景 · 空格 暂停 · Esc 退出
        </p>
      </div>
    </div>
  )
}
