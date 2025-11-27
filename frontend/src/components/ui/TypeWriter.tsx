import { useEffect, useState } from 'react'

interface TypeWriterProps {
  text: string
  speed?: number
  delay?: number
  className?: string
  cursor?: boolean
  onComplete?: () => void
}

export default function TypeWriter({
  text,
  speed = 50,
  delay = 0,
  className = '',
  cursor = true,
  onComplete
}: TypeWriterProps) {
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let currentIndex = 0

    const startTyping = () => {
      setIsTyping(true)
      
      const typeNextChar = () => {
        if (currentIndex < text.length) {
          setDisplayText(text.substring(0, currentIndex + 1))
          currentIndex++
          timeoutId = setTimeout(typeNextChar, speed)
        } else {
          setIsTyping(false)
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

  // Cursor blink
  useEffect(() => {
    if (!cursor) return
    
    const interval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 500)

    return () => clearInterval(interval)
  }, [cursor])

  return (
    <span className={`font-mono ${className}`}>
      {displayText}
      {cursor && (
        <span 
          className={`
            inline-block w-[2px] h-[1em] ml-0.5 bg-current align-middle
            ${showCursor ? 'opacity-100' : 'opacity-0'}
            ${isTyping ? '' : 'animate-pulse'}
          `}
        />
      )}
    </span>
  )
}

