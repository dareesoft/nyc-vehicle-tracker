/**
 * Coverage Analysis Page
 * Compares NYC official speed sign database with our YOLO detections
 */
import { useEffect, useRef, useCallback, useState } from 'react'
// import { useQuery } from '@tanstack/react-query'  // Replaced with SSE
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCoverageStore, useFilteredGeoJSON, MatchingAlgorithm, ALGORITHM_INFO } from '../stores/coverageStore'
import { useTripStore } from '../stores/tripStore'
import { DataPanel, AnimatedNumber } from '../components/ui'

const API_BASE = '/api'

// Color constants
const COLORS = {
  matched: '#3b82f6',    // Blue
  undetected: '#ef4444', // Red
  newFinding: '#eab308'  // Yellow
}

// Selected marker info type
interface SelectedMarker {
  status: 'matched' | 'undetected' | 'new_finding'
  coordinates: [number, number]  // NYC DB coordinates (for matched/undetected)
  id?: string
  sign_type?: string
  description?: string
  class_name?: string
  confidence?: number
  match_distance?: number
  file_path?: string
  nearest_nyc_distance?: number
  // Detection coordinates (for matched - where our detection was)
  detection_lat?: number
  detection_lon?: number
  // Bounding box
  bbox_x1?: number
  bbox_y1?: number
  bbox_x2?: number
  bbox_y2?: number
}

