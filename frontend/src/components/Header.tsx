import { useTripStore } from '../stores/tripStore'
import { useStats } from '../hooks/useTrip'
import { useGlitch } from '../hooks/useAnimations'
import { AnimatedNumber, GlitchText, StatusIndicator, HUDCorner } from './ui'
import NotificationPanel from './NotificationPanel'

export default function Header() {
  const { viewMode, setViewMode, setShowTripSelector, selectedTrips, combinedRoutes } = useTripStore()
  const { data: stats } = useStats()
  const { isGlitching, triggerGlitch } = useGlitch()

  const handleModeChange = (mode: '2d' | '3d') => {
    triggerGlitch()
    setViewMode(mode)
  }

  return (
    <header className="h-16 glass-panel flex items-center justify-between px-6 border-b border-cyber-cyan/20 relative overflow-hidden">
      {/* Subtle radar sweep effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-cyan/5 to-transparent"
          style={{ animation: 'radar-sweep 4s ease-in-out infinite' }}
        />
      </div>

      {/* Logo & Title */}
      <div className="flex items-center gap-4 relative z-10">
        <HUDCorner color="cyan" size="sm" animated>
          <div className="w-10 h-10 border-2 border-cyber-cyan rounded-lg flex items-center justify-center bg-cyber-dark/50">
            <svg 
              className="w-6 h-6 text-cyber-cyan" 
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
        </HUDCorner>
        
        <div>
          <GlitchText 
            trigger="interval" 
            intervalMs={8000}
            intensity="low"
            className={isGlitching ? 'glitch-medium' : ''}
          >
            <h1 className="font-display text-xl font-bold tracking-wider text-cyber-cyan glow-text">
              VEHICLE TRACKING SYSTEM
            </h1>
          </GlitchText>
          <p className="text-xs text-cyber-cyan/50 tracking-widest">
            NYC SURVEILLANCE NETWORK v1.0
          </p>
        </div>
      </div>
      
      {/* Stats with animated numbers */}
      <div className="flex items-center gap-8 relative z-10">
        <div className="text-center">
          <p className="data-label text-[10px] tracking-widest mb-1">TOTAL IMAGES</p>
          <p className="data-value">
            {stats?.total_images ? (
              <AnimatedNumber 
                value={stats.total_images} 
                duration={2000}
                delay={300}
                className="text-cyber-cyan"
              />
            ) : '—'}
          </p>
        </div>
        
        <div className="text-center">
          <p className="data-label text-[10px] tracking-widest mb-1">DEVICES</p>
          <p className="data-value">
            {stats?.total_devices ? (
              <AnimatedNumber 
                value={stats.total_devices} 
                duration={1000}
                delay={500}
                className="text-cyber-cyan"
              />
            ) : '—'}
          </p>
        </div>
        
        <div className="text-center">
          <p className="data-label text-[10px] tracking-widest mb-1">STATUS</p>
          <div className="flex items-center justify-center gap-2">
            <StatusIndicator 
              status={stats?.cache_status === 'ready' ? 'active' : 'processing'}
              size="sm"
            />
            <span className={`data-value text-sm ${
              stats?.cache_status === 'ready' ? 'text-cyber-green' : 'text-cyber-yellow'
            }`}>
              {stats?.cache_status?.toUpperCase() || '—'}
            </span>
          </div>
        </div>
      </div>
      
      {/* View mode toggle and notifications */}
      <div className="flex items-center gap-4 relative z-10">
        {/* Multi-Trip Overlay Button */}
        <button
          onClick={() => setShowTripSelector(true)}
          className={`
            relative p-2 rounded-lg transition-all duration-200 group
            ${combinedRoutes 
              ? 'bg-cyber-magenta/20 text-cyber-magenta' 
              : 'text-cyber-cyan/50 hover:text-cyber-cyan hover:bg-cyber-cyan/10'
            }
          `}
          title="Multi-Trip Overlay"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
          {/* Selected count badge */}
          {selectedTrips.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyber-magenta text-white text-[10px] 
              font-bold rounded-full flex items-center justify-center">
              {selectedTrips.length}
            </span>
          )}
        </button>
        
        {/* Notification Bell */}
        <NotificationPanel />
        
        {/* View mode buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleModeChange('2d')}
            className={`
              cyber-button px-4 py-2 text-sm font-mono tracking-wider
              transition-all duration-200 relative overflow-hidden
              ${viewMode === '2d' 
                ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan shadow-cyber-cyan animate-glow-breathe' 
                : 'border-cyber-cyan/30 text-cyber-cyan/50 hover:border-cyber-cyan/60'
              }
            `}
          >
            {viewMode === '2d' && (
              <div className="absolute inset-0 bg-cyber-cyan/10" />
            )}
            <span className="relative z-10">2D MAP</span>
          </button>
          
          <button
            onClick={() => handleModeChange('3d')}
            className={`
              cyber-button px-4 py-2 text-sm font-mono tracking-wider
              transition-all duration-200 relative overflow-hidden
              ${viewMode === '3d' 
                ? 'bg-cyber-magenta/20 border-cyber-magenta text-cyber-magenta shadow-cyber-magenta animate-glow-breathe' 
                : 'border-cyber-magenta/30 text-cyber-magenta/50 hover:border-cyber-magenta/60'
              }
            `}
          >
            {viewMode === '3d' && (
              <div className="absolute inset-0 bg-cyber-magenta/10" />
            )}
            <span className="relative z-10">3D VIEW</span>
          </button>
        </div>
      </div>
    </header>
  )
}
