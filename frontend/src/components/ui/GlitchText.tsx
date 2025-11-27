import { ReactNode, useState, useEffect } from 'react'

interface GlitchTextProps {
  children: ReactNode
  className?: string
  intensity?: 'low' | 'medium' | 'high'
  trigger?: 'hover' | 'always' | 'interval'
  intervalMs?: number
}

export default function GlitchText({
  children,
  className = '',
  intensity = 'medium',
  trigger = 'hover',
  intervalMs = 5000
}: GlitchTextProps) {
  const [isGlitching, setIsGlitching] = useState(false)

  useEffect(() => {
    if (trigger === 'always') {
      setIsGlitching(true)
      return
    }

    if (trigger === 'interval') {
      const interval = setInterval(() => {
        setIsGlitching(true)
        setTimeout(() => setIsGlitching(false), 200)
      }, intervalMs)
      
      return () => clearInterval(interval)
    }
  }, [trigger, intervalMs])

  const intensityClass = {
    low: 'glitch-low',
    medium: 'glitch-medium',
    high: 'glitch-high'
  }

  return (
    <span
      className={`
        relative inline-block
        ${isGlitching || trigger === 'always' ? intensityClass[intensity] : ''}
        ${trigger === 'hover' ? 'hover:glitch-medium' : ''}
        ${className}
      `}
      data-text={typeof children === 'string' ? children : ''}
      onMouseEnter={() => trigger === 'hover' && setIsGlitching(true)}
      onMouseLeave={() => trigger === 'hover' && setIsGlitching(false)}
    >
      {children}
    </span>
  )
}

