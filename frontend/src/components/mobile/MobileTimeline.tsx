/**
 * Mobile Timeline Component
 * Compact playback controls for mobile view
 */

import { useEffect, useRef, useCallback } from 'react'
import { useTripStore } from '../../stores/tripStore'

export default function MobileTimeline() {
  const {
    getFilteredData,
    currentIndex,
    setCurrentIndex,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    nextFrame,
    prevFrame,
  } = useTripStore()
  
  const playbackRef = useRef<number | null>(null)
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  // Stable nextFrame function using ref
  const advanceFrame = useCallback(() => {
    const idx = currentIndexRef.current
    const data = getFilteredData()
    
    // Check if at end
    if (idx >= data.length - 1) {
      setIsPlaying(false)
      return
    }
    
    nextFrame()
  }, [getFilteredData, nextFrame, setIsPlaying])

  // Playback loop
  useEffect(() => {
    const filteredData = getFilteredData()
    if (isPlaying && filteredData.length > 0) {
      const baseInterval = 1000 / playbackSpeed / 2 // Base rate ~2fps, adjusted by speed
      
      playbackRef.current = window.setInterval(advanceFrame, baseInterval)
      
      return () => {
        if (playbackRef.current) {
          clearInterval(playbackRef.current)
        }
      }
    }
  }, [isPlaying, playbackSpeed, advanceFrame, getFilteredData])

  const filteredData = getFilteredData()
  const currentPoint = filteredData[currentIndex]
  const progress = filteredData.length > 0 
    ? (currentIndex / (filteredData.length - 1)) * 100 
    : 0

  if (filteredData.length === 0) {
    return (
      <div className="px-4 py-3 flex items-center justify-center">
        <span className="text-xs text-cyber-cyan/50 font-mono">NO DATA LOADED</span>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Progress bar */}
      <div className="relative h-2 bg-cyber-gray/50 rounded-full overflow-hidden">
        <div 
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyber-cyan to-cyber-magenta rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min="0"
          max={Math.max(0, filteredData.length - 1)}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(Number(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Time display */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyber-cyan tabular-nums">
            {formatTime(currentPoint?.timestamp)}
          </span>
          <span className="text-[10px] text-cyber-cyan/50">
            {currentIndex + 1}/{filteredData.length}
          </span>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center gap-1">
          {/* Previous */}
          <button
            onClick={prevFrame}
            disabled={currentIndex === 0}
            className="w-8 h-8 flex items-center justify-center rounded border border-cyber-cyan/30 
              text-cyber-cyan disabled:opacity-30 disabled:cursor-not-allowed
              hover:bg-cyber-cyan/10 active:bg-cyber-cyan/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`
              w-10 h-10 flex items-center justify-center rounded-full border-2 
              transition-all
              ${isPlaying 
                ? 'border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan shadow-[0_0_15px_rgba(0,255,247,0.3)]' 
                : 'border-cyber-cyan/50 text-cyber-cyan hover:border-cyber-cyan hover:bg-cyber-cyan/10'
              }
            `}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Next */}
          <button
            onClick={nextFrame}
            disabled={currentIndex >= filteredData.length - 1}
            className="w-8 h-8 flex items-center justify-center rounded border border-cyber-cyan/30 
              text-cyber-cyan disabled:opacity-30 disabled:cursor-not-allowed
              hover:bg-cyber-cyan/10 active:bg-cyber-cyan/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-1">
          {[1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`
                w-7 h-6 text-[10px] font-mono rounded transition-all
                ${playbackSpeed === speed 
                  ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50' 
                  : 'text-cyber-cyan/50 hover:text-cyber-cyan'
                }
              `}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return '--:--:--'
  const parts = timestamp.split(' ')
  return parts[1]?.substring(0, 8) || '--:--:--'
}

// Compact version for bottom sheet header
export function MiniTimeline() {
  const { getFilteredData, currentIndex, isPlaying, setIsPlaying, nextFrame, prevFrame } = useTripStore()
  const filteredData = getFilteredData()
  const progress = filteredData.length > 0 ? (currentIndex / (filteredData.length - 1)) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prevFrame}
        className="w-6 h-6 flex items-center justify-center text-cyber-cyan/70"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
        </svg>
      </button>
      
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className={`w-7 h-7 flex items-center justify-center rounded-full border 
          ${isPlaying ? 'border-cyber-cyan text-cyber-cyan' : 'border-cyber-cyan/50 text-cyber-cyan/70'}`}
      >
        {isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
      
      <button
        onClick={nextFrame}
        className="w-6 h-6 flex items-center justify-center text-cyber-cyan/70"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
      
      <div className="flex-1 h-1 bg-cyber-gray/50 rounded-full overflow-hidden">
        <div 
          className="h-full bg-cyber-cyan rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <span className="text-[10px] font-mono text-cyber-cyan/50 tabular-nums">
        {currentIndex + 1}/{filteredData.length || 0}
      </span>
    </div>
  )
}

