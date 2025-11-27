import { ReactNode } from 'react'
import HUDCorner from './HUDCorner'

interface DataPanelProps {
  title: string
  children: ReactNode
  className?: string
  variant?: 'cyan' | 'magenta'
  icon?: ReactNode
  animated?: boolean
  radarSweep?: boolean
}

export default function DataPanel({
  title,
  children,
  className = '',
  variant = 'cyan',
  icon,
  animated = true,
  radarSweep = false
}: DataPanelProps) {
  const variantStyles = {
    cyan: {
      border: 'border-cyber-cyan/30',
      bg: 'bg-cyber-cyan/5',
      title: 'text-cyber-cyan',
      glow: 'shadow-cyber-cyan/10'
    },
    magenta: {
      border: 'border-cyber-magenta/30',
      bg: 'bg-cyber-magenta/5',
      title: 'text-cyber-magenta',
      glow: 'shadow-cyber-magenta/10'
    }
  }

  const styles = variantStyles[variant]

  // Check if className includes flex properties for layout
  const isFlexLayout = className.includes('flex')
  
  return (
    <HUDCorner color={variant} animated={animated} size="sm" className={isFlexLayout ? 'flex-1 min-h-0 flex flex-col' : ''}>
      <div 
        className={`
          relative
          ${styles.border} ${styles.bg} 
          border rounded-sm p-3
          backdrop-blur-sm
          ${className}
        `}
      >
        {/* Radar sweep effect */}
        {radarSweep && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-current to-transparent opacity-10"
              style={{
                animation: 'radar-sweep 3s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {/* Title bar */}
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          {icon && (
            <span className={`${styles.title} opacity-70`}>
              {icon}
            </span>
          )}
          <h3 className={`text-xs font-bold tracking-wider ${styles.title} uppercase`}>
            {title}
          </h3>
          <div className={`flex-1 h-px ${styles.border} ml-2`} />
        </div>

        {/* Content */}
        <div className={`relative z-10 ${isFlexLayout ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
          {children}
        </div>
      </div>
    </HUDCorner>
  )
}

