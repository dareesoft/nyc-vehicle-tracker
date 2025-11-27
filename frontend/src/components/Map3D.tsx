import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import { Map } from 'react-map-gl/maplibre'
import DeckGL from '@deck.gl/react'
import { PathLayer, ScatterplotLayer, TextLayer, ColumnLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { useTripStore } from '../stores/tripStore'
import { useTrip3D, useDetections } from '../hooks/useTrip'
import 'maplibre-gl/dist/maplibre-gl.css'

// Calculate bearing (compass heading) from point A to point B
// Returns 0-360 degrees: 0=North, 90=East, 180=South, 270=West
function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  
  const bearing = toDeg(Math.atan2(y, x))
  return (bearing + 360) % 360
}

// Smooth bearing interpolation (handles wraparound at 0/360)
function interpolateBearing(from: number, to: number, t: number): number {
  let diff = to - from
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return (from + diff * t + 360) % 360
}

// Position history for stable heading calculation
interface PositionRecord {
  lat: number
  lng: number
  index: number
}

// Dark map style for 3D view
const MAP_STYLE = {
  version: 8 as const,
  name: 'Cyberpunk Dark 3D',
  sources: {
    'osm-tiles': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster' as const,
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

interface PathData {
  path: [number, number, number][]
  link_id: number | null
  forward: boolean
  color: [number, number, number, number]
  width: number
  start_time: string
  end_time: string
}

function Map3DComponent() {
  const { 
    selectedDevice, 
    selectedTrip,
    mapCenter, 
    mapZoom,
    currentIndex,
    getFilteredData,
    setCurrentIndex,
    isPlaying,
    followVehicle,
    combinedRoutes,
    combinedDetections,
    showDetectionLayer,
    setShowDetectionLayer,
  } = useTripStore()
  
  // Fetch detections for current trip
  const { data: detectionsData } = useDetections(
    selectedDevice?.device_id || null,
    selectedTrip?.date || null
  )
  
  const [viewState, setViewState] = useState({
    longitude: mapCenter[0],
    latitude: mapCenter[1],
    zoom: mapZoom,
    pitch: 45,
    bearing: 0,
  })
  
  const [hoveredObject, setHoveredObject] = useState<PathData | null>(null)
  
  // Keep history of last 5 positions for stable heading calculation
  const positionHistoryRef = useRef<PositionRecord[]>([])
  const currentBearingRef = useRef<number>(0)
  const lastProcessedIndexRef = useRef<number>(-1)
  
  const { data: trip3D } = useTrip3D(
    selectedDevice?.device_id || null,
    selectedTrip?.date || null
  )
  
  const filteredData = getFilteredData()
  const currentPoint = filteredData[currentIndex]
  
  // Update view when current point changes (with heading-up during playback)
  useEffect(() => {
    if (currentPoint && followVehicle) {
      // Add current position to history (avoid duplicates)
      if (lastProcessedIndexRef.current !== currentIndex) {
        positionHistoryRef.current.push({
          lat: currentPoint.latitude,
          lng: currentPoint.longitude,
          index: currentIndex
        })
        // Keep only last 5 positions
        if (positionHistoryRef.current.length > 5) {
          positionHistoryRef.current.shift()
        }
        lastProcessedIndexRef.current = currentIndex
      }
      
      // Calculate heading using position history
      const history = positionHistoryRef.current
      let targetBearing = currentBearingRef.current
      
      if (history.length >= 3) {
        // Use the position from 2-3 frames ago for stability
        const lookbackIndex = Math.max(0, history.length - 3)
        const pastPosition = history[lookbackIndex]
        const currentPosition = history[history.length - 1]
        
        const dx = currentPosition.lng - pastPosition.lng
        const dy = currentPosition.lat - pastPosition.lat
        const distance = Math.sqrt(dx * dx + dy * dy) * 111000
        
        if (distance > 2) {
          targetBearing = calculateBearing(
            { lat: pastPosition.lat, lng: pastPosition.lng },
            { lat: currentPosition.lat, lng: currentPosition.lng }
          )
        }
      }
      
      if (isPlaying) {
        // Smooth bearing transition for heading-up mode
        const smoothBearing = interpolateBearing(currentBearingRef.current, targetBearing, 0.3)
        currentBearingRef.current = smoothBearing
        
        // HEADING-UP MODE: map bearing = travel bearing
        // So travel direction points UP on screen
        setViewState(prev => ({
          ...prev,
          longitude: currentPoint.longitude,
          latitude: currentPoint.latitude,
          bearing: smoothBearing, // Travel direction points up
        }))
      } else {
        // Not playing - center on point, reset bearing
        currentBearingRef.current = 0
        positionHistoryRef.current = []
        setViewState(prev => ({
          ...prev,
          longitude: currentPoint.longitude,
          latitude: currentPoint.latitude,
          bearing: 0,
        }))
      }
    }
  }, [currentPoint, isPlaying, followVehicle, currentIndex])
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onViewStateChange = useCallback((params: any) => {
    if (params.viewState) {
      setViewState(params.viewState)
      // Update bearing ref when user manually rotates
      currentBearingRef.current = params.viewState.bearing
    }
  }, [])
  
  const onHover = useCallback((info: PickingInfo) => {
    setHoveredObject(info.object as PathData || null)
  }, [])
  
  // Path layer for 3D route segments
  const pathLayer = useMemo(() => {
    if (!trip3D?.paths) return null
    
    return new PathLayer<PathData>({
      id: 'path-layer',
      data: trip3D.paths,
      getPath: (d: PathData) => d.path,
      getColor: (d: PathData) => d.color,
      getWidth: (d: PathData) => d.width,
      widthMinPixels: 2,
      widthMaxPixels: 10,
      jointRounded: true,
      capRounded: true,
      pickable: true,
      onHover,
    })
  }, [trip3D, onHover])
  
  // Glow path layer (wider, transparent for glow effect)
  const glowPathLayer = useMemo(() => {
    if (!trip3D?.paths) return null
    
    return new PathLayer<PathData>({
      id: 'glow-path-layer',
      data: trip3D.paths,
      getPath: (d: PathData) => d.path,
      getColor: (d: PathData) => [...d.color.slice(0, 3), 80] as [number, number, number, number],
      getWidth: (d: PathData) => d.width * 3,
      widthMinPixels: 6,
      widthMaxPixels: 30,
      jointRounded: true,
      capRounded: true,
    })
  }, [trip3D])
  
  // Scatter plot layer for points
  const pointsLayer = useMemo(() => {
    if (!filteredData.length) return null
    
    return new ScatterplotLayer({
      id: 'points-layer',
      data: filteredData,
      getPosition: (d) => [d.longitude, d.latitude, 10],
      getRadius: (_d, { index }) => index === currentIndex ? 15 : 5,
      getFillColor: (d, { index }) => {
        if (index === currentIndex) return [0, 255, 247, 255]
        return d.camera_type === '101' ? [0, 255, 247, 150] : [255, 0, 255, 150]
      },
      pickable: true,
      onClick: (info) => {
        if (info.index !== undefined) {
          setCurrentIndex(info.index)
        }
      },
    })
  }, [filteredData, currentIndex, setCurrentIndex])
  
  // Current position highlight
  const currentPositionLayer = useMemo(() => {
    if (!currentPoint) return null
    
    return new ScatterplotLayer({
      id: 'current-position',
      data: [currentPoint],
      getPosition: (d) => [d.longitude, d.latitude, 20],
      getRadius: 25,
      getFillColor: [0, 255, 247, 100],
      stroked: true,
      getLineColor: [0, 255, 247, 255],
      lineWidthMinPixels: 2,
    })
  }, [currentPoint])
  
  // Link ID labels
  const labelsLayer = useMemo(() => {
    if (!trip3D?.paths) return null
    
    const labelData = trip3D.paths
      .filter((p: PathData) => p.link_id && p.path.length > 0)
      .map((p: PathData) => ({
        position: p.path[Math.floor(p.path.length / 2)],
        text: `${p.link_id}`,
        link_id: p.link_id,
      }))
    
    return new TextLayer({
      id: 'labels-layer',
      data: labelData,
      getPosition: (d) => d.position,
      getText: (d) => d.text,
      getSize: 12,
      getColor: [255, 255, 255, 200],
      getAngle: 0,
      billboard: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 'bold',
    })
  }, [trip3D])
  
  // Combined routes layer (multi-trip overlay)
  const combinedRoutesLayer = useMemo(() => {
    if (!combinedRoutes?.features?.length) return null
    
    // Extract route features and convert to path data
    const routeFeatures = combinedRoutes.features.filter(
      (f: any) => f.properties?.type === 'route'
    )
    
    if (routeFeatures.length === 0) return null
    
    const pathData = routeFeatures.map((f: any, i: number) => ({
      path: f.geometry.coordinates,
      color: f.properties?.trip_color || '#00fff7',
      tripIndex: f.properties?.trip_index || i,
    }))
    
    return new PathLayer({
      id: 'combined-routes-layer',
      data: pathData,
      getPath: (d) => d.path,
      getColor: (d) => {
        // Parse hex color to RGB
        const hex = d.color.replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        return [r, g, b, 200]
      },
      getWidth: 5,
      widthMinPixels: 3,
      capRounded: true,
      jointRounded: true,
    })
  }, [combinedRoutes])
  
  // Detection pins layer - 3D vertical columns for speed sign detections
  const detectionPinsLayer = useMemo(() => {
    if (!showDetectionLayer) return null
    
    const PIN_HEIGHT = 20  // 30m height
    
    // Process data for ColumnLayer
    let processedData: Array<{id: number, coordinates: [number, number], color: [number, number, number]}> = []
    
    if (combinedDetections?.features && combinedDetections.features.length > 0) {
      // Multi-trip overlay
      processedData = combinedDetections.features.map((f: any) => {
        const hex = (f.properties?.trip_color || '#ff00ff').replace('#', '')
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        return {
          id: f.properties?.id,
          coordinates: f.geometry.coordinates as [number, number],
          color: [r, g, b] as [number, number, number],
        }
      })
    } else if (detectionsData?.detections && detectionsData.detections.length > 0) {
      // Single trip
      processedData = detectionsData.detections.map(d => ({
        id: d.id,
        coordinates: [d.longitude, d.latitude] as [number, number],
        color: [255, 0, 255] as [number, number, number],  // Magenta
      }))
    }
    
    if (processedData.length === 0) return null
    
    console.log('Detection pins:', processedData.length, 'items')
    
    // Use ColumnLayer for visible 3D vertical pins
    return new ColumnLayer({
      id: 'detection-pins-layer',
      data: processedData,
      diskResolution: 5,
      radius: 1,  // 5m radius - more visible
      elevationScale: 1,
      extruded: true,
      getPosition: (d: any) => d.coordinates,
      getElevation: PIN_HEIGHT,
      getFillColor: [255, 255, 255, 255] as [number, number, number, number],  // White
      getLineColor: [200, 200, 200, 255] as [number, number, number, number],
      lineWidthMinPixels: 2,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 150],
    })
  }, [showDetectionLayer, combinedDetections, detectionsData])
  
  // Base layers - show combined routes or single trip
  const baseLayers = combinedRoutes 
    ? [combinedRoutesLayer]
    : [glowPathLayer, pathLayer, pointsLayer, currentPositionLayer, labelsLayer]
  
  // Add detection layer if enabled (pin only, no head)
  const layers = [...baseLayers, detectionPinsLayer].filter(Boolean)
  
  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        layers={layers}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
      
      {/* 3D Controls overlay */}
      <div className="absolute top-4 left-4 glass-panel p-4 rounded">
        <h3 className="data-label mb-3">3D CONTROLS</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs text-cyber-cyan/50 block mb-1">PITCH</label>
            <input
              type="range"
              min="0"
              max="85"
              value={viewState.pitch}
              onChange={(e) => setViewState(prev => ({ ...prev, pitch: Number(e.target.value) }))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-xs text-cyber-cyan/50 block mb-1">BEARING</label>
            <input
              type="range"
              min="0"
              max="360"
              value={(viewState.bearing + 360) % 360}
              onChange={(e) => setViewState(prev => ({ ...prev, bearing: Number(e.target.value) }))}
              className="w-full"
            />
          </div>
        </div>
        
        {/* Heading-up mode indicator */}
        {isPlaying && (
          <div className="mt-3 pt-3 border-t border-cyber-cyan/20">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
              <span className="text-cyber-cyan">HEADING-UP MODE</span>
            </div>
          </div>
        )}
        
        {/* Detection layer toggle */}
        <div className="mt-3 pt-3 border-t border-cyber-cyan/20">
          <button
            onClick={() => setShowDetectionLayer(!showDetectionLayer)}
            className={`
              w-full px-3 py-2 rounded-sm flex items-center gap-2 transition-all text-left
              ${showDetectionLayer 
                ? 'bg-cyber-magenta/20 border border-cyber-magenta/50' 
                : 'bg-cyber-dark/30 border border-cyber-cyan/20 hover:border-cyber-cyan/40'
              }
            `}
          >
            <div className={`
              w-3 h-3 rounded-sm border-2 flex items-center justify-center
              ${showDetectionLayer 
                ? 'border-cyber-magenta bg-cyber-magenta' 
                : 'border-cyber-cyan/50'
              }
            `}>
              {showDetectionLayer && (
                <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/>
                </svg>
              )}
            </div>
            <span className={`text-xs font-mono tracking-wider ${
              showDetectionLayer ? 'text-cyber-magenta' : 'text-cyber-cyan/50'
            }`}>
              DETECTION PINS
            </span>
            {(detectionsData?.detections?.length || combinedDetections?.total) && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ml-auto ${
                showDetectionLayer 
                  ? 'bg-cyber-magenta/30 text-cyber-magenta' 
                  : 'bg-cyber-cyan/20 text-cyber-cyan/50'
              }`}>
                {combinedDetections?.total || detectionsData?.detections?.length || 0}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Hover tooltip */}
      {hoveredObject && (
        <div className="absolute top-4 right-4 glass-panel-magenta p-4 rounded">
          <h3 className="data-label text-cyber-magenta mb-2">LINK SEGMENT</h3>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-cyber-magenta/50">LINK ID:</span>
              <span className="text-cyber-magenta ml-2 font-bold">
                {hoveredObject.link_id || 'Unknown'}
              </span>
            </div>
            <div>
              <span className="text-cyber-magenta/50">DIRECTION:</span>
              <span className="text-cyber-magenta ml-2">
                {hoveredObject.forward ? 'FORWARD' : 'BACKWARD'}
              </span>
            </div>
            <div>
              <span className="text-cyber-magenta/50">POINTS:</span>
              <span className="text-cyber-magenta ml-2">
                {hoveredObject.path.length}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* View info */}
      <div className="absolute bottom-4 left-4 glass-panel p-3 rounded text-xs font-mono">
        <div className="flex gap-4">
          <div>
            <span className="text-cyber-magenta/50">PITCH:</span>
            <span className="text-cyber-magenta ml-2">{viewState.pitch.toFixed(0)}°</span>
          </div>
          <div>
            <span className="text-cyber-magenta/50">BEARING:</span>
            <span className="text-cyber-magenta ml-2">{((viewState.bearing + 360) % 360).toFixed(0)}°</span>
          </div>
          <div>
            <span className="text-cyber-magenta/50">SEGMENTS:</span>
            <span className="text-cyber-magenta ml-2">{trip3D?.paths?.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(Map3DComponent)
