import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook for counting up to a target number with animation
 */
export function useCountUp(
  target: number,
  duration: number = 1500,
  options: {
    delay?: number
    startValue?: number
    onComplete?: () => void
  } = {}
) {
  const { delay = 0, startValue = 0, onComplete } = options
  const [value, setValue] = useState(startValue)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number>()

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = startValue
      const startTime = performance.now()

      setIsAnimating(true)

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = Math.round(start + (target - start) * eased)

        setValue(current)

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          setIsAnimating(false)
          onComplete?.()
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
  }, [target, duration, delay, startValue, onComplete])

  return { value, isAnimating }
}

/**
 * Hook for staggered mount animation of list items
 */
export function useStaggeredMount<T>(
  items: T[],
  staggerDelay: number = 100,
  options: {
    initialDelay?: number
    onAllMounted?: () => void
  } = {}
) {
  const { initialDelay = 0, onAllMounted } = options
  const [mountedCount, setMountedCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setMountedCount(0)
    setIsComplete(false)

    if (items.length === 0) {
      setIsComplete(true)
      return
    }

    const timeouts: ReturnType<typeof setTimeout>[] = []

    items.forEach((_, index) => {
      const timeout = setTimeout(() => {
        setMountedCount(prev => {
          const newCount = prev + 1
          if (newCount === items.length) {
            setIsComplete(true)
            onAllMounted?.()
          }
          return newCount
        })
      }, initialDelay + index * staggerDelay)
      
      timeouts.push(timeout)
    })

    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [items, staggerDelay, initialDelay, onAllMounted])

  const getItemProps = useCallback((index: number) => ({
    style: {
      animationDelay: `${initialDelay + index * staggerDelay}ms`,
    },
    className: index < mountedCount ? 'animate-fade-slide-in' : 'opacity-0',
  }), [mountedCount, staggerDelay, initialDelay])

  return {
    mountedCount,
    isComplete,
    getItemProps,
    isMounted: (index: number) => index < mountedCount
  }
}

/**
 * Hook for typewriter text animation
 */
export function useTypewriter(
  text: string,
  speed: number = 50,
  options: {
    delay?: number
    onComplete?: () => void
  } = {}
) {
  const { delay = 0, onComplete } = options
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setDisplayText('')
    setIsComplete(false)

    let currentIndex = 0
    let timeoutId: ReturnType<typeof setTimeout>

    const startTyping = () => {
      setIsTyping(true)

      const typeNextChar = () => {
        if (currentIndex < text.length) {
          setDisplayText(text.substring(0, currentIndex + 1))
          currentIndex++
          timeoutId = setTimeout(typeNextChar, speed)
        } else {
          setIsTyping(false)
          setIsComplete(true)
          onComplete?.()
        }
      }

      typeNextChar()
    }

    const delayTimeout = setTimeout(startTyping, delay)

    return () => {
      clearTimeout(delayTimeout)
      clearTimeout(timeoutId)
    }
  }, [text, speed, delay, onComplete])

  return { displayText, isTyping, isComplete }
}

/**
 * Hook for triggering glitch effect
 */
export function useGlitch(duration: number = 200) {
  const [isGlitching, setIsGlitching] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const triggerGlitch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setIsGlitching(true)
    timeoutRef.current = setTimeout(() => {
      setIsGlitching(false)
    }, duration)
  }, [duration])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { isGlitching, triggerGlitch }
}

/**
 * Hook for pulsing animation trigger
 */
export function usePulse(interval: number = 2000) {
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setIsPulsing(true)
      setTimeout(() => setIsPulsing(false), 300)
    }, interval)

    return () => clearInterval(pulseInterval)
  }, [interval])

  return isPulsing
}

/**
 * Hook for detecting when element enters viewport
 */
export function useInView(
  ref: React.RefObject<HTMLElement>,
  options: IntersectionObserverInit = {}
) {
  const [isInView, setIsInView] = useState(false)
  const [hasBeenInView, setHasBeenInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting)
      if (entry.isIntersecting) {
        setHasBeenInView(true)
      }
    }, {
      threshold: 0.1,
      ...options
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [ref, options])

  return { isInView, hasBeenInView }
}

