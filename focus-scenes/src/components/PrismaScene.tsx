import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { WordsPullUp, WordsPullUpMultiStyle, AnimatedLetters } from './WordsPullUp'

const EASE = [0.16, 1, 0.3, 1] as const

const HERO_VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4'

const NAV = ['Our story', 'Collective', 'Workshops', 'Programs', 'Inquiries']

const FEATURES = [
  {
    video:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_133058_0504132a-0cf3-4450-a370-8ea3b05c95d4.mp4',
    title: 'Your creative canvas.',
    items: null,
  },
  {
    icon: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171918_4a5edc79-d78f-4637-ac8b-53c43c220606.png&w=1280&q=85',
    title: 'Project Storyboard.',
    num: '01',
    items: ['Visual planning tools', 'Scene-by-scene breakdown', 'Collaborative boards', 'Version history'],
  },
  {
    icon: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171741_ed9845ab-f5b2-4018-8ce7-07cc01823522.png&w=1280&q=85',
    title: 'Smart Critiques.',
    num: '02',
    items: ['AI-driven analysis', 'Creative notes', 'Tool integrations'],
  },
  {
    icon: 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260405_171809_f56666dc-c099-4778-ad82-9ad4f209567b.png&w=1280&q=85',
    title: 'Immersion Capsule.',
    num: '03',
    items: ['Notification silencing', 'Ambient soundscapes', 'Schedule syncing'],
  },
]

export default function PrismaScene() {
  return (
    <div className="bg-black text-primary">
      {/* ============ HERO ============ */}
      <section className="relative h-screen p-4 md:p-6">
        <div className="relative h-full w-full overflow-hidden rounded-2xl md:rounded-[2rem]">
          {/* 背景视频 */}
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={HERO_VIDEO}
            autoPlay
            loop
            muted
            playsInline
          />
          {/* 噪声叠加 */}
          <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.7] mix-blend-overlay" />
          {/* 渐变叠加 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

          {/* Navbar */}
          <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
            <div className="rounded-b-2xl bg-black px-4 py-2 md:rounded-b-3xl md:px-8">
              <div className="flex items-center gap-3 sm:gap-6 md:gap-12 lg:gap-14">
                {NAV.map((item) => (
                  <a
                    key={item}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="text-[10px] transition-colors sm:text-xs md:text-sm"
                    style={{ color: 'rgba(225,224,204,0.8)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#E1E0CC')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(225,224,204,0.8)')}
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          </nav>

          {/* Hero 内容 */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-6 md:p-10">
            <div className="grid grid-cols-12 items-end gap-6">
              <div className="col-span-12 md:col-span-8">
                <h1 className="text-[#E1E0CC]">
                  <WordsPullUp
                    text="Prisma"
                    showAsterisk
                    className="text-[26vw] font-medium leading-[0.85] tracking-[-0.07em] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw]"
                  />
                </h1>
              </div>
              <div className="col-span-12 flex flex-col gap-6 md:col-span-4">
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
                  className="text-xs text-primary/70 sm:text-sm md:text-base"
                  style={{ lineHeight: 1.2 }}
                >
                  Prisma is a worldwide network of visual artists, filmmakers and storytellers bound
                  not by place, status or labels but by passion and hunger to unlock potential
                  through our unique perspectives.
                </motion.p>
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
                  className="group flex w-fit items-center gap-2 rounded-full bg-primary py-2 pl-6 pr-2 text-sm font-medium text-black sm:text-base"
                >
                  Join the lab
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ABOUT ============ */}
      <section className="bg-black px-4 py-24 md:px-6 md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl bg-[#101010] px-6 py-16 text-center md:px-16 md:py-24">
            <p className="mb-8 text-[10px] text-primary sm:text-xs">Visual arts</p>
            <WordsPullUpMultiStyle
              className="mx-auto max-w-3xl text-3xl leading-[0.95] sm:text-4xl sm:leading-[0.9] md:text-5xl lg:text-6xl xl:text-7xl"
              segments={[
                { text: 'I am Marcus Chen,' },
                { text: 'a self-taught director.', className: 'italic font-serif text-primary/80' },
                { text: 'I have skills in color grading, visual effects, and narrative design.' },
              ]}
            />
            <div className="mx-auto mt-10 max-w-2xl">
              <AnimatedLetters
                text="Over the last seven years, I have worked with Parallax, a Berlin-based production house that crafts cinema, series, and Noir Studio in Paris. Together, we have created work that has earned international acclaim at several major festivals."
                className="text-[#DEDBC8] text-xs sm:text-sm md:text-base"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="relative min-h-screen bg-black px-4 py-24 md:px-6 md:py-32">
        <div className="bg-noise pointer-events-none absolute inset-0 opacity-[0.15]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <WordsPullUpMultiStyle
              className="text-xl sm:text-2xl md:text-3xl lg:text-4xl"
              segments={[
                { text: 'Studio-grade workflows for visionary creators.' },
                { text: 'Built for pure vision. Powered by art.', className: 'text-gray-500' },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2 md:gap-1 lg:h-[480px] lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.7, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col justify-end overflow-hidden rounded-2xl bg-[#212121] p-6"
              >
                {f.video ? (
                  <video
                    className="absolute inset-0 h-full w-full object-cover"
                    src={f.video}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img src={f.icon} alt="" className="absolute left-5 top-5 h-10 w-10 rounded sm:h-12 sm:w-12" />
                )}
                {f.video && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                )}
                <div className="relative">
                  {f.num && (
                    <span className="text-[10px] text-gray-500">({f.num})</span>
                  )}
                  <h3 className="mt-1 text-lg font-medium text-[#E1E0CC]">{f.title}</h3>
                  {f.items && (
                    <ul className="mt-4 space-y-2">
                      {f.items.map((it) => (
                        <li key={it} className="flex items-center gap-2 text-xs text-gray-400">
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {it}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!f.video && (
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="mt-4 inline-flex items-center gap-1 text-xs text-primary"
                    >
                      Learn more <ArrowRight className="h-3 w-3 -rotate-45" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
