import { motion, useScroll, useTransform, MotionValue } from 'framer-motion'
import { useRef } from 'react'

interface AnimatedTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

function Char({
  char,
  progress,
  range,
}: {
  char: string
  progress: MotionValue<number>
  range: [number, number]
}) {
  const opacity = useTransform(progress, range, [0.2, 1])
  return (
    <span className="relative inline">
      <span className="opacity-20">{char}</span>
      <motion.span style={{ opacity }} className="absolute left-0">
        {char}
      </motion.span>
    </span>
  )
}

export default function AnimatedText({ text, className, style }: AnimatedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.8', 'end 0.2'],
  })

  const chars = text.split('')

  return (
    <p ref={ref} className={className} style={style}>
      {chars.map((char, i) => {
        const start = i / chars.length
        const end = (i + 1) / chars.length
        return (
          <Char key={i} char={char} progress={scrollYProgress} range={[start, end]} />
        )
      })}
    </p>
  )
}
