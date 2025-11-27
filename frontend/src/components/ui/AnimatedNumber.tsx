import { useEffect, useState, useRef } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  delay?: number
  className?: string
  formatter?: (value: number) => string
}

export default function AnimatedNumber({
  value,
  duration = 1500,
  delay = 0,
  className = '',
  formatter = (v) => v.toLocaleString()
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const previousValue = useRef(0)
  const animationRef = useRef<number>()

  useEffect(() => {
    const timeout = setTimeout(() => {
      const startValue = previousValue.current
      const endValue = value
      const startTime = performance.now()

      setIsAnimating(true)

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Easing function (ease-out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3)
        
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOut)
        setDisplayValue(currentValue)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          previousValue.current = endValue
          setIsAnimating(false)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration, delay])

  return (
    <span 
      className={`
        font-mono tabular-nums transition-all
        ${isAnimating ? 'text-shadow-glow' : ''}
        ${className}
      `}
    >
      {formatter(displayValue)}
    </span>
  )
}

