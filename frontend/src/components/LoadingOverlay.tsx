interface LoadingOverlayProps {
  progress: number
  total: number
  status: string
}

export default function LoadingOverlay({ progress, total, status }: LoadingOverlayProps) {
  const percentage = total > 0 ? (progress / total) * 100 : 0
  
  return (
    <div className="fixed inset-0 bg-cyber-black/95 z-50 flex items-center justify-center">
      <div className="text-center max-w-md w-full px-8">
        {/* Logo animation */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto relative">
            <div className="absolute inset-0 border-4 border-cyber-cyan/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-4 border-cyber-magenta/30 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
            <div className="absolute inset-4 border-4 border-cyber-cyan rounded-full animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg 
                className="w-10 h-10 text-cyber-cyan animate-pulse" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
                />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h1 className="font-display text-2xl font-bold text-cyber-cyan glow-text mb-2">
          INITIALIZING SYSTEM
        </h1>
        <p className="text-cyber-cyan/50 text-sm mb-8">
          Scanning image metadata...
        </p>
        
        {/* Progress bar */}
        <div className="relative h-2 bg-cyber-dark rounded overflow-hidden mb-4">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/20 via-cyber-magenta/20 to-cyber-cyan/20 animate-pulse" />
          
          {/* Progress fill */}
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyber-cyan to-cyber-magenta transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Glow effect at the edge */}
          <div 
            className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent to-white/30 transition-all duration-300"
            style={{ left: `calc(${percentage}% - 2rem)` }}
          />
        </div>
        
        {/* Stats */}
        <div className="flex justify-between text-sm font-mono">
          <span className="text-cyber-cyan">
            {progress.toLocaleString()} / {total.toLocaleString()}
          </span>
          <span className="text-cyber-magenta">
            {percentage.toFixed(1)}%
          </span>
        </div>
        
        {/* Status */}
        <p className="mt-4 text-xs text-cyber-cyan/30 uppercase tracking-widest">
          STATUS: {status}
        </p>
        
        {/* Tip */}
        <p className="mt-8 text-xs text-cyber-cyan/20">
          First-time setup may take several minutes for large datasets
        </p>
      </div>
    </div>
  )
}

