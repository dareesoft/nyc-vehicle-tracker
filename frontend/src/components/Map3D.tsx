/**
 * Map3D Component
 * 3D map visualization using deck.gl with heading-up mode
 */

import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import { Map } from 'react-map-gl/maplibre'
import DeckGL from '@deck.gl/react'
import type { PickingInfo } from '@deck.gl/core'
import { useTripStore } from '../stores/tripStore'
import { useTrip3D, useDetections } from '../hooks/useTrip'
import { useIsMobile } from '../hooks/useMediaQuery'
import {
  calculateBearing,
  interpolateBearing,
  MAP_STYLE,
  PathData,
  MapViewState,
  PositionRecord,
} from './Map3DUtils'
import {
  createPathLayer,
  createGlowPathLayer,
  createPointsLayer,
  createCurrentPositionLayer,
  createLabelsLayer,
  createCombinedRoutesLayer,
  createDetectionPinsLayer,
} from './Map3DLayers'
import 'maplibre-gl/dist/maplibre-gl.css'

function Map3DComponent() {
  const isMobile = useIsMobile()
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

  const [viewState, setViewState] = useState<MapViewState>({
    longitude: mapCenter[0],
    latitude: mapCenter[1],
    zoom: mapZoom,
    pitch: 45,
    bearing: 0,
  })

  const [hoveredObject, setHoveredObject] = useState<PathData | null>(null)

  // Position history for stable heading calculation
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
    if (!currentPoint || !followVehicle) return

    // Add current position to history (avoid duplicates)
    if (lastProcessedIndexRef.current !== currentIndex) {
      positionHistoryRef.current.push({
        lat: currentPoint.latitude,
        lng: currentPoint.longitude,
        index: currentIndex,
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

      setViewState((prev) => ({
        ...prev,
        longitude: currentPoint.longitude,
        latitude: currentPoint.latitude,
        bearing: smoothBearing,
      }))
    } else {
      // Not playing - center on point, reset bearing
      currentBearingRef.current = 0
      positionHistoryRef.current = []
      setViewState((prev) => ({
        ...prev,
        longitude: currentPoint.longitude,
        latitude: currentPoint.latitude,
        bearing: 0,
      }))
    }
  }, [currentPoint, isPlaying, followVehicle, currentIndex])

  const onViewStateChange = useCallback((params: any) => {
    if (params.viewState) {
      setViewState(params.viewState)
      currentBearingRef.current = params.viewState.bearing
    }
  }, [])

  const onHover = useCallback((info: PickingInfo) => {
    setHoveredObject((info.object as PathData) || null)
  }, [])

  const onPointClick = useCallback(
    (index: number) => setCurrentIndex(index),
    [setCurrentIndex]
  )

  // Build layers
  const layers = useMemo(() => {
    const result: any[] = []

    if (combinedRoutes?.features?.length) {
      // Multi-trip overlay mode
      const combinedLayer = createCombinedRoutesLayer(combinedRoutes)
      if (combinedLayer) result.push(combinedLayer)
    } else if (trip3D?.paths) {
      // Single trip mode
      result.push(createGlowPathLayer(trip3D.paths))
      result.push(createPathLayer(trip3D.paths, onHover))

      if (filteredData.length) {
        result.push(createPointsLayer(filteredData, currentIndex, onPointClick))
      }

      if (currentPoint) {
        result.push(createCurrentPositionLayer(currentPoint))
      }

      result.push(createLabelsLayer(trip3D.paths))
    }

    // Add detection layer if enabled
    if (showDetectionLayer) {
      const detectionLayer = createDetectionPinsLayer(combinedDetections, detectionsData || null)
      if (detectionLayer) result.push(detectionLayer)
    }

    return result.filter(Boolean)
  }, [
    combinedRoutes,
    trip3D,
    filteredData,
    currentIndex,
    currentPoint,
    showDetectionLayer,
    combinedDetections,
    detectionsData,
    onHover,
    onPointClick,
  ])

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

      {/* 3D Controls - hidden on mobile */}
      {!isMobile && (
        <Map3DControls
          viewState={viewState}
          setViewState={setViewState}
          isPlaying={isPlaying}
          showDetectionLayer={showDetectionLayer}
          setShowDetectionLayer={setShowDetectionLayer}
          detectionCount={combinedDetections?.total || detectionsData?.detections?.length || 0}
        />
      )}

      {/* Hover tooltip - hidden on mobile */}
      {!isMobile && hoveredObject && <HoverTooltip data={hoveredObject} />}

      {/* View info - hidden on mobile */}
      {!isMobile && <ViewInfo viewState={viewState} segmentCount={trip3D?.paths?.length || 0} />}
      
      {/* Mobile: Compact info */}
      {isMobile && selectedTrip && (
        <div className="absolute top-2 right-2 z-10">
          <div className="glass-panel px-2 py-1 rounded-sm border border-cyber-magenta/30 text-[10px] font-mono">
            <span className="text-cyber-magenta">3D • {selectedTrip.date}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Controls panel component
interface ControlsProps {
  viewState: MapViewState
  setViewState: React.Dispatch<React.SetStateAction<MapViewState>>
  isPlaying: boolean
  showDetectionLayer: boolean
  setShowDetectionLayer: (show: boolean) => void
  detectionCount: number
}

function Map3DControls({
  viewState,
  setViewState,
  isPlaying,
  showDetectionLayer,
  setShowDetectionLayer,
  detectionCount,
}: ControlsProps) {
  return (
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
            onChange={(e) =>
              setViewState((prev) => ({ ...prev, pitch: Number(e.target.value) }))
            }
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
            onChange={(e) =>
              setViewState((prev) => ({ ...prev, bearing: Number(e.target.value) }))
            }
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
          <div
            className={`
            w-3 h-3 rounded-sm border-2 flex items-center justify-center
            ${showDetectionLayer ? 'border-cyber-magenta bg-cyber-magenta' : 'border-cyber-cyan/50'}
          `}
          >
            {showDetectionLayer && (
              <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z" />
              </svg>
            )}
          </div>
          <span
            className={`text-xs font-mono tracking-wider ${
              showDetectionLayer ? 'text-cyber-magenta' : 'text-cyber-cyan/50'
            }`}
          >
            DETECTION PINS
          </span>
          {detectionCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ml-auto ${
                showDetectionLayer
                  ? 'bg-cyber-magenta/30 text-cyber-magenta'
                  : 'bg-cyber-cyan/20 text-cyber-cyan/50'
              }`}
            >
              {detectionCount}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

// Hover tooltip component
function HoverTooltip({ data }: { data: PathData }) {
  return (
    <div className="absolute top-4 right-4 glass-panel-magenta p-4 rounded">
      <h3 className="data-label text-cyber-magenta mb-2">LINK SEGMENT</h3>
      <div className="space-y-1 text-sm">
        <div>
          <span className="text-cyber-magenta/50">LINK ID:</span>
          <span className="text-cyber-magenta ml-2 font-bold">{data.link_id || 'Unknown'}</span>
        </div>
        <div>
          <span className="text-cyber-magenta/50">DIRECTION:</span>
          <span className="text-cyber-magenta ml-2">{data.forward ? 'FORWARD' : 'BACKWARD'}</span>
        </div>
        <div>
          <span className="text-cyber-magenta/50">POINTS:</span>
          <span className="text-cyber-magenta ml-2">{data.path.length}</span>
        </div>
      </div>
    </div>
  )
}

// View info component
function ViewInfo({ viewState, segmentCount }: { viewState: MapViewState; segmentCount: number }) {
  return (
    <div className="absolute bottom-4 left-4 glass-panel p-3 rounded text-xs font-mono">
      <div className="flex gap-4">
        <div>
          <span className="text-cyber-magenta/50">PITCH:</span>
          <span className="text-cyber-magenta ml-2">{viewState.pitch.toFixed(0)}°</span>
        </div>
        <div>
          <span className="text-cyber-magenta/50">BEARING:</span>
          <span className="text-cyber-magenta ml-2">
            {((viewState.bearing + 360) % 360).toFixed(0)}°
          </span>
        </div>
        <div>
          <span className="text-cyber-magenta/50">SEGMENTS:</span>
          <span className="text-cyber-magenta ml-2">{segmentCount}</span>
        </div>
      </div>
    </div>
  )
}

export default memo(Map3DComponent)
