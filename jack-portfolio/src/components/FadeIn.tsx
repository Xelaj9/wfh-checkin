import { motion } from 'framer-motion'
import { ReactNode, useMemo } from 'react'

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  x?: number
  y?: number
  as?: keyof JSX.IntrinsicElements
  className?: string
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  as = 'div',
  className,
}: FadeInProps) {
  const MotionComponent = useMemo(() => motion.create(as), [as])

  return (
    <MotionComponent
      className={className}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '50px', amount: 0 }}
      transition={{ delay, duration, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </MotionComponent>
  )
}