// Full screen image modal with bounding box
function ImageModal({ 
  imagePath, 
  bbox, 
  className,
  onClose 
}: { 
  imagePath: string
  bbox?: { x1?: number, y1?: number, x2?: number, y2?: number }
  className?: string
  onClose: () => void 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      // Draw image
      ctx.drawImage(img, 0, 0)
      
      // Draw bounding box if available
      if (bbox && bbox.x1 != null && bbox.y1 != null && bbox.x2 != null && bbox.y2 != null) {
        ctx.strokeStyle = '#00ff00'
        ctx.lineWidth = 4
        ctx.strokeRect(bbox.x1, bbox.y1, bbox.x2 - bbox.x1, bbox.y2 - bbox.y1)
        
        // Draw label background
        if (className) {
          const label = className
          ctx.font = 'bold 24px monospace'
          const textWidth = ctx.measureText(label).width
          ctx.fillStyle = '#00ff00'
          ctx.fillRect(bbox.x1, bbox.y1 - 32, textWidth + 16, 32)
          
          // Draw label text
          ctx.fillStyle = '#000000'
          ctx.fillText(label, bbox.x1 + 8, bbox.y1 - 8)
        }
      }
      
      setImageLoaded(true)
    }
    img.onerror = () => setError(true)
    img.src = `${API_BASE}/image-by-path?path=${encodeURIComponent(imagePath)}`
  }, [imagePath, bbox, className])

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 
          text-white transition-all"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      <div className="relative max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
        {!imageLoaded && !error && (
          <div className="flex items-center justify-center w-96 h-64">
            <div className="cyber-spinner" />
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center w-96 h-64 text-red-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-mono">Image load failed</p>
            </div>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          className={`max-w-[95vw] max-h-[95vh] object-contain ${imageLoaded ? '' : 'hidden'}`}
        />
        
        {/* Image info overlay */}
        {imageLoaded && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="font-mono text-green-400 flex items-center gap-2">
                {className && (
                  <>
                    <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded">
                      {className}
                    </span>
                  </>
                )}
                {bbox && bbox.x1 != null && (
                  <span className="text-green-400/70">
                    Bounding Box: ({bbox.x1}, {bbox.y1}) → ({bbox.x2}, {bbox.y2})
                  </span>
                )}
              </div>
              <span className="text-white/50 text-xs truncate max-w-[300px]">
                {imagePath.split('/').pop()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Fetch coverage analysis from API
// Replaced with SSE streaming - see fetchAnalysisSSE in component
// async function fetchCoverageAnalysis(
//   matchRadius: number, 
//   clusterRadius: number,
//   algorithm: MatchingAlgorithm
// ): Promise<{
//   geojson: CoverageGeoJSON
//   stats: CoverageStats
// }> {
//   const res = await fetch(
//     `${API_BASE}/coverage/analysis?radius=${matchRadius}&cluster_radius=${clusterRadius}&algorithm=${algorithm}`
//   )
//   if (!res.ok) throw new Error('Failed to fetch coverage analysis')
//   return res.json()
// }

export default function CoverageAnalysis() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker | null>(null)
  const [imageError, setImageError] = useState(false)
  const [showFullScreenImage, setShowFullScreenImage] = useState(false)
  
  const {
    matchRadius,
    clusterRadius,
    algorithm,
    filters,
    stats,
    isLoading,
    error,
    progressState,
    setAnalysisData,
    setMatchRadius,
    setAlgorithm,
    toggleFilter,
    setLoading,
    setProgress,
    setError
  } = useCoverageStore()
  
  const filteredGeoJSON = useFilteredGeoJSON()
  const { setViewMode } = useTripStore()
  const eventSourceRef = useRef<EventSource | null>(null)
  
  // Function to fetch analysis via SSE
  const fetchAnalysisSSE = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    
    setLoading(true)
    setProgress({ step: 'connecting', progress: 0, message: 'Connecting to server...' })
    
    const url = `${API_BASE}/coverage/analysis-stream?radius=${matchRadius}&cluster_radius=${clusterRadius}&algorithm=${algorithm}`
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.error) {
          setError(data.error)
          eventSource.close()
          return
        }
        
        if (data.step === 'complete' && data.result) {
          setAnalysisData(data.result.geojson, data.result.stats)
          setLoading(false)
          setProgress(null)
          eventSource.close()
        } else {
          setProgress({
            step: data.step,
            progress: data.progress,
            message: data.message
          })
        }
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }
    
    eventSource.onerror = () => {
      setError('Connection error. Please try again.')
      setLoading(false)
      setProgress(null)
      eventSource.close()
    }
  }, [matchRadius, clusterRadius, algorithm, setLoading, setProgress, setAnalysisData, setError])
  
  // Fetch on mount and when parameters change
  useEffect(() => {
    fetchAnalysisSSE()
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, []) // Only on mount
  
  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    fetchAnalysisSSE()
  }, [fetchAnalysisSSE])
  
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
          }
        },
        layers: [{
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 19
        }]
      },
      center: [-73.95, 40.70],
      zoom: 11
    })
    
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    
    // Force resize after map is created
    setTimeout(() => {
      if (map.current) {
        map.current.resize()
      }
    }, 100)
    
    // Add sources and layers once map loads
    map.current.on('load', () => {
      if (!map.current) return
      
      // Add empty source for coverage points
      map.current.addSource('coverage-points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
      
      // Add source for match arrows
      map.current.addSource('match-arrow', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
      
      // Match arrow line layer
      map.current.addLayer({
        id: 'match-arrow-line',
        type: 'line',
        source: 'match-arrow',
        paint: {
          'line-color': COLORS.matched,
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [2, 1]
        }
      })
      
      // Arrow head (detection point)
      map.current.addLayer({
        id: 'match-arrow-detection',
        type: 'circle',
        source: 'match-arrow',
        filter: ['==', ['get', 'point_type'], 'detection'],
        paint: {
          'circle-radius': 8,
          'circle-color': '#ff6b6b',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      })
      
      // Undetected layer (red circles)
      map.current.addLayer({
        id: 'coverage-undetected',
        type: 'circle',
        source: 'coverage-points',
        filter: ['==', ['get', 'status'], 'undetected'],
        paint: {
          'circle-radius': 6,
          'circle-color': COLORS.undetected,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8
        }
      })
      
      // Matched layer (blue circles)
      map.current.addLayer({
        id: 'coverage-matched',
        type: 'circle',
        source: 'coverage-points',
        filter: ['==', ['get', 'status'], 'matched'],
        paint: {
          'circle-radius': 6,
          'circle-color': COLORS.matched,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8
        }
      })
      
      // New findings layer (yellow circles)
      map.current.addLayer({
        id: 'coverage-new-findings',
        type: 'circle',
        source: 'coverage-points',
        filter: ['==', ['get', 'status'], 'new_finding'],
        paint: {
          'circle-radius': 7,
          'circle-color': COLORS.newFinding,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      })
      
      // Handle marker clicks - show in side panel instead of popup
      const layers = ['coverage-undetected', 'coverage-matched', 'coverage-new-findings']
      
      layers.forEach(layerId => {
        map.current!.on('click', layerId, (e) => {
          if (!e.features || e.features.length === 0) return
          
          const feature = e.features[0]
          const props = feature.properties || {}
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
          
          setImageError(false)
          setSelectedMarker({
            status: props.status as 'matched' | 'undetected' | 'new_finding',
            coordinates: coords,
            id: props.id,
            sign_type: props.sign_type,
            description: props.description,
            class_name: props.class_name,
            confidence: props.confidence,
            match_distance: props.match_distance,
            file_path: props.file_path,
            nearest_nyc_distance: props.nearest_nyc_distance,
            detection_lat: props.detection_lat,
            detection_lon: props.detection_lon,
            bbox_x1: props.bbox_x1,
            bbox_y1: props.bbox_y1,
            bbox_x2: props.bbox_x2,
            bbox_y2: props.bbox_y2
          })
          setShowFullScreenImage(false)
        })
        
        map.current!.on('mouseenter', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer'
        })
        
        map.current!.on('mouseleave', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = ''
        })
      })
      
      // Mark map as loaded
      setMapLoaded(true)
    })
    
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])
  
  // Update map data when filtered GeoJSON changes (only after map is loaded)
  useEffect(() => {
    if (!map.current || !mapLoaded || !filteredGeoJSON) return
    
    const source = map.current.getSource('coverage-points') as maplibregl.GeoJSONSource
    if (source) {
      source.setData(filteredGeoJSON as GeoJSON.FeatureCollection)
    }
  }, [filteredGeoJSON, mapLoaded])
  
  // Update match arrow when selected marker changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    
    const arrowSource = map.current.getSource('match-arrow') as maplibregl.GeoJSONSource
    if (!arrowSource) return
    
    if (selectedMarker?.status === 'matched' && 
        selectedMarker.detection_lat != null && 
        selectedMarker.detection_lon != null) {
      // Create arrow from detection point to NYC sign
      const detectionCoords: [number, number] = [selectedMarker.detection_lon, selectedMarker.detection_lat]
      const nycCoords = selectedMarker.coordinates
      
      arrowSource.setData({
        type: 'FeatureCollection',
        features: [
          // Line from detection to NYC sign
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [detectionCoords, nycCoords]
            },
            properties: {}
          },
          // Detection point marker
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: detectionCoords
            },
            properties: {
              point_type: 'detection'
            }
          }
        ]
      })
    } else {
      // Clear arrow
      arrowSource.setData({
        type: 'FeatureCollection',
        features: []
      })
    }
  }, [selectedMarker, mapLoaded])
  
  // Handle radius change
  const handleRadiusChange = useCallback((value: number) => {
    setMatchRadius(value)
  }, [setMatchRadius])

  // Get status color and label
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'matched':
        return { color: COLORS.matched, label: '✓ MATCHED', bgClass: 'bg-blue-500/20 border-blue-500' }
      case 'undetected':
        return { color: COLORS.undetected, label: '✗ UNDETECTED', bgClass: 'bg-red-500/20 border-red-500' }
      case 'new_finding':
        return { color: COLORS.newFinding, label: '★ NEW FINDING', bgClass: 'bg-yellow-500/20 border-yellow-500' }
      default:
        return { color: '#888', label: 'UNKNOWN', bgClass: 'bg-gray-500/20 border-gray-500' }
    }
  }

  // Get image URL
  const getImageUrl = (filePath: string) => {
    return `${API_BASE}/image-by-path?path=${encodeURIComponent(filePath)}`
  }
  
  return (
    <div className="h-screen flex bg-cyber-black overflow-hidden">
      {/* Left Sidebar - Stats & Filters */}
      <div className="w-72 flex-shrink-0 border-r border-cyber-cyan/30 flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <div className="p-3 border-b border-cyber-cyan/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyber-yellow rounded-full animate-pulse" />
              <h1 className="text-cyber-yellow font-mono text-sm tracking-wider">COVERAGE ANALYSIS</h1>
            </div>
            <button
              onClick={() => setViewMode('2d')}
              className="p-1.5 rounded border border-cyber-cyan/30 text-cyber-cyan/70 
                hover:border-cyber-cyan hover:text-cyber-cyan hover:bg-cyber-cyan/10
                transition-all duration-200"
              title="Back to Map"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-cyber-cyan/50 text-[10px]">NYC DB vs Our Detections</p>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Stats Panel */}
          <div className="p-3 border-b border-cyber-cyan/30">
            <DataPanel title="STATISTICS" variant="cyan">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="cyber-spinner" />
                </div>
              ) : stats ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-cyber-dark/50 p-2 rounded border border-cyber-cyan/20">
                      <div className="text-[9px] text-cyber-cyan/50 uppercase">NYC DB</div>
                      <div className="text-base font-mono text-cyber-cyan">
                        <AnimatedNumber value={stats.total_nyc_signs} />
                      </div>
                    </div>
                    <div className="bg-cyber-dark/50 p-2 rounded border border-cyber-cyan/20">
                      <div className="text-[9px] text-cyber-cyan/50 uppercase">Our Detections</div>
                      <div className="text-base font-mono text-cyber-cyan">
                        <AnimatedNumber value={stats.total_our_detections} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-[11px] text-white">Matched</span>
                      </div>
                      <span className="font-mono text-blue-500 text-sm">{stats.matched}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="text-[11px] text-white">Undetected</span>
                      </div>
                      <span className="font-mono text-red-500 text-sm">{stats.undetected}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                        <span className="text-[11px] text-white">New Findings</span>
                      </div>
                      <span className="font-mono text-yellow-500 text-sm">{stats.new_findings}</span>
                    </div>
                  </div>
                  
                  <div className="mt-2 p-2 bg-cyber-cyan/10 rounded border border-cyber-cyan/30">
                    <div className="text-[9px] text-cyber-cyan/70 uppercase mb-1">Coverage Rate</div>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-mono text-cyber-cyan font-bold">
                        {stats.coverage_percent.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-cyber-cyan/50 mb-0.5">
                        ({stats.matched}/{stats.total_nyc_signs})
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-cyber-dark rounded overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta transition-all duration-500"
                        style={{ width: `${Math.min(stats.coverage_percent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-cyber-cyan/30 text-xs">
                  No data available
                </div>
              )}
            </DataPanel>
          </div>
          
          {/* Filters */}
          <div className="p-3 border-b border-cyber-cyan/30">
            <DataPanel title="FILTERS" variant="magenta">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.showMatched}
                    onChange={() => toggleFilter('showMatched')}
                    className="sr-only"
                  />
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all
                    ${filters.showMatched 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'border-blue-500/50 group-hover:border-blue-500'
                    }`}>
                    {filters.showMatched && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-white">Matched (NYC + Ours)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.showUndetected}
                    onChange={() => toggleFilter('showUndetected')}
                    className="sr-only"
                  />
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all
                    ${filters.showUndetected 
                      ? 'bg-red-500 border-red-500' 
                      : 'border-red-500/50 group-hover:border-red-500'
                    }`}>
                    {filters.showUndetected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-white">Undetected (NYC only)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.showNewFindings}
                    onChange={() => toggleFilter('showNewFindings')}
                    className="sr-only"
                  />
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all
                    ${filters.showNewFindings 
                      ? 'bg-yellow-500 border-yellow-500' 
                      : 'border-yellow-500/50 group-hover:border-yellow-500'
                    }`}>
                    {filters.showNewFindings && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-white">New Findings (Ours only)</span>
                </label>
              </div>
            </DataPanel>
          </div>
          
          {/* Parameters */}
          <div className="p-3">
            <DataPanel title="PARAMETERS" variant="cyan">
              <div className="space-y-3">
                {/* Algorithm Selection */}
                <div>
                  <label className="text-[10px] text-cyber-cyan/70 block mb-1.5">Matching Algorithm</label>
                  <select
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value as MatchingAlgorithm)}
                    className="w-full px-2 py-1.5 bg-cyber-dark border border-cyber-cyan/30 rounded 
                      text-cyber-cyan text-xs font-mono cursor-pointer
                      focus:border-cyber-cyan focus:outline-none
                      [&>option]:bg-cyber-dark [&>option]:text-cyber-cyan"
                  >
                    {(Object.keys(ALGORITHM_INFO) as MatchingAlgorithm[]).map((algo) => (
                      <option key={algo} value={algo}>
                        {ALGORITHM_INFO[algo].name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[9px] text-cyber-cyan/50">
                    {ALGORITHM_INFO[algorithm].description}
                  </div>
                </div>
                
                {/* Match Radius */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-cyber-cyan/70">Match Radius</label>
                    <span className="text-[10px] font-mono text-cyber-cyan">{matchRadius}m</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={matchRadius}
                    onChange={(e) => handleRadiusChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-cyber-dark rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:bg-cyber-cyan [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,255,247,0.5)]"
                  />
                  <div className="flex justify-between text-[9px] text-cyber-cyan/30 mt-0.5">
                    <span>10m</span>
                    <span>100m</span>
                  </div>
                </div>
                
                <button
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="w-full py-1.5 px-3 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 
                    border border-cyber-cyan/50 rounded text-cyber-cyan text-xs font-mono
                    transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'ANALYZING...' : 'REFRESH ANALYSIS'}
                </button>
              </div>
            </DataPanel>
          </div>
        </div>
        
        {/* Legend - Fixed at bottom */}
        <div className="p-3 border-t border-cyber-cyan/30 flex-shrink-0">
          <div className="text-[9px] text-cyber-cyan/50 uppercase mb-1.5">Legend</div>
          <div className="grid grid-cols-3 gap-1.5 text-[9px]">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-white">Matched</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-white">Undetected</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-white">New</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Map Container */}
      <div className="flex-1 relative h-full">
        <div 
          ref={mapContainer} 
          className="absolute inset-0" 
          style={{ width: '100%', height: '100%' }}
        />
        
        {/* Loading Overlay with Real Progress */}
        {isLoading && (
          <div className="absolute inset-0 bg-cyber-black/70 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center w-80">
              {/* Spinner */}
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-cyber-cyan/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-cyber-cyan rounded-full animate-spin" />
                <div className="absolute inset-2 border-4 border-transparent border-t-cyber-magenta rounded-full animate-spin" 
                  style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              </div>
              
              <div className="text-cyber-cyan font-mono text-sm mb-3">
                ANALYZING COVERAGE...
              </div>
              
              {/* Real Progress Bar */}
              <div className="relative h-3 bg-cyber-dark/80 rounded-full overflow-hidden border border-cyber-cyan/30 mb-2">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyber-cyan/80 to-cyber-magenta/80 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressState?.progress || 0}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
              
              {/* Progress Percentage */}
              <div className="text-cyber-cyan font-mono text-lg font-bold mb-2">
                {progressState?.progress || 0}%
              </div>
              
              {/* Current Step Message */}
              <div className="mt-2 text-cyber-cyan/70 font-mono text-xs h-5">
                {progressState?.message || 'Initializing...'}
              </div>
              
              {/* Step Indicator */}
              <div className="mt-3 flex justify-center gap-1">
                {['loading_nyc', 'loading_detections', 'clustering', 'kdtree', 'matching', 'geojson', 'complete'].map((step, idx) => (
                  <div 
                    key={step}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      progressState?.step === step 
                        ? 'bg-cyber-cyan shadow-[0_0_8px_rgba(0,255,247,0.8)]' 
                        : progressState?.progress && progressState.progress > (idx * 15) 
                          ? 'bg-cyber-cyan/50' 
                          : 'bg-cyber-dark border border-cyber-cyan/30'
                    }`}
                  />
                ))}
              </div>
              
              <div className="mt-3 text-[9px] text-cyber-cyan/30 font-mono">
                {algorithm === 'hungarian' ? 'Hungarian Optimal Matching' : 
                 algorithm === 'mutual_nearest' ? 'Mutual Nearest Neighbor' : 
                 'KD-Tree + Greedy Nearest'}
              </div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20
            bg-red-500/20 border border-red-500 rounded px-4 py-2 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}
        
        {/* Quick Stats Overlay */}
        {stats && !isLoading && (
          <div className="absolute bottom-4 right-4 z-10 glass-panel border border-cyber-cyan/30 rounded p-2.5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-base font-mono text-blue-500 font-bold">{stats.matched}</div>
                <div className="text-[9px] text-blue-500/70">MATCHED</div>
              </div>
              <div>
                <div className="text-base font-mono text-red-500 font-bold">{stats.undetected}</div>
                <div className="text-[9px] text-red-500/70">MISSED</div>
              </div>
              <div>
                <div className="text-base font-mono text-yellow-500 font-bold">{stats.new_findings}</div>
                <div className="text-[9px] text-yellow-500/70">NEW</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Arrow Legend (when matched is selected) */}
        {selectedMarker?.status === 'matched' && selectedMarker.detection_lat && (
          <div className="absolute top-4 left-4 z-10 glass-panel border border-blue-500/30 rounded p-2">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#ff6b6b] border-2 border-white" />
                <span className="text-white">Detection</span>
              </div>
              <span className="text-blue-400">→</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                <span className="text-white">NYC DB</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Right Sidebar - Selected Marker Details */}
      {selectedMarker && (
        <div className="w-80 flex-shrink-0 border-l border-cyber-cyan/30 flex flex-col overflow-hidden bg-cyber-black/95">
          {/* Header */}
          <div className={`p-3 border-b ${getStatusInfo(selectedMarker.status).bgClass} flex-shrink-0`}>
            <div className="flex items-center justify-between">
              <span 
                className="font-mono text-sm font-bold"
                style={{ color: getStatusInfo(selectedMarker.status).color }}
              >
                {getStatusInfo(selectedMarker.status).label}
              </span>
              <button
                onClick={() => setSelectedMarker(null)}
                className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {/* Coordinates */}
            <div className="bg-cyber-dark/50 p-2 rounded border border-cyber-cyan/20">
              <div className="text-[9px] text-cyber-cyan/50 uppercase mb-1">
                {selectedMarker.status === 'new_finding' ? 'Detection Coordinates' : 'NYC DB Coordinates'}
              </div>
              <div className="font-mono text-xs text-cyber-cyan">
                {selectedMarker.coordinates[1].toFixed(6)}, {selectedMarker.coordinates[0].toFixed(6)}
              </div>
            </div>
            
            {/* Detection Coordinates (for matched) */}
            {selectedMarker.status === 'matched' && 
             selectedMarker.detection_lat != null && 
             selectedMarker.detection_lon != null && (
              <div className="bg-cyber-dark/50 p-2 rounded border border-[#ff6b6b]/30">
                <div className="text-[9px] text-[#ff6b6b]/70 uppercase mb-1">Detection Coordinates</div>
                <div className="font-mono text-xs text-[#ff6b6b]">
                  {selectedMarker.detection_lat.toFixed(6)}, {selectedMarker.detection_lon.toFixed(6)}
                </div>
              </div>
            )}
            
            {/* NYC Sign Info (for matched/undetected) */}
            {(selectedMarker.status === 'matched' || selectedMarker.status === 'undetected') && (
              <DataPanel title="NYC SIGN INFO" variant="cyan">
                <div className="space-y-2 text-xs">
                  {selectedMarker.id && (
                    <div className="flex justify-between">
                      <span className="text-cyber-cyan/50">Sign ID</span>
                      <span className="font-mono text-white">{selectedMarker.id}</span>
                    </div>
                  )}
                  {selectedMarker.sign_type && (
                    <div className="flex justify-between">
                      <span className="text-cyber-cyan/50">Type</span>
                      <span className="font-mono text-white">{selectedMarker.sign_type}</span>
                    </div>
                  )}
                  {selectedMarker.description && (
                    <div>
                      <div className="text-cyber-cyan/50 mb-1">Description</div>
                      <div className="font-mono text-[10px] text-white/80 bg-cyber-dark/50 p-2 rounded max-h-20 overflow-y-auto custom-scrollbar">
                        {selectedMarker.description}
                      </div>
                    </div>
                  )}
                </div>
              </DataPanel>
            )}
            
            {/* Detection Info (for matched/new_finding) */}
            {(selectedMarker.status === 'matched' || selectedMarker.status === 'new_finding') && (
              <DataPanel title="DETECTION INFO" variant="magenta">
                <div className="space-y-2 text-xs">
                  {selectedMarker.class_name && (
                    <div className="flex justify-between">
                      <span className="text-cyber-magenta/50">Class</span>
                      <span className="font-mono text-white">{selectedMarker.class_name}</span>
                    </div>
                  )}
                  {selectedMarker.confidence != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-cyber-magenta/50">Confidence</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-cyber-dark rounded overflow-hidden">
                          <div 
                            className="h-full bg-cyber-magenta"
                            style={{ width: `${selectedMarker.confidence * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-white">
                          {(selectedMarker.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedMarker.match_distance != null && selectedMarker.status === 'matched' && (
                    <div className="flex justify-between">
                      <span className="text-cyber-magenta/50">Match Distance</span>
                      <span className="font-mono text-white">
                        {selectedMarker.match_distance.toFixed(1)}m
                      </span>
                    </div>
                  )}
                  {selectedMarker.nearest_nyc_distance != null && selectedMarker.status === 'new_finding' && (
                    <div className="flex justify-between">
                      <span className="text-cyber-magenta/50">Nearest NYC Sign</span>
                      <span className="font-mono text-white">
                        {selectedMarker.nearest_nyc_distance.toFixed(0)}m away
                      </span>
                    </div>
                  )}
                </div>
              </DataPanel>
            )}
            
            {/* Detection Image (for matched/new_finding) */}
            {(selectedMarker.status === 'matched' || selectedMarker.status === 'new_finding') && 
             selectedMarker.file_path && (
              <DataPanel title="DETECTION IMAGE" variant="magenta">
                <div className="space-y-2">
                  <div 
                    className="relative aspect-video bg-cyber-dark rounded overflow-hidden border border-cyber-magenta/30 
                      cursor-pointer group"
                    onClick={() => setShowFullScreenImage(true)}
                  >
                    {!imageError ? (
                      <>
                        <img
                          src={getImageUrl(selectedMarker.file_path)}
                          alt="Detection"
                          className="w-full h-full object-contain"
                          onError={() => setImageError(true)}
                        />
                        {/* Expand overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 
                          flex items-center justify-center transition-opacity">
                          <div className="text-white flex flex-col items-center gap-1">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                            <span className="text-xs font-mono">VIEW FULL SCREEN</span>
                          </div>
                        </div>
                        {/* Bbox indicator */}
                        {selectedMarker.bbox_x1 != null && (
                          <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-green-500/80 rounded text-[9px] text-white font-mono">
                            BBOX
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-cyber-magenta/50 text-xs">
                        <div className="text-center">
                          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Image not available
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] text-cyber-magenta/50 font-mono truncate flex-1">
                      {selectedMarker.file_path.split('/').pop()}
                    </div>
                    <button
                      onClick={() => setShowFullScreenImage(true)}
                      className="ml-2 px-2 py-0.5 text-[9px] bg-cyber-magenta/20 hover:bg-cyber-magenta/30 
                        border border-cyber-magenta/50 rounded text-cyber-magenta font-mono transition-all"
                    >
                      EXPAND
                    </button>
                  </div>
                </div>
              </DataPanel>
            )}
            
            {/* Fly to buttons */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (map.current) {
                    map.current.flyTo({
                      center: selectedMarker.coordinates,
                      zoom: 17,
                      duration: 1000
                    })
                  }
                }}
                className="w-full py-2 px-3 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 
                  border border-cyber-cyan/50 rounded text-cyber-cyan text-xs font-mono
                  transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {selectedMarker.status === 'new_finding' ? 'FLY TO DETECTION' : 'FLY TO NYC SIGN'}
              </button>
              
              {/* Show both points for matched */}
              {selectedMarker.status === 'matched' && 
               selectedMarker.detection_lat != null && 
               selectedMarker.detection_lon != null && (
                <button
                  onClick={() => {
                    if (map.current) {
                      // Fit bounds to show both points
                      const bounds = new maplibregl.LngLatBounds()
                      bounds.extend(selectedMarker.coordinates)
                      bounds.extend([selectedMarker.detection_lon!, selectedMarker.detection_lat!])
                      
                      map.current.fitBounds(bounds, {
                        padding: 100,
                        duration: 1000
                      })
                    }
                  }}
                  className="w-full py-2 px-3 bg-blue-500/20 hover:bg-blue-500/30 
                    border border-blue-500/50 rounded text-blue-400 text-xs font-mono
                    transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  VIEW BOTH POINTS
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Full Screen Image Modal */}
      {showFullScreenImage && selectedMarker?.file_path && (
        <ImageModal
          imagePath={selectedMarker.file_path}
          bbox={{
            x1: selectedMarker.bbox_x1,
            y1: selectedMarker.bbox_y1,
            x2: selectedMarker.bbox_x2,
            y2: selectedMarker.bbox_y2
          }}
          className={selectedMarker.class_name}
          onClose={() => setShowFullScreenImage(false)}
        />
      )}
    </div>
  )
}
