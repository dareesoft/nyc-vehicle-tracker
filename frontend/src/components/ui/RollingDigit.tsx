import { useEffect, useState, useRef, memo } from 'react'

interface SingleDigitProps {
  digit: string
  className?: string
}

// Single digit with rolling animation
const SingleDigit = memo(function SingleDigit({ digit, className = '' }: SingleDigitProps) {
  const [prevDigit, setPrevDigit] = useState(digit)
  const [isAnimating, setIsAnimating] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (digit !== prevDigit) {
      setIsAnimating(true)
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        setPrevDigit(digit)
        setIsAnimating(false)
      }, 150)
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [digit, prevDigit])

  return (
    <span className={`inline-block relative overflow-hidden ${className}`}>
      {/* Current digit (slides in from top) */}
      <span 
        className={`
          inline-block transition-transform duration-150 ease-out
          ${isAnimating ? 'animate-roll-in' : ''}
        `}
      >
        {digit}
      </span>
      
      {/* Previous digit (slides out to bottom) - only during animation */}
      {isAnimating && (
        <span 
          className="absolute inset-0 inline-block animate-roll-out"
        >
          {prevDigit}
        </span>
      )}
    </span>
  )
})

interface RollingTextProps {
  text: string
  className?: string
  digitClassName?: string
}

// Rolling text - each character animates independently
export default function RollingText({ text, className = '', digitClassName = '' }: RollingTextProps) {
  return (
    <span className={`inline-flex font-mono tabular-nums ${className}`}>
      {text.split('').map((char, index) => (
        <SingleDigit 
          key={`${index}-pos`} 
          digit={char} 
          className={digitClassName}
        />
      ))}
    </span>
  )
}

// Specialized component for timestamps (HH:MM:SS format)
interface RollingTimestampProps {
  timestamp: string
  className?: string
}

export function RollingTimestamp({ timestamp, className = '' }: RollingTimestampProps) {
  // Parse timestamp format "HH:MM:SS" or handle invalid input
  const formatted = timestamp || '--:--:--'
  
  return (
    <RollingText 
      text={formatted} 
      className={className}
      digitClassName="w-[0.6em]"
    />
  )
}

// Specialized component for frame numbers
interface RollingNumberProps {
  value: number
  padLength?: number
  className?: string
}

export function RollingNumber({ value, padLength = 0, className = '' }: RollingNumberProps) {
  const formatted = padLength > 0 
    ? value.toString().padStart(padLength, '0')
    : value.toString()
  
  return (
    <RollingText 
      text={formatted} 
      className={className}
    />
  )
}

// Specialized for coordinates (with decimal)
interface RollingCoordinateProps {
  value: number
  decimals?: number
  className?: string
}

export function RollingCoordinate({ value, decimals = 5, className = '' }: RollingCoordinateProps) {
  const formatted = value.toFixed(decimals)
  
  return (
    <RollingText 
      text={formatted} 
      className={className}
    />
  )
}

