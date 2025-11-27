import { useState, useMemo } from 'react'
import { useTripStore } from '../stores/tripStore'
import { getImageUrl, useDetections, Detection } from '../hooks/useTrip'
import { DataPanel, StatusIndicator } from './ui'

// Corner-style bounding box component (like inference_video_yolo.py)
interface CornerBoundingBoxProps {
  x1: number
  y1: number
  x2: number
  y2: number
  imgWidth: number
  imgHeight: number
  className: string
  showLabel?: boolean
  label?: string
}

function CornerBoundingBox({ 
  x1, y1, x2, y2, 
  imgWidth, imgHeight, 
  className,
  showLabel = false,
  label
}: CornerBoundingBoxProps) {
  // Calculate percentage positions
  const left = (x1 / imgWidth) * 100
  const top = (y1 / imgHeight) * 100
  const width = ((x2 - x1) / imgWidth) * 100
  const height = ((y2 - y1) / imgHeight) * 100
  
  // Corner length (percentage of box size)
  const cornerLen = Math.min(width, height) * 0.25
  
  // Class-based colors (green for numeric, red for textonly)
  const isNumeric = className === 'white-speed-numeric'
  const color = isNumeric ? '#22c55e' : '#ef4444' // green-500 / red-500
  const bgColor = isNumeric ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'
  
  return (
    <div 
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
    >
      {/* Top-left corner */}
      <div className="absolute top-0 left-0" style={{ 
        width: `${cornerLen}%`, 
        height: '3px', 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      <div className="absolute top-0 left-0" style={{ 
        width: '3px', 
        height: `${cornerLen}%`, 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      
      {/* Top-right corner */}
      <div className="absolute top-0 right-0" style={{ 
        width: `${cornerLen}%`, 
        height: '3px', 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      <div className="absolute top-0 right-0" style={{ 
        width: '3px', 
        height: `${cornerLen}%`, 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      
      {/* Bottom-left corner */}
      <div className="absolute bottom-0 left-0" style={{ 
        width: `${cornerLen}%`, 
        height: '3px', 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      <div className="absolute bottom-0 left-0" style={{ 
        width: '3px', 
        height: `${cornerLen}%`, 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      
      {/* Bottom-right corner */}
      <div className="absolute bottom-0 right-0" style={{ 
        width: `${cornerLen}%`, 
        height: '3px', 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      <div className="absolute bottom-0 right-0" style={{ 
        width: '3px', 
        height: `${cornerLen}%`, 
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      
      {/* Label */}
      {showLabel && label && (
        <div 
          className="absolute -top-6 left-0 px-2 py-0.5 text-white text-xs font-mono font-bold whitespace-nowrap"
          style={{ backgroundColor: bgColor }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

export default function DetectionPanel() {
  const { selectedDevice, selectedTrip, setCurrentIndex, tripData } = useTripStore()
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  
  // Fetch detections for current trip
  const { data, isLoading } = useDetections(
    selectedDevice?.device_id || null,
    selectedTrip?.date || null
  )
  
  const detections = data?.detections || []
  
  // Group by class
  const byClass = useMemo(() => {
    const groups: Record<string, Detection[]> = {}
    for (const det of detections) {
      if (!groups[det.class_name]) groups[det.class_name] = []
      groups[det.class_name].push(det)
    }
    return groups
  }, [detections])
  
  // Filter by selected class
  const filteredDetections = useMemo(() => {
    if (!selectedClass) return detections
    return detections.filter(d => d.class_name === selectedClass)
  }, [detections, selectedClass])
  
  // Navigate to detection
  const goToDetection = (detection: Detection) => {
    setSelectedDetection(detection)
    
    // Find the frame index in trip data
    const index = tripData.findIndex(p => p.file_path === detection.file_path)
    if (index >= 0) {
      setCurrentIndex(index)
    }
  }
  
  const getClassLabel = (className: string) => {
    switch (className) {
      case 'white-speed-numeric': return 'SPEED LIMIT'
      case 'white-speed-textonly': return 'SPEED TEXT'
      default: return className.toUpperCase()
    }
  }
  
  const getClassColor = (className: string) => {
    switch (className) {
      case 'white-speed-numeric': return 'green-500'  // Green for numeric
      case 'white-speed-textonly': return 'red-500'   // Red for textonly
      default: return 'cyber-cyan'
    }
  }
  
  // Image resolution for proper bounding box scaling
  const IMG_WIDTH = 2472
  const IMG_HEIGHT = 1440
  
  if (!selectedDevice || !selectedTrip) {
    return null
  }
  
  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <DataPanel 
        title="SPEED SIGN DETECTIONS" 
        variant="magenta"
        icon={
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        }
        className="flex-1 flex flex-col min-h-0"
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="cyber-spinner" />
          </div>
        ) : detections.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6">
            <svg className="w-12 h-12 text-cyber-magenta/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-cyber-magenta/30 text-sm">No detections found</p>
            <p className="text-cyber-magenta/20 text-xs mt-1">Run detection to find speed signs</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mb-3 p-2 bg-cyber-dark/50 rounded border border-cyber-magenta/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyber-magenta/50 uppercase tracking-wider">TOTAL FOUND</span>
                <span className="text-lg font-mono text-cyber-magenta font-bold">{detections.length}</span>
              </div>
            </div>
            
            {/* Class Filter */}
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedClass(null)}
                  className={`
                    px-2 py-1 text-[10px] rounded font-mono uppercase transition-all
                    ${!selectedClass 
                      ? 'bg-cyber-magenta/20 text-cyber-magenta border border-cyber-magenta/50' 
                      : 'bg-cyber-dark/50 text-cyber-magenta/50 border border-cyber-magenta/20 hover:border-cyber-magenta/40'
                    }
                  `}
                >
                  ALL ({detections.length})
                </button>
                {Object.entries(byClass).map(([cls, dets]) => (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    className={`
                      px-2 py-1 text-[10px] rounded font-mono uppercase transition-all
                      ${selectedClass === cls 
                        ? `bg-${getClassColor(cls)}/20 text-${getClassColor(cls)} border border-${getClassColor(cls)}/50` 
                        : 'bg-cyber-dark/50 text-cyber-cyan/50 border border-cyber-cyan/20 hover:border-cyber-cyan/40'
                      }
                    `}
                  >
                    {getClassLabel(cls)} ({dets.length})
                  </button>
                ))}
              </div>
            </div>
            
            {/* Detection Gallery */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-cyber">
              <div className="grid grid-cols-2 gap-2 pb-4">
                {filteredDetections.map((detection) => (
                  <button
                    key={detection.id}
                    onClick={() => goToDetection(detection)}
                    className={`
                      relative aspect-video rounded overflow-hidden border transition-all group
                      ${selectedDetection?.id === detection.id
                        ? 'border-cyber-magenta shadow-cyber-magenta'
                        : 'border-cyber-cyan/20 hover:border-cyber-cyan/50'
                      }
                    `}
                  >
                    {/* Thumbnail */}
                    <img
                      src={getImageUrl({ file_path: detection.file_path })}
                      alt={`Detection ${detection.id}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Corner-style Bounding Box Overlay */}
                    <CornerBoundingBox
                      x1={detection.bbox_x1}
                      y1={detection.bbox_y1}
                      x2={detection.bbox_x2}
                      y2={detection.bbox_y2}
                      imgWidth={IMG_WIDTH}
                      imgHeight={IMG_HEIGHT}
                      className={detection.class_name}
                    />
                    
                    {/* Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <div className="flex items-center justify-between">
                        <span 
                          className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase text-white"
                          style={{ 
                            backgroundColor: detection.class_name === 'white-speed-numeric' 
                              ? 'rgba(34, 197, 94, 0.8)' 
                              : 'rgba(239, 68, 68, 0.8)' 
                          }}
                        >
                          {getClassLabel(detection.class_name)}
                        </span>
                        <span className="text-[10px] text-white font-mono">
                          {(detection.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-cyber-cyan/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </DataPanel>
      
      {/* Selected Detection Detail Modal */}
      {selectedDetection && selectedDevice && selectedTrip && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedDetection(null)}
        >
          <div 
            className="glass-panel border border-cyber-magenta/50 rounded-lg max-w-3xl w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-cyber-magenta/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIndicator status="active" size="sm" pulse />
                <span className="data-label text-cyber-magenta">DETECTION DETAIL</span>
              </div>
              <button 
                onClick={() => setSelectedDetection(null)}
                className="text-cyber-magenta/50 hover:text-cyber-magenta transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Image with corner-style bounding box */}
            <div className="relative">
              <img
                src={getImageUrl({ file_path: selectedDetection.file_path })}
                alt={`Detection ${selectedDetection.id}`}
                className="w-full"
              />
              {/* Corner-style Bounding Box */}
              <CornerBoundingBox
                x1={selectedDetection.bbox_x1}
                y1={selectedDetection.bbox_y1}
                x2={selectedDetection.bbox_x2}
                y2={selectedDetection.bbox_y2}
                imgWidth={IMG_WIDTH}
                imgHeight={IMG_HEIGHT}
                className={selectedDetection.class_name}
                showLabel
                label={`${getClassLabel(selectedDetection.class_name)} ${(selectedDetection.confidence * 100).toFixed(1)}%`}
              />
            </div>
            
            {/* Info */}
            <div className="px-4 py-3 grid grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-cyber-magenta/50 block">CLASS</span>
                <span className="text-cyber-magenta">{getClassLabel(selectedDetection.class_name)}</span>
              </div>
              <div>
                <span className="text-cyber-magenta/50 block">CONFIDENCE</span>
                <span className="text-cyber-magenta">{(selectedDetection.confidence * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-cyber-magenta/50 block">LOCATION</span>
                <span className="text-cyber-cyan">{selectedDetection.latitude.toFixed(5)}, {selectedDetection.longitude.toFixed(5)}</span>
              </div>
              <div>
                <span className="text-cyber-magenta/50 block">LINK ID</span>
                <span className="text-cyber-cyan">{selectedDetection.link_id || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

