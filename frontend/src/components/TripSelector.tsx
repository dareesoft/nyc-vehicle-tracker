import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { HUDCorner } from './ui'

interface Device {
  device_id: string
  total_images: number
  total_days: number
}

interface Trip {
  date: string
  image_count: number
  start_time: string
  end_time: string
  unique_links: number
}

interface SelectedTrip {
  device_id: string
  date: string
}

interface CombinedRoutesResponse {
  type: string
  features: any[]
  trip_count: number
}

interface CombinedDetectionsResponse {
  type: string
  features: any[]
  total: number
  trip_count: number
}

const API_BASE = '/api'

const TRIP_COLORS = [
  '#00fff7',  // cyan
  '#ff00ff',  // magenta
  '#ffff00',  // yellow
  '#00ff00',  // green
  '#ff6600',  // orange
  '#ff0066',  // pink
  '#6600ff',  // purple
  '#00ffcc',  // teal
]

interface TripSelectorProps {
  devices: Device[]
  onRoutesChange: (routes: CombinedRoutesResponse | null) => void
  onDetectionsChange: (detections: CombinedDetectionsResponse | null) => void
  isOpen: boolean
  onClose: () => void
}

export default function TripSelector({ devices, onRoutesChange, onDetectionsChange, isOpen, onClose }: TripSelectorProps) {
  const [selectedTrips, setSelectedTrips] = useState<SelectedTrip[]>([])
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null)
  
  // Fetch trips for expanded device
  const { data: trips } = useQuery<Trip[]>({
    queryKey: ['trips', expandedDevice],
    queryFn: async () => {
      if (!expandedDevice) return []
      const res = await fetch(`${API_BASE}/trips/${expandedDevice}`)
      if (!res.ok) throw new Error('Failed to fetch trips')
      return res.json()
    },
    enabled: !!expandedDevice,
  })
  
  // Fetch combined routes
  const { mutate: fetchCombinedRoutes, isPending: isRoutesPending } = useMutation({
    mutationFn: async (trips: SelectedTrip[]) => {
      if (trips.length === 0) return null
      const res = await fetch(`${API_BASE}/combined-routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trips })
      })
      if (!res.ok) throw new Error('Failed to fetch routes')
      return res.json() as Promise<CombinedRoutesResponse>
    },
    onSuccess: (data) => {
      onRoutesChange(data)
    }
  })
  
  // Fetch combined detections
  const { mutate: fetchCombinedDetections, isPending: isDetectionsPending } = useMutation({
    mutationFn: async (trips: SelectedTrip[]) => {
      if (trips.length === 0) return null
      const res = await fetch(`${API_BASE}/combined-detections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trips })
      })
      if (!res.ok) throw new Error('Failed to fetch detections')
      return res.json() as Promise<CombinedDetectionsResponse>
    },
    onSuccess: (data) => {
      onDetectionsChange(data)
    }
  })
  
  const isPending = isRoutesPending || isDetectionsPending
  
  const toggleTrip = (deviceId: string, date: string) => {
    setSelectedTrips(prev => {
      const exists = prev.some(t => t.device_id === deviceId && t.date === date)
      if (exists) {
        return prev.filter(t => !(t.device_id === deviceId && t.date === date))
      } else {
        return [...prev, { device_id: deviceId, date }]
      }
    })
  }
  
  const isSelected = (deviceId: string, date: string) => {
    return selectedTrips.some(t => t.device_id === deviceId && t.date === date)
  }
  
  const getSelectedCount = (deviceId: string) => {
    return selectedTrips.filter(t => t.device_id === deviceId).length
  }
  
  const selectAllForDevice = (deviceId: string) => {
    if (!trips) return
    const allTripsForDevice = trips.map(t => ({ device_id: deviceId, date: t.date }))
    setSelectedTrips(prev => {
      const otherDeviceTrips = prev.filter(t => t.device_id !== deviceId)
      return [...otherDeviceTrips, ...allTripsForDevice]
    })
  }
  
  const clearDevice = (deviceId: string) => {
    setSelectedTrips(prev => prev.filter(t => t.device_id !== deviceId))
  }
  
  const clearAll = () => {
    setSelectedTrips([])
    onRoutesChange(null)
    onDetectionsChange(null)
  }
  
  const applySelection = () => {
    fetchCombinedRoutes(selectedTrips)
    fetchCombinedDetections(selectedTrips)
  }
  
  const getTripColor = (index: number) => {
    return TRIP_COLORS[index % TRIP_COLORS.length]
  }
  
  // Create a legend for selected trips
  const legend = useMemo(() => {
    return selectedTrips.map((trip, i) => ({
      ...trip,
      color: getTripColor(i)
    }))
  }, [selectedTrips])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass-panel border border-cyber-cyan/30 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyber-cyan/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <HUDCorner color="cyan" size="sm">
              <div className="flex items-center gap-2 p-2">
                <svg className="w-5 h-5 text-cyber-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
                  />
                </svg>
                <span className="data-label">MULTI-TRIP OVERLAY</span>
              </div>
            </HUDCorner>
            
            <div className="text-sm text-cyber-cyan/50">
              Select multiple trips to overlay on map
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="text-cyber-cyan/50 hover:text-cyber-cyan transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Device/Trip List */}
          <div className="w-1/2 border-r border-cyber-cyan/20 overflow-y-auto scrollbar-cyber">
            {devices.map((device) => (
              <div key={device.device_id} className="border-b border-cyber-cyan/10">
                {/* Device Header */}
                <button
                  onClick={() => setExpandedDevice(
                    expandedDevice === device.device_id ? null : device.device_id
                  )}
                  className={`
                    w-full px-4 py-3 flex items-center justify-between text-left transition-colors
                    ${expandedDevice === device.device_id 
                      ? 'bg-cyber-cyan/10' 
                      : 'hover:bg-cyber-cyan/5'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 text-cyber-cyan transition-transform ${
                      expandedDevice === device.device_id ? 'rotate-90' : ''
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-mono text-sm text-cyber-cyan">{device.device_id}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getSelectedCount(device.device_id) > 0 && (
                      <span className="px-2 py-0.5 bg-cyber-magenta/20 text-cyber-magenta text-xs rounded">
                        {getSelectedCount(device.device_id)} selected
                      </span>
                    )}
                    <span className="text-xs text-cyber-cyan/50">
                      {device.total_images.toLocaleString()} imgs
                    </span>
                  </div>
                </button>
                
                {/* Trips */}
                {expandedDevice === device.device_id && trips && (
                  <div className="bg-cyber-dark/50 border-t border-cyber-cyan/10">
                    {/* Bulk actions */}
                    <div className="px-4 py-2 flex gap-2 border-b border-cyber-cyan/10">
                      <button
                        onClick={() => selectAllForDevice(device.device_id)}
                        className="text-[10px] text-cyber-cyan/50 hover:text-cyber-cyan transition-colors"
                      >
                        SELECT ALL
                      </button>
                      <span className="text-cyber-cyan/20">|</span>
                      <button
                        onClick={() => clearDevice(device.device_id)}
                        className="text-[10px] text-cyber-cyan/50 hover:text-cyber-cyan transition-colors"
                      >
                        CLEAR
                      </button>
                    </div>
                    
                    {trips.map((trip) => (
                      <button
                        key={trip.date}
                        onClick={() => toggleTrip(device.device_id, trip.date)}
                        className={`
                          w-full px-6 py-2 flex items-center justify-between text-left transition-colors
                          ${isSelected(device.device_id, trip.date)
                            ? 'bg-cyber-magenta/10'
                            : 'hover:bg-cyber-cyan/5'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                            ${isSelected(device.device_id, trip.date)
                              ? 'border-cyber-magenta bg-cyber-magenta'
                              : 'border-cyber-cyan/30'
                            }
                          `}>
                            {isSelected(device.device_id, trip.date) && (
                              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="font-mono text-sm text-white">{trip.date}</span>
                        </div>
                        
                        <span className="text-xs text-cyber-cyan/50">
                          {trip.image_count.toLocaleString()} imgs
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Selection Summary / Legend */}
          <div className="w-1/2 p-4 flex flex-col">
            <h3 className="data-label text-sm mb-3">SELECTED TRIPS ({selectedTrips.length})</h3>
            
            {selectedTrips.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-cyber-cyan/30 text-sm">
                No trips selected
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto scrollbar-cyber space-y-2">
                {legend.map((trip) => (
                  <div 
                    key={`${trip.device_id}-${trip.date}`}
                    className="flex items-center gap-3 p-2 bg-cyber-dark/50 rounded border border-cyber-cyan/10"
                  >
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: trip.color }}
                    />
                    <div className="flex-1">
                      <div className="text-xs text-white font-mono">{trip.date}</div>
                      <div className="text-[10px] text-cyber-cyan/50">{trip.device_id.slice(-8)}</div>
                    </div>
                    <button
                      onClick={() => toggleTrip(trip.device_id, trip.date)}
                      className="text-cyber-cyan/30 hover:text-cyber-magenta transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyber-cyan/20 flex items-center justify-between">
          <button
            onClick={clearAll}
            className="px-4 py-2 text-sm text-cyber-cyan/50 hover:text-cyber-cyan transition-colors"
          >
            Clear All
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-cyber-cyan/30 text-cyber-cyan/70 hover:bg-cyber-cyan/10 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={applySelection}
              disabled={selectedTrips.length === 0 || isPending}
              className={`
                px-6 py-2 text-sm rounded font-medium transition-all
                ${selectedTrips.length === 0
                  ? 'bg-cyber-cyan/10 text-cyber-cyan/30 cursor-not-allowed'
                  : 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 hover:bg-cyber-cyan/30'
                }
              `}
            >
              {isPending ? 'Loading...' : `Apply (${selectedTrips.length} trips)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

