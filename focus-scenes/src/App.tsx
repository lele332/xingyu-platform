import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Play, Pause, Circle, Sparkles, SkipBack, SkipForward } from 'lucide-react'
import PrismaScene from './components/PrismaScene'
import NexusScene from './components/NexusScene'
import FoldcraftScene from './components/FoldcraftScene'
import SecurifyScene from './components/SecurifyScene'

/** 灵感画廊 4 场景：key 用于 localStorage 记忆，accent 为主题色 */
const SCENES = [
  {
    key: 'nexus',
    name: '云门智界',
    accent: '#dbe7ff',
    accentRgb: '219,231,255',
    component: NexusScene,
  },
  {
    key: 'prisma',
    name: '棱镜艺境',
    accent: '#e1e0cc',
    accentRgb: '225,224,204',
    component: PrismaScene,
  },
  {
    key: 'foldcraft',
    name: '折艺工坊',
    accent: '#ffb37a',
    accentRgb: '255,179,122',
    component: FoldcraftScene,
  },
  {
    key: 'securify',
    name: '守御界',
    accent: '#9db8ff',
    accentRgb: '157,184,255',
    component: SecurifyScene,
  },
]

const STORAGE_KEY = 'xingyu_focus_scene_v1'
const DIAL_KEY = 'xingyu_focus_dial_v1'

