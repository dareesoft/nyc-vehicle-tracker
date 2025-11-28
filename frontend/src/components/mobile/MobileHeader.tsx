/**
 * Mobile Header Component
 * Compact header for mobile view with essential controls
 */

import { useTripStore } from '../../stores/tripStore'
import { useStats } from '../../hooks/useTrip'
import { useAuth } from '../../hooks/useAuth'
import { StatusIndicator } from '../ui'

export default function MobileHeader() {
  const { viewMode, setViewMode, selectedDevice, selectedTrip } = useTripStore()
  const { data: stats } = useStats()
  const { logout } = useAuth()

  return (
    <header className="h-12 glass-panel flex items-center justify-between px-3 border-b border-cyber-cyan/20 relative z-20">
      {/* Logo & Status */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 border border-cyber-cyan rounded flex items-center justify-center bg-cyber-dark/50">
          <svg 
            className="w-4 h-4 text-cyber-cyan" 
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
        
        <div className="flex flex-col">
          <span className="text-xs font-mono text-cyber-cyan font-bold tracking-wide">
            VTS
          </span>
          <span className="text-[9px] text-cyber-cyan/50">
            {selectedDevice?.device_id || 'NO DEVICE'}
          </span>
        </div>
      </div>
      
      {/* Center: Trip info */}
      {selectedTrip && (
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <span className="text-xs font-mono text-cyber-magenta">
            {selectedTrip.date}
          </span>
        </div>
      )}
      
      {/* Right: Status, View Toggle & Logout */}
      <div className="flex items-center gap-2">
        {/* System status */}
        <StatusIndicator 
          status={stats?.cache_status === 'ready' ? 'active' : 'processing'}
          size="sm"
        />
        
        {/* 2D/3D Toggle */}
        <div className="flex bg-cyber-dark/50 rounded border border-cyber-cyan/20">
          <button
            onClick={() => setViewMode('2d')}
            className={`
              px-2 py-1 text-[10px] font-mono transition-all
              ${viewMode === '2d' 
                ? 'bg-cyber-cyan/20 text-cyber-cyan' 
                : 'text-cyber-cyan/50'
              }
            `}
          >
            2D
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`
              px-2 py-1 text-[10px] font-mono transition-all
              ${viewMode === '3d' 
                ? 'bg-cyber-magenta/20 text-cyber-magenta' 
                : 'text-cyber-magenta/50'
              }
            `}
          >
            3D
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-1.5 rounded border border-cyber-magenta/30 text-cyber-magenta/70 
            active:bg-cyber-magenta/20 transition-colors"
          title="Logout"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
            />
          </svg>
        </button>
      </div>
    </header>
  )
}

