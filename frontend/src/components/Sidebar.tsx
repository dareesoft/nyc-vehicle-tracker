import { useTripStore, Device, Trip } from '../stores/tripStore'
import { useStaggeredMount } from '../hooks/useAnimations'
import { StatusIndicator } from './ui'

interface SidebarProps {
  devices: Device[]
  trips: Trip[]
  isLoading: boolean
}

export default function Sidebar({ devices, trips, isLoading }: SidebarProps) {
  const { 
    selectedDevice, 
    setSelectedDevice, 
    selectedTrip, 
    setSelectedTrip,
  } = useTripStore()

  const { getItemProps: getDeviceProps } = useStaggeredMount(devices, 80, { initialDelay: 200 })
  const { getItemProps: getTripProps } = useStaggeredMount(trips, 60, { initialDelay: 100 })
  
  return (
    <aside className="w-72 glass-panel border-r border-cyber-cyan/20 flex flex-col">
      {/* Device selector */}
      <div className="p-4 border-b border-cyber-cyan/20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="data-label">SELECT DEVICE</h2>
          {devices.length > 0 && (
            <StatusIndicator status="active" size="sm" label={`${devices.length}`} />
          )}
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="cyber-spinner" />
              <span className="text-xs text-cyber-cyan/50 animate-pulse">SCANNING...</span>
            </div>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-6">
            <StatusIndicator status="processing" size="md" className="justify-center mb-2" />
            <p className="text-cyber-cyan/50 text-sm">
              No devices found. Scanning...
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-cyber">
            {devices.map((device, index) => (
              <button
                key={device.device_id}
                onClick={() => setSelectedDevice(device)}
                {...getDeviceProps(index)}
                className={`
                  w-full text-left p-3 rounded border transition-all duration-200
                  group relative overflow-hidden
                  ${selectedDevice?.device_id === device.device_id
                    ? 'border-cyber-cyan bg-cyber-cyan/10 shadow-cyber-cyan'
                    : 'border-cyber-cyan/20 hover:border-cyber-cyan/50 hover:bg-cyber-cyan/5'
                  }
                `}
              >
                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-cyan/0 via-cyber-cyan/5 to-cyber-cyan/0 
                  translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                
                {/* Selection indicator */}
                {selectedDevice?.device_id === device.device_id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-cyan animate-pulse" />
                )}
                
                <div className="relative z-10">
                  <p className="font-mono text-sm text-cyber-cyan truncate">
                    {device.device_id}
                  </p>
                  <div className="flex justify-between mt-1 text-xs text-cyber-cyan/50">
                    <span>{device.total_images.toLocaleString()} imgs</span>
                    <span>{device.total_days} days</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Trip selector */}
      <div className="p-4 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="data-label">SELECT TRIP</h2>
          {selectedDevice && trips.length > 0 && (
            <span className="text-xs text-cyber-magenta/70 font-mono">{trips.length} trips</span>
          )}
        </div>
        
        {!selectedDevice ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 border border-cyber-cyan/20 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-cyber-cyan/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
            </div>
            <p className="text-cyber-cyan/30 text-sm text-center">
              Select a device first
            </p>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-cyber-cyan/30 text-sm">No trips found</p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1 scrollbar-cyber">
            {trips.map((trip, index) => (
              <button
                key={trip.date}
                onClick={() => setSelectedTrip(trip)}
                {...getTripProps(index)}
                className={`
                  w-full text-left p-3 rounded border transition-all duration-200
                  group relative overflow-hidden
                  ${selectedTrip?.date === trip.date
                    ? 'border-cyber-magenta bg-cyber-magenta/10 shadow-cyber-magenta'
                    : 'border-cyber-cyan/20 hover:border-cyber-magenta/50 hover:bg-cyber-magenta/5'
                  }
                `}
              >
                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyber-magenta/0 via-cyber-magenta/5 to-cyber-magenta/0 
                  translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

                {/* Selection indicator */}
                {selectedTrip?.date === trip.date && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-magenta animate-pulse" />
                )}
                
                <div className="relative z-10">
                  <p className="font-mono text-sm text-white">
                    {trip.date}
                  </p>
                  <div className="flex justify-between mt-1 text-xs">
                    <span className="text-cyber-cyan/50">
                      {trip.image_count.toLocaleString()} images
                    </span>
                    <span className="text-cyber-magenta/70 font-mono">
                      {trip.unique_links} links
                    </span>
                  </div>
                  <div className="text-xs text-cyber-cyan/30 mt-1 font-mono">
                    {formatTime(trip.start_time)} → {formatTime(trip.end_time)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '—'
  try {
    const parts = timestamp.split(' ')
    if (parts.length >= 2) {
      return parts[1].substring(0, 5)
    }
    return timestamp.substring(11, 16)
  } catch {
    return timestamp
  }
}