export default function App() {
  // 从 URL 参数读取专注时长（分钟），默认 25
  const [minutes, setMinutes] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('minutes')
    const n = p ? parseInt(p, 10) : 25
    return Number.isFinite(n) && n > 0 ? n : 25
  })
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60)
  const [running, setRunning] = useState(true)
  // 初始场景：优先恢复用户上次选择（localStorage）
  const [scene, setScene] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const idx = SCENES.findIndex((s) => s.key === saved)
    return idx >= 0 ? idx : 0
  })
  // 计时盘模式：高级动效 / 简约（localStorage 记忆）
  const [dialMode, setDialMode] = useState<'advanced' | 'minimal'>(() => {
    try {
      return localStorage.getItem(DIAL_KEY) === 'minimal' ? 'minimal' : 'advanced'
    } catch {
      return 'advanced'
    }
  })
  function toggleDialMode() {
    setDialMode((m) => {
      const next = m === 'advanced' ? 'minimal' : 'advanced'
      try {
        localStorage.setItem(DIAL_KEY, next)
      } catch {
        /* 隐私模式忽略 */
      }
      return next
    })
  }

  // 励志语录音频（沉浸式番茄钟配乐）
  const MOTIVATION = [
    { file: '/assets/motivational/leijun-dare.mp3', title: '雷军：敢想敢干最重要，先干了再说', subtitle: '敢想敢干最重要，先干了再说。不要等一切准备就绪，机会往往稍纵即逝。迈出第一步，你会发现路其实没有那么难。' },
    { file: '/assets/motivational/leijun-effort.mp3', title: '雷军：努力不是万能的，千万别钻牛角尖', subtitle: '努力不是万能的，千万别钻牛角尖。方向对了，努力才有意义。学会停下来想一想，比盲目向前更重要。' },
    { file: '/assets/motivational/leijun-voice.m4a', title: '雷军：语录（语音分享）', subtitle: '雷军：人生没有白走的路，每一步都算数。坚持你所热爱的，相信时间的力量。' },
    { file: '/assets/motivational/quote-crying.mp3', title: '哭着考完的往往是笑着上岸的', subtitle: '哭着考完的，往往是笑着上岸的。那些看似熬不过去的日子，终会化作你前进的勇气。别怕，一步一步往前走就好。' },
    { file: '/assets/motivational/quote-failure.mp3', title: '没有任何人喜欢挫折和失败', subtitle: '没有任何人喜欢挫折和失败，但正是这些经历，才让你一点点变强。跌倒了，拍拍土，再出发。' },
    { file: '/assets/motivational/quote-helmet.mp3', title: '这个世界上最好的贵人，是自己', subtitle: '这个世界上最好的贵人，是你自己。与其把希望寄托在别人身上，不如让自己成为最可靠的后盾。' },
    { file: '/assets/motivational/quote-humanity.mp3', title: '这就是人类奇妙的地方', subtitle: '这就是人类奇妙的地方，明明那么脆弱，却总能在一次次跌倒之后重新站起，爆发出惊人的力量。' },
    { file: '/assets/motivational/quote-mindset.mp3', title: '心态是最好的风水', subtitle: '心态是最好的风水。心里有光，眼里就有希望；心里有海，路就会越走越宽。' },
    { file: '/assets/motivational/quote-perseverance.mp3', title: '你是一个有毅力的人', subtitle: '你是一个有毅力的人，认准的事情就一定坚持到底。慢一点没关系，重要的是从来没有停下来。' },
    { file: '/assets/motivational/quote-win.mp3', title: '赢万难，迎万难', subtitle: '赢万难，迎万难。困难不会因为你害怕而消失，勇敢迎上去，一个一个跨过，你终会赢得属于你的胜利。' },
    { file: '/assets/motivational/quote-worthiness.mp3', title: '世上总有一些美好值得我们全力以赴！', subtitle: '世上总有一些美好，值得我们全力以赴。为了更好的自己，为了那些值得的人和事，去拼、去闯、去成为光。' },
  ]
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackIdxRef = useRef(0)
  const [trackIdx, setTrackIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [subText, setSubText] = useState('')
  // 可拖动字幕条：位置记忆 + 拖拽逻辑
  const [subPos, setSubPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const s = localStorage.getItem('xingyu_focus_sub_pos')
      if (s) {
        const p = JSON.parse(s)
        if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y }
      }
    } catch { /* 隐私模式忽略 */ }
    return null
  })
  const subRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const subStyle = subPos
    ? { left: subPos.x + 'px', top: subPos.y + 'px', transform: 'none' }
    : { left: '50%', bottom: '6rem', transform: 'translateX(-50%)' }

  function onSubPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = subRef.current
    if (!el) return
    e.preventDefault()
    el.setPointerCapture?.(e.pointerId)
    const r = el.getBoundingClientRect()
    el.style.left = r.left + 'px'
    el.style.top = r.top + 'px'
    el.style.transform = 'none'
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top }
    el.classList.add('focus-sub-dragging')
  }
  function onSubPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    const el = subRef.current
    if (!d || !el) return
    let nx = d.ox + (e.clientX - d.sx)
    let ny = d.oy + (e.clientY - d.sy)
    nx = Math.max(4, Math.min(window.innerWidth - el.offsetWidth - 4, nx))
    ny = Math.max(4, Math.min(window.innerHeight - el.offsetHeight - 4, ny))
    el.style.left = nx + 'px'
    el.style.top = ny + 'px'
  }
  function onSubPointerEnd() {
    const d = dragRef.current
    const el = subRef.current
    if (!d || !el) return
    dragRef.current = null
    el.classList.remove('focus-sub-dragging')
    const nx = parseFloat(el.style.left) || 0
    const ny = parseFloat(el.style.top) || 0
    setSubPos({ x: nx, y: ny })
    try {
      localStorage.setItem('xingyu_focus_sub_pos', JSON.stringify({ x: nx, y: ny }))
    } catch { /* 隐私模式忽略 */ }
  }
  // 播放状态变化时通知父页面，父页面据此停止自己的励志语音，避免双声重叠
  useEffect(() => {
    try {
      window.parent.postMessage({ type: 'xingyu-motivation-state', playing: !!playing }, '*')
    } catch { /* 忽略 */ }
  }, [playing])

  // 实时字幕：跟随音频实际播放进度逐字显现（播放到哪，字幕就显示到哪）
  useEffect(() => {
    if (!playing) { setSubText(''); return }
    const text = MOTIVATION[trackIdx].subtitle || MOTIVATION[trackIdx].title
    const chars = text.split('')
    let raf = 0
    function frame() {
      const a = audioRef.current
      const dur = a && a.duration && isFinite(a.duration) ? a.duration : 0
      const ct = a ? (a.currentTime || 0) : 0
      let shown: string
      if (dur > 0) {
        const ratio = Math.min(1, Math.max(0, ct / dur))
        shown = chars.slice(0, Math.max(1, Math.floor(ratio * chars.length))).join('')
      } else {
        shown = text
      }
      setSubText(shown)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [playing, trackIdx])
  function playTrack(i: number, autoplay = true) {
    const idx = ((i % MOTIVATION.length) + MOTIVATION.length) % MOTIVATION.length
    trackIdxRef.current = idx
    setTrackIdx(idx)
    if (!audioRef.current) {
      const a = new Audio()
      a.addEventListener('ended', () => playTrack(trackIdxRef.current + 1))
      audioRef.current = a
    }
    const a = audioRef.current
    a.src = MOTIVATION[idx].file
    if (autoplay) {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      setPlaying(false)
    }
  }
  function toggleMotivation() {
    const a = audioRef.current
    if (a && !a.paused) { a.pause(); setPlaying(false); return }
    if (a && a.src) { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)) }
    else playTrack(trackIdxRef.current)
  }
  function nextMotivation() { playTrack(trackIdxRef.current + 1) }
  function prevMotivation() { playTrack(trackIdxRef.current - 1) }

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  /** 切换场景并记住选择 */
  function selectScene(i: number) {
    setScene(i)
    try {
      localStorage.setItem(STORAGE_KEY, SCENES[i].key)
    } catch {
      /* 隐私模式忽略 */
    }
  }

  // 键盘：左右切换场景，空格暂停/继续，Esc 退出
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') selectScene((scene + 1) % SCENES.length)
      else if (e.key === 'ArrowLeft') selectScene((scene - 1 + SCENES.length) % SCENES.length)
      else if (e.key === ' ') {
        e.preventDefault()
        setRunning((r) => !r)
      } else if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  function exit() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'xingyu-focus-exit' }, '*')
    } else {
      window.close()
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const total = minutes * 60
  const progress = total > 0 ? 1 - secondsLeft / total : 0

  const active = SCENES[scene]
  const Scene = active.component

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

      {/* 中央圆环计时器（跟随场景主题色） */}
      <Dial
        mm={mm}
        ss={ss}
        progress={progress}
        running={running}
        accent={active.accent}
        accentRgb={active.accentRgb}
        mode={dialMode}
      />

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

        {/* 激励语录播放器 */}
        <div className="liquid-glass flex items-center gap-1 rounded-full px-2 py-2">
          <button
            onClick={prevMotivation}
            className="rounded-full p-1 text-white/70 transition-colors hover:text-white"
            aria-label="上一句"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={toggleMotivation}
            className="rounded-full p-1.5 text-white/85 transition-colors hover:text-white"
            aria-label={playing ? '暂停' : '播放激励语录'}
            title={MOTIVATION[trackIdx].title}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            onClick={nextMotivation}
            className="rounded-full p-1 text-white/70 transition-colors hover:text-white"
            aria-label="下一句"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      {/* 实时字幕（可拖动，位置记忆） */}
      {playing &&
        createPortal(
          <div
            ref={subRef}
            style={subStyle}
            className="focus-subtitle"
            role="status"
            aria-live="polite"
            onPointerDown={onSubPointerDown}
            onPointerMove={onSubPointerMove}
            onPointerUp={onSubPointerEnd}
            onPointerCancel={onSubPointerEnd}
          >
            <span className="focus-sub-live" aria-hidden="true" />
            <span className="focus-sub-text">{subText}</span>
            <span className="focus-sub-handle" aria-hidden="true">⠿</span>
          </div>,
          document.body
        )}

        {/* 切换计时盘模式 */}
        <button
          onClick={toggleDialMode}
          className="liquid-glass rounded-full p-2.5 text-white/80 transition-all hover:bg-white/10 hover:text-white"
          aria-label={dialMode === 'advanced' ? '简约模式' : '高级模式'}
          title={dialMode === 'advanced' ? '切换为简约模式' : '切换为高级模式'}
        >
          {dialMode === 'advanced' ? <Circle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </button>

        {/* 退出 */}
        <button
          onClick={exit}
          className="liquid-glass rounded-full p-2.5 text-white/80 transition-all hover:bg-white/10 hover:text-white"
          aria-label="退出专注"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 当前励志语录 */}
      <div className="pointer-events-none fixed left-1/2 top-16 z-40 -translate-x-1/2 max-w-[82vw]">
        <p className="truncate rounded-full bg-black/45 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
          {MOTIVATION[trackIdx].title}
        </p>
      </div>


      {/* 底部场景切换器（4 画廊场景） */}
      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/55 p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {SCENES.map((s, i) => {
            const isActive = i === scene
            return (
              <button
                key={s.key}
                onClick={() => selectScene(i)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-all md:px-3.5 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
                style={
                  isActive
                    ? {
                        boxShadow: `inset 0 0 0 1px rgba(${s.accentRgb},0.45), 0 0 18px rgba(${s.accentRgb},0.28)`,
                      }
                    : undefined
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: s.accent,
                    boxShadow: `0 0 8px ${s.accent}`,
                  }}
                />
                {s.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------- 中央圆环计时器 ---------- */
function DialAdvanced({
  mm,
  ss,
  progress,
  running,
  accent,
  accentRgb,
}: {
  mm: string
  ss: string
  progress: number
  running: boolean
  accent: string
  accentRgb: string
  mode: 'advanced' | 'minimal'
}) {
  const R = 154
  const CIRC = 2 * Math.PI * R
  const clamped = Math.min(1, Math.max(0, progress))
  const ease: [number, number, number, number] = [0.22, 1, 0.36, 1]

  // ???????????????
  const angle = (-90 + clamped * 360) * (Math.PI / 180)
  const tipX = 180 + R * Math.cos(angle)
  const tipY = 180 + R * Math.sin(angle)

  // ?????60 ??? 5 ???????
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 6 * Math.PI) / 180
    const major = i % 5 === 0
    const r1 = major ? 166 : 171
    const r2 = 179
    return {
      x1: 180 + r1 * Math.cos(a),
      y1: 180 + r1 * Math.sin(a),
      x2: 180 + r2 * Math.cos(a),
      y2: 180 + r2 * Math.sin(a),
      major,
    }
  })

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        {/* ????????????? */}
        <div
          className="dial-pulse absolute h-[460px] w-[460px] rounded-full md:h-[500px] md:w-[500px]"
          style={{
            background: `radial-gradient(circle, rgba(${accentRgb},0.30) 0%, rgba(${accentRgb},0.07) 45%, transparent 70%)`,
          }}
        />
        {/* ?????? + ????? */}
        <div
          className="absolute h-[360px] w-[360px] rounded-full bg-black/55 backdrop-blur-md md:h-[400px] md:w-[400px]"
          style={{
            boxShadow: `0 0 140px rgba(${accentRgb},0.18), inset 0 0 70px rgba(${accentRgb},0.07)`,
          }}
        />
        <svg
          width={360}
          height={360}
          viewBox="0 0 360 360"
          className="relative hidden sm:block"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="dialStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor={accent} />
              <stop offset="100%" stopColor={accent} />
            </linearGradient>
          </defs>

          {/* ???? */}
          <g opacity="0.45">
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.major ? `rgba(${accentRgb},0.8)` : 'rgba(255,255,255,0.35)'}
                strokeWidth={t.major ? 1.6 : 0.8}
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* ????????????? */}
          <g className="dial-halo">
            <circle
              cx="180"
              cy="180"
              r={197}
              fill="none"
              stroke={`rgba(${accentRgb},0.4)`}
              strokeWidth={1}
              strokeDasharray="2 14"
              strokeLinecap="round"
            />
            <circle
              cx="180"
              cy="180"
              r={205}
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1}
              strokeDasharray="60 40"
              strokeLinecap="round"
            />
          </g>

          {/* ???? */}
          <circle
            cx="180"
            cy="180"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,.14)"
            strokeWidth={3}
          />
          {/* ????? */}
          <motion.circle
            cx="180"
            cy="180"
            r={R}
            fill="none"
            stroke={accent}
            strokeWidth={14}
            strokeLinecap="round"
            opacity={0.13}
            strokeDasharray={CIRC}
            animate={{ strokeDashoffset: CIRC * (1 - clamped) }}
            transition={{ duration: 1, ease }}
            transform="rotate(-90 180 180)"
          />
          {/* ??????????? */}
          <motion.circle
            cx="180"
            cy="180"
            r={R}
            fill="none"
            stroke="url(#dialStrokeGrad)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            animate={{ strokeDashoffset: CIRC * (1 - clamped) }}
            transition={{ duration: 1, ease }}
            transform="rotate(-90 180 180)"
            style={{ filter: `drop-shadow(0 0 7px rgba(${accentRgb},0.6))` }}
          />
          {/* ?????? */}
          <motion.circle
            cx={tipX}
            cy={tipY}
            r={6.5}
            fill={accent}
            animate={{ cx: tipX, cy: tipY }}
            transition={{ duration: 1, ease }}
            style={{ filter: `drop-shadow(0 0 7px rgba(${accentRgb},0.9))` }}
          />
          <motion.circle
            cx={tipX}
            cy={tipY}
            r={12}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            animate={{ cx: tipX, cy: tipY }}
            transition={{ duration: 1, ease }}
            opacity={0.5}
          />
        </svg>

        {/* ??????? */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-6xl font-extralight tabular-nums tracking-tight text-white md:text-7xl"
            style={{ textShadow: `0 0 26px rgba(${accentRgb},0.55)` }}
          >
            {mm}:{ss}
          </span>
          <span
            className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.34em]"
            style={{ color: `rgba(${accentRgb},0.8)` }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: running ? accent : '#fff',
                boxShadow: `0 0 8px ${running ? accent : 'rgba(255,255,255,0.6)'}`,
                animation: running ? 'dialPulse 2s ease-in-out infinite' : undefined,
              }}
            />
            {running ? 'Focusing' : 'Paused'}
          </span>
          <span className="mt-2 text-[10px] tracking-[0.28em] text-white/30">
            {Math.round(clamped * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}


/* ---------- 计时盘分发 + 简约模式 ---------- */
type DialProps = {
  mm: string
  ss: string
  progress: number
  running: boolean
  accent: string
  accentRgb: string
  mode: 'advanced' | 'minimal'
}

function Dial(props: DialProps) {
  return props.mode === 'minimal' ? <DialMinimal {...props} /> : <DialAdvanced {...props} />
}

function DialMinimal({ mm, ss, progress, running }: DialProps) {
  const R = 150
  const CIRC = 2 * Math.PI * R
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        <svg
          width={320}
          height={320}
          viewBox="0 0 320 320"
          className="relative hidden sm:block"
          aria-hidden="true"
        >
          <circle
            cx="160"
            cy="160"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={2}
          />
          <motion.circle
            cx="160"
            cy="160"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            animate={{ strokeDashoffset: CIRC * (1 - clamped) }}
            transition={{ duration: 1 }}
            transform="rotate(-90 160 160)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-light tabular-nums tracking-tight text-white md:text-7xl">
            {mm}:{ss}
          </span>
          <span className="mt-3 text-[10px] uppercase tracking-[0.4em] text-white/40">
            {running ? 'Focusing' : 'Paused'}
          </span>
        </div>
      </div>
    </div>
  )
}

