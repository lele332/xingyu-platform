import { motion, useInView, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

/** 单词逐个上浮的标题动画 */
export function WordsPullUp({
  text,
  className = '',
  showAsterisk = false,
  delay = 0,
  stagger = 0.08,
}: {
  text: string
  className?: string
  showAsterisk?: boolean
  delay?: number
  stagger?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  const words = text.split(' ')

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: delay + i * stagger, ease: EASE }}
          className="relative inline-block"
        >
          {word}
          {showAsterisk && i === words.length - 1 && (
            <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em] leading-none">*</span>
          )}
          {i < words.length - 1 && <span>&nbsp;</span>}
        </motion.span>
      ))}
    </span>
  )
}

/** 多段式标题：每段可指定不同 className（如 serif 斜体），逐词上浮 */
export function WordsPullUpMultiStyle({
  segments,
  className = '',
  delay = 0,
  stagger = 0.08,
}: {
  segments: { text: string; className?: string }[]
  className?: string
  delay?: number
  stagger?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })
  let wordIndex = 0

  return (
    <span ref={ref} className={`inline-flex flex-wrap justify-center ${className}`}>
      {segments.map((seg, si) =>
        seg.text.split(' ').map((word, wi) => {
          const idx = wordIndex++
          const totalWords = segments.reduce((n, s) => n + s.text.split(' ').length, 0)
          return (
            <motion.span
              key={`${si}-${wi}`}
              initial={{ y: 20, opacity: 0 }}
              animate={isInView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: delay + idx * stagger, ease: EASE }}
              className={`inline-block ${seg.className ?? ''}`}
            >
              {word}
              {idx < totalWords - 1 && <span>&nbsp;</span>}
            </motion.span>
          )
        }),
      )}
    </span>
  )
}

/** 滚动驱动的逐字透明度揭示（About 段落） */
export function AnimatedLetters({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.8', 'end 0.2'],
  })
  const chars = text.split('')
  return (
    <p ref={ref} className={className}>
      {chars.map((c, i) => (
        <AnimatedLetter key={i} index={i} total={chars.length} progress={scrollYProgress}>
          {c}
        </AnimatedLetter>
      ))}
    </p>
  )
}

function AnimatedLetter({
  children,
  index,
  total,
  progress,
}: {
  children: ReactNode
  index: number
  total: number
  progress: MotionValue<number>
}) {
  const charProgress = index / total
  const opacity = useTransform(
    progress,
    [Math.max(0, charProgress - 0.1), Math.min(1, charProgress + 0.05)],
    [0.2, 1],
  )
  return <motion.span style={{ opacity }}>{children}</motion.span>
}
