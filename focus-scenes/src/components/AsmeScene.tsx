import { useEffect, useRef } from 'react'
import { ArrowRight, Globe, Instagram, Twitter } from 'lucide-react'

const VIDEO =
  '/assets/scenes/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4'

export default function AsmeScene() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let raf = 0

    const fadeTo = (target: number, duration = 500) => {
      cancelAnimationFrame(raf)
      const start = v.style.opacity ? parseFloat(v.style.opacity) : 0
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / duration)
        v.style.opacity = String(start + (target - start) * p)
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }

    const onCanPlay = () => {
      v.play().catch(() => {})
      fadeTo(1)
    }
    const onTimeUpdate = () => {
      if (v.duration - v.currentTime <= 0.55) fadeTo(0)
    }
    const onEnded = () => {
      v.style.opacity = '0'
      setTimeout(() => {
        v.currentTime = 0
        v.play().catch(() => {})
        fadeTo(1)
      }, 100)
    }

    v.addEventListener('canplay', onCanPlay)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('ended', onEnded)
    return () => {
      cancelAnimationFrame(raf)
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('ended', onEnded)
    }
  }, [])

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black text-white">
      {/* 背景视频 */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        src={VIDEO}
        muted
        autoPlay
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
      />

      {/* Navbar */}
      <header className="relative z-20 px-6 py-6">
        <div className="liquid-glass mx-auto flex max-w-5xl items-center justify-between rounded-full px-6 py-3">
          <div className="flex items-center">
            <Globe className="h-6 w-6" />
            <span className="ml-2 text-lg font-semibold">Asme</span>
            <nav className="ml-8 hidden gap-8 md:flex">
              {['Features', 'Pricing', 'About'].map((i) => (
                <a
                  key={i}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-sm font-medium text-white/80 transition-colors hover:text-white"
                >
                  {i}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-sm font-medium">Sign Up</button>
            <button className="liquid-glass rounded-full px-6 py-2 text-sm font-medium">Login</button>
          </div>
        </div>
      </header>

      {/* Hero 内容 */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]">
        <h1
          className="whitespace-nowrap text-7xl tracking-tight text-white md:text-8xl lg:text-9xl"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Know it then <em className="italic">all</em>
        </h1>

        <div className="liquid-glass mt-10 flex w-full max-w-xl items-center gap-3 rounded-full py-2 pl-6 pr-2">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full bg-transparent text-white outline-none placeholder:text-white/40"
          />
          <button className="rounded-full bg-white p-3 text-black">
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-6 max-w-md px-4 text-sm leading-relaxed text-white">
          Stay updated with the latest news and insights. Subscribe to our newsletter today and
          never miss out on exciting updates.
        </p>

        <button className="liquid-glass mt-8 rounded-full px-8 py-3 text-sm font-medium transition-colors hover:bg-white/5">
          Read the manifesto
        </button>
      </div>

      {/* 社交图标 */}
      <footer className="relative z-10 flex justify-center gap-4 pb-12">
        {[Instagram, Twitter, Globe].map((Icon, i) => (
          <button
            key={i}
            className="liquid-glass rounded-full p-4 text-white/80 transition-all hover:bg-white/5 hover:text-white"
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </footer>
    </div>
  )
}
