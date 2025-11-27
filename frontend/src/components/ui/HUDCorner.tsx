import { ReactNode } from 'react'

interface HUDCornerProps {
  children: ReactNode
  className?: string
  color?: 'cyan' | 'magenta' | 'yellow'
  animated?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const colorMap = {
  cyan: 'border-cyber-cyan',
  magenta: 'border-cyber-magenta',
  yellow: 'border-cyber-yellow'
}

const sizeMap = {
  sm: { corner: 'w-3 h-3', border: '1px' },
  md: { corner: 'w-5 h-5', border: '2px' },
  lg: { corner: 'w-8 h-8', border: '2px' }
}

export default function HUDCorner({
  children,
  className = '',
  color = 'cyan',
  animated = true,
  size = 'md'
}: HUDCornerProps) {
  const borderColor = colorMap[color]
  const { corner } = sizeMap[size]

  return (
    <div className={`relative ${className}`}>
      {/* Top-left corner */}
      <div 
        className={`
          absolute -top-1 -left-1 ${corner} ${borderColor}
          border-t-2 border-l-2
          ${animated ? 'animate-pulse' : ''}
        `} 
      />
      
      {/* Top-right corner */}
      <div 
        className={`
          absolute -top-1 -right-1 ${corner} ${borderColor}
          border-t-2 border-r-2
          ${animated ? 'animate-pulse' : ''}
        `}
        style={{ animationDelay: '0.1s' }}
      />
      
      {/* Bottom-left corner */}
      <div 
        className={`
          absolute -bottom-1 -left-1 ${corner} ${borderColor}
          border-b-2 border-l-2
          ${animated ? 'animate-pulse' : ''}
        `}
        style={{ animationDelay: '0.2s' }}
      />
      
      {/* Bottom-right corner */}
      <div 
        className={`
          absolute -bottom-1 -right-1 ${corner} ${borderColor}
          border-b-2 border-r-2
          ${animated ? 'animate-pulse' : ''}
        `}
        style={{ animationDelay: '0.3s' }}
      />
      
      {children}
    </div>
  )
}

