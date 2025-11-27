interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'error' | 'idle' | 'processing'
  label?: string
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  className?: string
}

const statusConfig = {
  active: {
    color: 'bg-cyber-green',
    glow: 'shadow-[0_0_10px_rgba(0,255,136,0.8)]',
    label: 'ACTIVE'
  },
  warning: {
    color: 'bg-cyber-yellow',
    glow: 'shadow-[0_0_10px_rgba(255,255,0,0.8)]',
    label: 'WARNING'
  },
  error: {
    color: 'bg-cyber-magenta',
    glow: 'shadow-[0_0_10px_rgba(255,0,255,0.8)]',
    label: 'ERROR'
  },
  idle: {
    color: 'bg-cyber-cyan/50',
    glow: 'shadow-[0_0_5px_rgba(0,255,247,0.3)]',
    label: 'IDLE'
  },
  processing: {
    color: 'bg-cyber-cyan',
    glow: 'shadow-[0_0_10px_rgba(0,255,247,0.8)]',
    label: 'PROCESSING'
  }
}

const sizeConfig = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4'
}

export default function StatusIndicator({
  status,
  label,
  size = 'md',
  pulse = true,
  className = ''
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const sizeClass = sizeConfig[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        {/* Pulse ring */}
        {pulse && (
          <div 
            className={`
              absolute inset-0 rounded-full ${config.color} opacity-50
              animate-ping
            `}
          />
        )}
        
        {/* Main dot */}
        <div 
          className={`
            relative rounded-full ${sizeClass} ${config.color} ${config.glow}
            ${status === 'processing' ? 'animate-pulse' : ''}
          `}
        />
      </div>
      
      {label !== undefined && (
        <span className="text-xs font-mono tracking-wider text-current opacity-70">
          {label || config.label}
        </span>
      )}
    </div>
  )
}

