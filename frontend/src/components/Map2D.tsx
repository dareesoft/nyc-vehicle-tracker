import { useRef, useEffect, useCallback, useMemo, useState, memo } from 'react'
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/maplibre'
import type { MapRef, LayerProps, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import { useTripStore } from '../stores/tripStore'
import { useTripGeoJSON, useDetections, detectionToGeoJSON, Detection } from '../hooks/useTrip'
import { useIsMobile } from '../hooks/useMediaQuery'
import { StatusIndicator, HUDCorner } from './ui'
import 'maplibre-gl/dist/maplibre-gl.css'

// Cancel any ongoing flyTo animation
let flyToAbortController: { abort: boolean } | null = null

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
  return (bearing + 360) % 360 // Normalize to 0-360
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

// Dark cyberpunk map style
const MAP_STYLE = {
  version: 8 as const,
  name: 'Cyberpunk Dark',
  sources: {
    'osm-tiles': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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

function Map2DComponent() {
  const mapRef = useRef<MapRef>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const isMobile = useIsMobile()
  const { 
    selectedDevice, 
    selectedTrip,
    mapCenter, 
    mapZoom, 
    setMapCenter, 
    setMapZoom,
    currentIndex,
    setCurrentIndex,
    getFilteredData,
    followVehicle,
    isPlaying,
    combinedRoutes,
    combinedDetections,
    showDetectionLayer,
    setShowDetectionLayer,
  } = useTripStore()
  
  const { data: geojson } = useTripGeoJSON(
    selectedDevice?.device_id || null,
    selectedTrip?.date || null
  )
  
  const { data: detectionsData } = useDetections(
    selectedDevice?.device_id || null,
    selectedTrip?.date || null
  )
  
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null)
  
  const detectionsGeoJSON = useMemo(() => {
    if (!detectionsData?.detections?.length) return null
    return detectionToGeoJSON(detectionsData.detections)
  }, [detectionsData])
  
  const filteredData = getFilteredData()
  const currentPoint = filteredData[currentIndex]
  
  // Keep history of last 5 positions for stable heading calculation
  const positionHistoryRef = useRef<PositionRecord[]>([])
  const currentBearingRef = useRef<number>(0)
  const lastProcessedIndexRef = useRef<number>(-1)
  
  // Move to current point when following vehicle (with heading-up rotation during playback)
  useEffect(() => {
    if (followVehicle && currentPoint && mapRef.current) {
      const map = mapRef.current
      
      // Cancel any ongoing animation
      if (flyToAbortController) {
        flyToAbortController.abort = true
      }
      flyToAbortController = { abort: false }
      
      const targetCenter: [number, number] = [currentPoint.longitude, currentPoint.latitude]
      
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
      // Look at direction from 2-3 frames ago to current for stability
      const history = positionHistoryRef.current
      let targetBearing = currentBearingRef.current
      
      if (history.length >= 3) {
        // Use the position from 2-3 frames ago
        const lookbackIndex = Math.max(0, history.length - 3)
        const pastPosition = history[lookbackIndex]
        const currentPosition = history[history.length - 1]
        
        // Calculate distance to ensure there's meaningful movement
        const dx = currentPosition.lng - pastPosition.lng
        const dy = currentPosition.lat - pastPosition.lat
        const distance = Math.sqrt(dx * dx + dy * dy) * 111000 // rough meters
        
        if (distance > 2) { // Need at least 2m of movement
          // Calculate bearing FROM past TO current (direction we're moving)
          targetBearing = calculateBearing(
            { lat: pastPosition.lat, lng: pastPosition.lng },
            { lat: currentPosition.lat, lng: currentPosition.lng }
          )
        }
      }
      
      // If playing, use heading-up mode with bearing rotation
      if (isPlaying) {
        // Smooth bearing transition (30% toward target each frame)
        const smoothBearing = interpolateBearing(currentBearingRef.current, targetBearing, 0.3)
        currentBearingRef.current = smoothBearing
        
        // HEADING-UP MODE:
        // MapLibre bearing 0 = North at top
        // MapLibre bearing 90 = East at top (map rotated 90° CW)
        // 
        // If traveling East (compass heading 90°), we want East at top
        // So map bearing should EQUAL travel bearing
        map.easeTo({
          center: targetCenter,
          bearing: smoothBearing, // Travel direction points UP
          duration: 150,
          easing: (t) => t,
        })
      } else {
        // Manual navigation - reset bearing to north-up, smooth flyTo
        currentBearingRef.current = 0
        positionHistoryRef.current = [] // Clear history on pause
        map.flyTo({
          center: targetCenter,
          bearing: 0, // North up when not playing
          duration: 400,
        })
      }
    }
  }, [currentPoint, followVehicle, isPlaying, currentIndex])
  
  const onMove = useCallback((evt: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    setMapCenter([evt.viewState.longitude, evt.viewState.latitude])
    setMapZoom(evt.viewState.zoom)
  }, [setMapCenter, setMapZoom])
  
  // Handle click on points layer
  const onClick = useCallback((evt: MapLayerMouseEvent) => {
    const features = evt.features
    if (!features || features.length === 0) return
    
    const clickedFeature = features[0]
    const layerId = clickedFeature.layer?.id
    
    // Handle detection point click
    if (layerId === 'detection-points') {
      const detectionId = clickedFeature.properties?.id
      
      // Try single trip detections first
      if (detectionsData?.detections) {
        const detection = detectionsData.detections.find(d => d.id === detectionId)
        if (detection) {
          setSelectedDetection(detection)
          // Navigate to the corresponding frame
          const matchedIndex = filteredData.findIndex(p => p.file_path === detection.file_path)
          if (matchedIndex !== -1) {
            setCurrentIndex(matchedIndex)
          }
          return
        }
      }
      
      // Try combined detections (multi-trip overlay)
      if (combinedDetections?.features) {
        const feature = combinedDetections.features.find((f: any) => f.properties?.id === detectionId)
        if (feature) {
          // Create a detection object from the feature properties
          const detection: Detection = {
            id: feature.properties.id,
            image_id: 0,
            class_name: feature.properties.class_name,
            confidence: feature.properties.confidence,
            bbox_x1: 0, bbox_y1: 0, bbox_x2: 0, bbox_y2: 0,
            file_path: feature.properties.file_path,
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0],
            timestamp: feature.properties.timestamp,
            link_id: feature.properties.link_id,
          }
          setSelectedDetection(detection)
        }
      }
      return
    }
    
    // Handle image point click
    if (clickedFeature.properties?.type !== 'image_point') return
    
    // Find the matching point in filteredData by file_path (handles camera filter correctly)
    const clickedFilePath = clickedFeature.properties?.file_path
    if (clickedFilePath) {
      const matchedIndex = filteredData.findIndex(p => p.file_path === clickedFilePath)
      if (matchedIndex !== -1) {
        setCurrentIndex(matchedIndex)
        setSelectedDetection(null) // Clear detection selection
        
        // Fly to the clicked point
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [evt.lngLat.lng, evt.lngLat.lat],
            duration: 500,
          })
        }
      }
    }
  }, [setCurrentIndex, filteredData, detectionsData])
  
  // Handle cursor change on hover
  const onMouseEnter = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = 'pointer'
    }
  }, [])
  
  const onMouseLeave = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = ''
    }
  }, [])
  
  // Route line layer style
  const routeLayerStyle: LayerProps = useMemo(() => ({
    id: 'route',
    type: 'line',
    filter: ['==', ['get', 'type'], 'route'] as unknown as maplibregl.FilterSpecification,
    paint: {
      'line-color': '#00fff7',
      'line-width': 3,
      'line-opacity': 0.8,
      'line-blur': 1,
    },
  }), [])
  
  // Route glow layer (for cyberpunk effect)
  const routeGlowLayerStyle: LayerProps = useMemo(() => ({
    id: 'route-glow',
    type: 'line',
    filter: ['==', ['get', 'type'], 'route'] as unknown as maplibregl.FilterSpecification,
    paint: {
      'line-color': '#00fff7',
      'line-width': 8,
      'line-opacity': 0.3,
      'line-blur': 4,
    },
  }), [])
  
  // Points layer style
  const pointsLayerStyle: LayerProps = useMemo(() => ({
    id: 'points',
    type: 'circle',
    filter: ['==', ['get', 'type'], 'image_point'] as unknown as maplibregl.FilterSpecification,
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10, 2,
        15, 4,
        18, 6,
      ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>,
      'circle-color': [
        'case',
        ['==', ['get', 'camera_type'], '101'],
        '#00fff7',
        '#ff00ff',
      ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>,
      'circle-opacity': 0.6,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.3,
    },
  }), [])
  
  return (
    <div className="relative w-full h-full">
      {/* Map */}
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        longitude={mapCenter[0]}
        latitude={mapCenter[1]}
        zoom={mapZoom}
        onMove={onMove}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onLoad={() => setIsMapLoaded(true)}
        interactiveLayerIds={['points', 'detection-points']}
        style={{ width: '100%', height: '100%' }}
        attributionControl={true}
      >
        <NavigationControl position="bottom-right" />
        
        {/* Combined routes from multi-trip selection */}
        {combinedRoutes && combinedRoutes.features.length > 0 && (
          <Source id="combined-routes" type="geojson" data={combinedRoutes}>
            <Layer
              id="combined-routes-line"
              type="line"
              filter={['==', ['get', 'type'], 'route']}
              paint={{
                'line-color': ['get', 'trip_color'],
                'line-width': 4,
                'line-opacity': 0.8,
              }}
            />
            <Layer
              id="combined-routes-glow"
              type="line"
              filter={['==', ['get', 'type'], 'route']}
              paint={{
                'line-color': ['get', 'trip_color'],
                'line-width': 10,
                'line-opacity': 0.3,
                'line-blur': 4,
              }}
            />
          </Source>
        )}
        
        {/* Single trip route and points */}
        {geojson && !combinedRoutes && (
          <Source id="trip-data" type="geojson" data={geojson}>
            <Layer {...routeGlowLayerStyle} />
            <Layer {...routeLayerStyle} />
            <Layer {...pointsLayerStyle} />
          </Source>
        )}
        
        {/* Detection markers layer - single trip */}
        {showDetectionLayer && detectionsGeoJSON && !combinedDetections && (
          <Source id="detections" type="geojson" data={detectionsGeoJSON}>
            {/* Detection points - speed sign icons */}
            <Layer
              id="detection-points"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#ff00ff',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-opacity': 0.9,
              }}
            />
            {/* Glow effect */}
            <Layer
              id="detection-glow"
              type="circle"
              paint={{
                'circle-radius': 15,
                'circle-color': '#ff00ff',
                'circle-blur': 1,
                'circle-opacity': 0.4,
              }}
            />
          </Source>
        )}
        
        {/* Detection markers layer - multi-trip overlay */}
        {showDetectionLayer && combinedDetections && combinedDetections.features.length > 0 && (
          <Source id="combined-detections" type="geojson" data={combinedDetections}>
            {/* Detection points with trip colors */}
            <Layer
              id="detection-points"
              type="circle"
              paint={{
                'circle-radius': 10,
                'circle-color': ['get', 'trip_color'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-opacity': 0.95,
              }}
            />
            {/* Glow effect */}
            <Layer
              id="detection-glow"
              type="circle"
              paint={{
                'circle-radius': 18,
                'circle-color': ['get', 'trip_color'],
                'circle-blur': 1,
                'circle-opacity': 0.4,
              }}
            />
          </Source>
        )}
        
        {/* Detection popup */}
        {selectedDetection && (
          <Marker
            longitude={selectedDetection.longitude}
            latitude={selectedDetection.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
            }}
          >
            <div className="glass-panel border border-cyber-magenta/50 rounded-lg p-3 mb-2 min-w-[200px] shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-cyber-magenta uppercase tracking-wider">
                  {selectedDetection.class_name === 'white-speed-numeric' ? 'SPEED LIMIT' : 'SPEED TEXT'}
                </span>
                <button 
                  onClick={() => setSelectedDetection(null)}
                  className="text-cyber-magenta/50 hover:text-cyber-magenta"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-cyber-magenta/50">CONFIDENCE</span>
                  <span className="text-cyber-magenta">{(selectedDetection.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-magenta/50">LINK ID</span>
                  <span className="text-cyber-cyan">{selectedDetection.link_id || 'N/A'}</span>
                </div>
              </div>
            </div>
          </Marker>
        )}
        
        {/* Current position marker */}
        {currentPoint && (
          <Marker
            longitude={currentPoint.longitude}
            latitude={currentPoint.latitude}
            anchor="center"
          >
            <div className="relative">
              {/* Outer pulse ring */}
              <div className="absolute -inset-6 rounded-full bg-cyber-cyan/20 animate-ping" />
              {/* Second pulse ring (delayed) */}
              <div 
                className="absolute -inset-4 rounded-full bg-cyber-cyan/30 animate-ping" 
                style={{ animationDelay: '0.5s' }}
              />
              {/* Inner glowing ring */}
              <div className="absolute -inset-2 rounded-full bg-cyber-cyan/40 animate-pulse" />
              {/* Center dot with direction */}
              <div className="w-5 h-5 rounded-full bg-cyber-cyan shadow-cyber-cyan relative z-10 flex items-center justify-center border border-white/30">
                {/* Direction indicator */}
                <svg 
                  className="w-3 h-3 text-cyber-black"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ transform: `rotate(${currentPoint.forward ? 0 : 180}deg)` }}
                >
                  <path d="M12 2L4 14h6v8h4v-8h6L12 2z" />
                </svg>
              </div>
            </div>
          </Marker>
        )}
      </Map>

      {/* HUD Overlay Elements - Simplified for mobile */}
      
      {/* Top-left: Mode indicator + Detection toggle (hidden on mobile) */}
      {!isMobile && (
        <div className="absolute top-4 left-4 z-10 space-y-2">
          <HUDCorner color="cyan" size="sm">
            <div className="glass-panel px-3 py-2 rounded-sm">
              <div className="flex items-center gap-2">
                <StatusIndicator 
                  status={isMapLoaded ? 'active' : 'processing'} 
                  size="sm" 
                />
                <span className="text-cyber-cyan text-xs font-mono tracking-wider">
                  2D TACTICAL VIEW
                </span>
              </div>
            </div>
          </HUDCorner>
          
          {/* Detection layer toggle */}
          <button
            onClick={() => setShowDetectionLayer(!showDetectionLayer)}
            className={`
              glass-panel px-3 py-2 rounded-sm flex items-center gap-2 transition-all
              ${showDetectionLayer 
                ? 'border border-cyber-magenta/50 bg-cyber-magenta/10' 
                : 'border border-cyber-cyan/20 hover:border-cyber-cyan/40'
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
              SHOW DETECTIONS
            </span>
            {(detectionsGeoJSON || combinedDetections) && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                showDetectionLayer 
                  ? 'bg-cyber-magenta/30 text-cyber-magenta' 
                  : 'bg-cyber-cyan/20 text-cyber-cyan/50'
              }`}>
                {combinedDetections?.total || detectionsData?.detections?.length || 0}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Mobile: Compact top-right info */}
      {isMobile && selectedTrip && (
        <div className="absolute top-2 right-2 z-10">
          <div className="glass-panel px-2 py-1 rounded-sm border border-cyber-cyan/30 text-[10px] font-mono">
            <span className="text-cyber-cyan">{selectedTrip.date}</span>
            {filteredData.length > 0 && (
              <span className="text-cyber-cyan/50 ml-2">
                {currentIndex + 1}/{filteredData.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Desktop: Top-right Trip info */}
      {!isMobile && selectedTrip && (
        <div className="absolute top-4 right-14 z-10">
          <div className="glass-panel px-3 py-2 rounded-sm border border-cyber-magenta/30">
            <div className="text-[10px] text-cyber-magenta/50 mb-0.5">ACTIVE TRIP</div>
            <div className="text-cyber-magenta text-sm font-mono">{selectedTrip.date}</div>
          </div>
        </div>
      )}
      
      {/* Grid overlay - reduced opacity on mobile */}
      <div 
        className={`absolute inset-0 pointer-events-none z-[1] ${isMobile ? 'opacity-10' : 'opacity-20'}`}
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 247, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 247, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px'
        }}
      />
      
      {/* Coordinate overlay - hidden on mobile */}
      {!isMobile && (
        <div className="absolute bottom-20 left-4 z-10">
          <HUDCorner color="cyan" size="sm" animated={false}>
            <div className="glass-panel p-3 rounded-sm">
              <div className="text-[10px] text-cyber-cyan/50 mb-2 tracking-wider">COORDINATES</div>
              <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <span className="text-cyber-cyan/50 block mb-0.5">LAT</span>
                  <span className="text-cyber-cyan tabular-nums">
                    {currentPoint?.latitude.toFixed(6) || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-cyber-cyan/50 block mb-0.5">LNG</span>
                  <span className="text-cyber-cyan tabular-nums">
                    {currentPoint?.longitude.toFixed(6) || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-cyber-cyan/50 block mb-0.5">ZOOM</span>
                  <span className="text-cyber-cyan tabular-nums">
                    {mapZoom.toFixed(1)}×
                  </span>
                </div>
              </div>
            </div>
          </HUDCorner>
        </div>
      )}

      {/* Link ID indicator - compact on mobile */}
      {currentPoint?.link_id && (
        <div className={`absolute z-10 ${isMobile ? 'bottom-2 left-2' : 'bottom-20 right-14'}`}>
          <div className={`glass-panel-magenta border border-cyber-magenta/30 ${isMobile ? 'px-2 py-1' : 'px-3 py-2'} rounded-sm`}>
            {!isMobile && <div className="text-[10px] text-cyber-magenta/50 mb-0.5">ROAD LINK</div>}
            <div className={`text-cyber-magenta font-mono font-bold ${isMobile ? 'text-xs' : 'text-lg'}`}>
              {isMobile ? `L:${currentPoint.link_id}` : currentPoint.link_id}
            </div>
          </div>
        </div>
      )}

      {/* Frame indicator - hidden on mobile (shown in MobileTimeline instead) */}
      {!isMobile && filteredData.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="glass-panel px-4 py-2 rounded-sm border border-cyber-cyan/20">
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-cyber-cyan/50">FRAME</span>
              <span className="text-cyber-cyan text-lg tabular-nums">{currentIndex + 1}</span>
              <span className="text-cyber-cyan/30">/</span>
              <span className="text-cyber-cyan/50 tabular-nums">{filteredData.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Scanline effect - reduced on mobile */}
      <div 
        className={`absolute inset-0 pointer-events-none z-[2] ${isMobile ? 'opacity-15' : 'opacity-30'}`}
        style={{
          background: `linear-gradient(
            to bottom,
            transparent 50%,
            rgba(0, 0, 0, 0.1) 50%
          )`,
          backgroundSize: '100% 4px'
        }}
      />
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(Map2DComponent)
