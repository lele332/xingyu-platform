import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

const VIDEOS = [
  '/assets/scenes/hf_20260629_030107_874273ea-684a-4e90-bb96-8fdfde48d53d.mp4',
  '/assets/scenes/hf_20260629_032424_3c9c2a9d-807b-4482-80e6-dd6d9dfd4545.mp4',
  '/assets/scenes/hf_20260627_094019_4214ea73-b963-46a4-8327-61489192de99.mp4',
]

const LABELS = ['WATER WAVE', 'GRIDWAVE', 'LIGHT TUNNEL']

export default function ViktorScene() {
  const [active, setActive] = useState(0)

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black text-white">
      {/* 三个视频交叉切换 */}
      {VIDEOS.map((src, i) => (
        <video
          key={src}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
            i === active ? 'opacity-100' : 'opacity-0'
          }`}
          src={src}
          autoPlay
          loop
          muted
          playsInline
        />
      ))}
      <div className="absolute inset-0 z-[1] bg-black/10" />

      {/* Navbar */}
      <header className="absolute left-0 right-0 top-0 z-10">
        <div className="mx-auto flex max-w-[1340px] items-center justify-between px-[15px] py-9">
          <nav className="hidden gap-4 md:flex">
            {['Works', 'Services', 'About', 'Contact'].map((item, i) => (
              <a
                key={item}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="group flex flex-col leading-none"
              >
                <span className="text-[8px] font-medium uppercase leading-3 tracking-[-0.08px] text-white/60">
                  0{i + 1} /
                </span>
                <span className="text-xs font-medium uppercase leading-4 tracking-[-0.12px]">
                  {item}
                </span>
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-6">
            <span className="hidden text-xs font-medium sm:block">Davies@gmail.com</span>
            <Clock />
          </div>
        </div>
      </header>

      {/* Hero 内容 */}
      <div className="absolute inset-0 z-[2] mx-auto flex max-w-[1340px] flex-col justify-end items-start px-[15px] pt-[190px] pb-11 md:items-end md:gap-[150px]">
        {/* 切换器 + 可用状态 */}
        <div className="flex w-full flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-[4] flex-col gap-2 md:gap-4">
            {LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => setActive(i)}
                className={`group flex items-center gap-3 text-left text-xs font-medium uppercase tracking-[-0.12px] transition-all ${
                  i === active ? 'opacity-100' : 'opacity-55 hover:opacity-75'
                }`}
              >
                <span className="text-[8px] text-white/60">0{i + 1} /</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  {label}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-1 items-center gap-2">
            <span
              className={`h-[7px] w-[7px] rounded-full ${
                active === 0 ? 'bg-[#F598F2]' : 'bg-white'
              }`}
              style={{
                boxShadow: active === 0 ? '0 0 12px #F598F2' : '0 0 12px #fff',
                animation: 'dotPulse 1.6s ease-in-out infinite',
              }}
            />
            <span className="text-xs font-medium">Available for work</span>
          </div>
        </div>

        {/* 名字 + CTA */}
        <div className="flex w-full flex-col gap-8 md:flex-row md:items-end md:gap-7">
          <motion.h1
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="flex-[2] text-[clamp(68px,21vw,80px)] font-medium uppercase leading-[81%] tracking-[-4.8px] md:text-[129.6px] md:leading-[113.4px] md:tracking-[-6px]"
          >
            Viktor
            <span className={active === 0 ? 'text-[#F598F2]' : 'text-white'}>.</span>
          </motion.h1>
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="flex flex-1 flex-col gap-5 md:pl-[50px]"
          >
            <p className="max-w-[420px] text-base font-medium leading-6 tracking-[-0.16px]">
              I craft bold brands and modern websites with purpose — where every pixel carries
              intent.
            </p>
            <button className="relative w-fit overflow-hidden border border-white px-6 py-3 text-sm font-medium lowercase transition-colors duration-300 hover:text-black">
              <span className="relative z-10">start a project</span>
              <span className="absolute inset-0 -translate-y-[101%] bg-[#F598F2] transition-transform duration-300 ease-out hover:translate-y-0" />
            </button>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.45); }
        }
      `}</style>
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })
    const tick = () => setTime('CUP ' + fmt.format(new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="text-xs font-medium tabular-nums">{time}</span>
}
