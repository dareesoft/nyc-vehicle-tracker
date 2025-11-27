import { useMemo, useEffect, useState } from 'react'
import { useTripStore } from '../stores/tripStore'
import { DataPanel, AnimatedNumber, StatusIndicator } from './ui'

export default function InfoPanel() {
  const { 
    getFilteredData, 
    currentIndex,
    tripStats,
    followVehicle,
    setFollowVehicle
  } = useTripStore()
  
  const filteredData = getFilteredData()
  const currentPoint = filteredData[currentIndex]
  
  // Track value changes for animation
  const [prevLinkId, setPrevLinkId] = useState<number | null>(null)
  const [linkChanged, setLinkChanged] = useState(false)
  
  useEffect(() => {
    if (currentPoint?.link_id !== prevLinkId) {
      setLinkChanged(true)
      setPrevLinkId(currentPoint?.link_id || null)
      const timer = setTimeout(() => setLinkChanged(false), 500)
      return () => clearTimeout(timer)
    }
  }, [currentPoint?.link_id, prevLinkId])
  
  // Format coordinates with animation-friendly values
  const formattedCoords = useMemo(() => {
    if (!currentPoint) return null
    return {
      lat: currentPoint.latitude,
      lng: currentPoint.longitude
    }
  }, [currentPoint])
  
  return (
    <div className="h-full overflow-y-auto scrollbar-cyber p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="data-label text-sm">TELEMETRY DATA</h2>
        
        {/* Follow vehicle toggle */}
        <button
          onClick={() => setFollowVehicle(!followVehicle)}
          className={`
            flex items-center gap-2 text-xs px-3 py-1.5 rounded border transition-all duration-300
            ${followVehicle
              ? 'border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan shadow-cyber-cyan/30 shadow-lg'
              : 'border-cyber-cyan/30 text-cyber-cyan/50 hover:border-cyber-cyan/50'
            }
          `}
        >
          <StatusIndicator 
            status={followVehicle ? 'active' : 'idle'} 
            size="sm" 
            pulse={followVehicle}
          />
          <span className="font-mono tracking-wider">
            {followVehicle ? 'TRACKING' : 'FREE CAM'}
          </span>
        </button>
      </div>
      
      {!currentPoint ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 border border-cyber-cyan/20 rounded-xl flex items-center justify-center mb-4 animate-pulse">
            <svg className="w-10 h-10 text-cyber-cyan/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
              />
            </svg>
          </div>
          <p className="text-cyber-cyan/30 text-sm">No data selected</p>
          <p className="text-cyber-cyan/20 text-xs mt-1">Select a trip to view telemetry</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* GPS Coordinates */}
          <DataPanel title="GPS POSITION" variant="cyan" radarSweep>
            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <p className="text-[10px] text-cyber-cyan/50 mb-1 tracking-wider">LATITUDE</p>
                <p className="font-mono text-cyber-cyan text-lg tabular-nums">
                  {formattedCoords?.lat.toFixed(6)}°
                </p>
              </div>
              <div className="group">
                <p className="text-[10px] text-cyber-cyan/50 mb-1 tracking-wider">LONGITUDE</p>
                <p className="font-mono text-cyber-cyan text-lg tabular-nums">
                  {formattedCoords?.lng.toFixed(6)}°
                </p>
              </div>
            </div>
          </DataPanel>
          
          {/* Link Info */}
          <DataPanel 
            title="ROAD LINK" 
            variant="magenta"
            animated={linkChanged}
          >
            <div className="space-y-3">
              <div className={`
                flex justify-between items-center p-2 rounded-sm transition-all duration-500
                ${linkChanged ? 'bg-cyber-magenta/20 animate-data-update' : 'bg-transparent'}
              `}>
                <span className="text-[10px] text-cyber-magenta/50 tracking-wider">LINK ID</span>
                <span className="font-mono text-cyber-magenta text-xl font-bold">
                  {currentPoint.link_id || '—'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-cyber-magenta/50 tracking-wider">DIRECTION</span>
                <span className={`
                  font-mono text-xs px-3 py-1 rounded-sm flex items-center gap-2
                  ${currentPoint.forward 
                    ? 'bg-cyber-green/20 text-cyber-green border border-cyber-green/30' 
                    : 'bg-cyber-orange/20 text-cyber-orange border border-cyber-orange/30'
                  }
                `}>
                  <span className="text-lg">{currentPoint.forward ? '→' : '←'}</span>
                  {currentPoint.forward ? 'FORWARD' : 'BACKWARD'}
                </span>
              </div>
            </div>
          </DataPanel>
          
          {/* Device Info */}
          <DataPanel title="DEVICE INFO" variant="cyan">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-cyber-cyan/50 tracking-wider">DEVICE ID</span>
                <span className="font-mono text-cyber-cyan text-[11px] bg-cyber-cyan/10 px-2 py-0.5 rounded">
                  {currentPoint.device_id}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-cyber-cyan/50 tracking-wider">SEQUENCE</span>
                <span className="font-mono text-cyber-cyan">{currentPoint.sequence}</span>
              </div>
            </div>
          </DataPanel>
          
          {/* Trip Stats */}
          {tripStats && (
            <DataPanel 
              title="TRIP STATISTICS" 
              variant="cyan"
              icon={
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                  />
                </svg>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-cyber-cyan/5 rounded">
                  <p className="text-[10px] text-cyber-cyan/50 mb-1">TOTAL IMAGES</p>
                  <p className="font-mono text-cyber-cyan text-lg">
                    <AnimatedNumber 
                      value={tripStats.total_images} 
                      duration={1000}
                    />
                  </p>
                </div>
                
                <div className="text-center p-2 bg-cyber-cyan/5 rounded">
                  <p className="text-[10px] text-cyber-cyan/50 mb-1">UNIQUE LINKS</p>
                  <p className="font-mono text-cyber-cyan text-lg">
                    <AnimatedNumber 
                      value={tripStats.unique_links} 
                      duration={800}
                    />
                  </p>
                </div>
                
                <div className="text-center p-2 bg-cyber-cyan/5 rounded">
                  <p className="text-[10px] text-cyber-cyan/50 mb-1">START</p>
                  <p className="font-mono text-cyber-cyan text-sm">
                    {formatTime(tripStats.start_time)}
                  </p>
                </div>
                
                <div className="text-center p-2 bg-cyber-cyan/5 rounded">
                  <p className="text-[10px] text-cyber-cyan/50 mb-1">END</p>
                  <p className="font-mono text-cyber-cyan text-sm">
                    {formatTime(tripStats.end_time)}
                  </p>
                </div>
              </div>
            </DataPanel>
          )}
        </div>
      )}
    </div>
  )
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '—'
  const parts = timestamp.split(' ')
  return parts[1]?.substring(0, 8) || timestamp
}
