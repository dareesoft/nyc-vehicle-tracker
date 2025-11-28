/**
 * Camera Viewer Component
 * Displays the current camera feed with HUD overlay
 */

import { useState, useEffect } from 'react'
import { useTripStore } from '../stores/tripStore'
import { getImageUrl, getOriginalImageUrl } from '../hooks/useTrip'
import { useImagePreloader } from '../hooks/useImagePreloader'
import { useGlitch } from '../hooks/useAnimations'
import { StatusIndicator, RollingTimestamp, RollingNumber, RollingCoordinate } from './ui'
import ImageModal from './ImageModal'

export default function CameraViewer() {
  const { getFilteredData, currentIndex, isPlaying } = useTripStore()

  const [imageError, setImageError] = useState(false)
  const [displayedIndex, setDisplayedIndex] = useState(-1)
  const [isExpanded, setIsExpanded] = useState(false)
  const { isGlitching, triggerGlitch } = useGlitch(150)

  const filteredData = getFilteredData()
  const currentPoint = filteredData[currentIndex]

  // Use the preloader hook
  const { preloadProgress, isPreloaded, getCachedImage } = useImagePreloader(
    filteredData,
    currentIndex,
    isPlaying
  )

  // Check if current image is ready
  const currentImageReady = currentPoint ? isPreloaded(currentPoint) : false
  const currentImageUrl = currentPoint
    ? getCachedImage(currentPoint) || getImageUrl(currentPoint)
    : null

  // Track when image actually displays
  useEffect(() => {
    if (currentImageReady && currentIndex !== displayedIndex) {
      setDisplayedIndex(currentIndex)
      setImageError(false)
      // Occasional glitch effect on frame change
      if (Math.random() > 0.95) {
        triggerGlitch()
      }
    }
  }, [currentImageReady, currentIndex, displayedIndex, triggerGlitch])

  // Close expanded view on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  return (
    <>
      <div className="h-1/2 border-b border-cyber-cyan/20 flex flex-col">
        {/* Header */}
        <CameraHeader
          isActive={!!currentPoint}
          isPlaying={isPlaying}
          preloadProgress={preloadProgress}
          onExpand={() => currentPoint && setIsExpanded(true)}
        />

        {/* Main camera view */}
        <div
          className={`
            flex-1 relative bg-cyber-black overflow-hidden cursor-pointer
            ${isGlitching ? 'glitch-low' : ''}
          `}
          onClick={() => currentPoint && setIsExpanded(true)}
        >
          {!currentPoint ? (
            <EmptyState />
          ) : (
            <>
              {/* HUD Overlay - Targeting corners */}
              <HUDCorners />

              {/* Loading state */}
              {!currentImageReady && !imageError && <LoadingState />}

              {/* Error state */}
              {imageError && <ErrorState />}

              {/* Image */}
              {currentImageUrl && (
                <img
                  key={currentImageUrl}
                  src={currentImageUrl}
                  alt={`Camera feed ${currentPoint.timestamp}`}
                  className={`
                    w-full h-full object-contain transition-opacity duration-100
                    ${currentImageReady ? 'opacity-100' : 'opacity-0'}
                  `}
                  onError={() => setImageError(true)}
                  loading="eager"
                  decoding="sync"
                />
              )}

              {/* HUD Text Overlays */}
              <HUDOverlays
                currentPoint={currentPoint}
                currentIndex={currentIndex}
                totalFrames={filteredData.length}
                isPlaying={isPlaying}
                preloadProgress={preloadProgress}
              />

              {/* Scanline effect */}
              <ScanlineEffect />
            </>
          )}
        </div>
      </div>

      {/* Expanded Modal View */}
      {isExpanded && currentPoint && (
        <ImageModal
          imageUrl={getOriginalImageUrl(currentPoint)}
          timestamp={formatTimestamp(currentPoint.timestamp)}
          frameNumber={currentIndex + 1}
          totalFrames={filteredData.length}
          latitude={currentPoint.latitude}
          longitude={currentPoint.longitude}
          linkId={currentPoint.link_id}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </>
  )
}

// Sub-components

interface CameraHeaderProps {
  isActive: boolean
  isPlaying: boolean
  preloadProgress: number
  onExpand: () => void
}

function CameraHeader({ isActive, isPlaying, preloadProgress, onExpand }: CameraHeaderProps) {
  return (
    <div className="px-4 py-2 border-b border-cyber-cyan/20 flex items-center justify-between bg-cyber-dark/50">
      <div className="flex items-center gap-3">
        <h2 className="data-label flex items-center gap-2">
          <StatusIndicator status={isActive ? 'active' : 'idle'} size="sm" pulse={isPlaying} />
          CAMERA FEED
        </h2>
        {/* Preload indicator */}
        {preloadProgress < 100 && isActive && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-cyber-dark rounded overflow-hidden border border-cyber-cyan/20">
              <div
                className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta transition-all duration-300 progress-glow"
                style={{ width: `${preloadProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-cyber-cyan/50 font-mono tabular-nums">
              {preloadProgress}%
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isActive && (
          <button
            onClick={onExpand}
            className="p-1.5 border border-cyber-cyan/30 rounded hover:bg-cyber-cyan/10 transition-colors"
            title="Expand (ESC to close)"
          >
            <svg className="w-4 h-4 text-cyber-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 border-2 border-cyber-cyan/20 rounded-lg flex items-center justify-center relative">
          {/* Animated corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyber-cyan/40" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyber-cyan/40" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyber-cyan/40" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyber-cyan/40" />

          <svg className="w-10 h-10 text-cyber-cyan/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-cyber-cyan/40 text-sm font-mono tracking-wider">NO FEED SELECTED</p>
        <p className="text-cyber-cyan/20 text-xs mt-2">Select a trip to view footage</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-cyber-black z-10">
      <div className="text-center">
        <div className="cyber-spinner mx-auto mb-3" />
        <p className="text-cyber-cyan/50 text-xs font-mono">BUFFERING...</p>
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-cyber-black z-10">
      <div className="text-center">
        <StatusIndicator status="error" size="lg" className="justify-center mb-3" />
        <p className="text-cyber-magenta text-sm font-mono">FEED ERROR</p>
        <p className="text-cyber-magenta/50 text-xs mt-1">Signal lost</p>
      </div>
    </div>
  )
}

function HUDCorners() {
  return (
    <div className="camera-hud-overlay">
      <div className="camera-hud-corner top-left animate-pulse" style={{ animationDelay: '0s' }} />
      <div className="camera-hud-corner top-right animate-pulse" style={{ animationDelay: '0.1s' }} />
      <div className="camera-hud-corner bottom-left animate-pulse" style={{ animationDelay: '0.2s' }} />
      <div className="camera-hud-corner bottom-right animate-pulse" style={{ animationDelay: '0.3s' }} />
    </div>
  )
}

interface HUDOverlaysProps {
  currentPoint: { timestamp: string; latitude: number; longitude: number; link_id: number | null }
  currentIndex: number
  totalFrames: number
  isPlaying: boolean
  preloadProgress: number
}

function HUDOverlays({ currentPoint, currentIndex, totalFrames, isPlaying, preloadProgress }: HUDOverlaysProps) {
  return (
    <>
      {/* Top-left: Timestamp */}
      <div className="absolute top-3 left-3 z-20 hud-text-outline">
        <span className="text-[10px] opacity-60 block">TIME</span>
        <RollingTimestamp timestamp={formatTimestamp(currentPoint.timestamp)} className="text-sm" />
      </div>

      {/* Top-right: Frame counter */}
      <div className="absolute top-3 right-3 z-20 hud-text-outline text-right">
        <span className="text-[10px] opacity-60 block">FRAME</span>
        <span className="text-lg font-bold">
          <RollingNumber value={currentIndex + 1} />
        </span>
        <span className="text-xs opacity-50">/{totalFrames}</span>
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex justify-between items-end">
        {/* Left: Coordinates */}
        <div className="hud-text-outline">
          <div className="flex gap-3 text-xs">
            <div>
              <span className="opacity-50">LAT </span>
              <RollingCoordinate value={currentPoint.latitude} decimals={5} />
            </div>
            <div>
              <span className="opacity-50">LNG </span>
              <RollingCoordinate value={currentPoint.longitude} decimals={5} />
            </div>
          </div>
        </div>

        {/* Right: Link ID */}
        {currentPoint.link_id && (
          <div className="hud-text-outline-magenta text-right">
            <span className="text-[10px] opacity-60 block">LINK</span>
            <span className="text-sm font-bold">
              <RollingNumber value={currentPoint.link_id} />
            </span>
          </div>
        )}
      </div>

      {/* Buffer status indicator */}
      {isPlaying && preloadProgress < 50 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
          <div className="hud-text-outline flex items-center gap-2 text-cyber-yellow">
            <div className="w-2 h-2 rounded-full bg-cyber-yellow animate-pulse" />
            <span className="text-xs">BUFFERING {preloadProgress}%</span>
          </div>
        </div>
      )}
    </>
  )
}

function ScanlineEffect() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 255, 247, 0.015) 2px,
          rgba(0, 255, 247, 0.015) 4px
        )`,
      }}
    />
  )
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '--:--:--'
  const parts = timestamp.split(' ')
  return parts[1] || '--:--:--'
}
