import { useEffect, useRef, useCallback, useState } from 'react'
import { useTripStore } from '../stores/tripStore'
import { useImagePreloader } from '../hooks/useImagePreloader'
import { StatusIndicator, HUDCorner } from './ui'

export default function Timeline() {
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
  
  const [showKeyboardHints, setShowKeyboardHints] = useState(true)
  const playbackRef = useRef<number | null>(null)
  const filteredData = getFilteredData()
  const currentPoint = filteredData[currentIndex]
  
  // Use preloader to check buffer status
  const { preloadProgress } = useImagePreloader(filteredData, currentIndex, isPlaying)
  
  // Store current index in ref to access in interval
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
    
    // Always advance - preloading happens in background
    nextFrame()
  }, [getFilteredData, nextFrame, setIsPlaying])
  
  // Playback loop - simple interval that just advances frames
  useEffect(() => {
    if (isPlaying && filteredData.length > 0) {
      const baseInterval = 1000 / playbackSpeed / 2 // Base rate ~2fps, adjusted by speed
      
      playbackRef.current = window.setInterval(advanceFrame, baseInterval)
      
      return () => {
        if (playbackRef.current) {
          clearInterval(playbackRef.current)
        }
      }
    }
  }, [isPlaying, playbackSpeed, filteredData.length, advanceFrame])
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      
      // Hide hints after first keypress
      setShowKeyboardHints(false)
      
      switch (e.key) {
        case ' ':
          e.preventDefault()
          setIsPlaying(!isPlaying)
          break
        case 'ArrowLeft':
          e.preventDefault()
          prevFrame()
          break
        case 'ArrowRight':
          e.preventDefault()
          nextFrame()
          break
        case '1':
          setPlaybackSpeed(0.5)
          break
        case '2':
          setPlaybackSpeed(1)
          break
        case '3':
          setPlaybackSpeed(2)
          break
        case '4':
          setPlaybackSpeed(4)
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, setIsPlaying, nextFrame, prevFrame, setPlaybackSpeed])
  
  const progress = filteredData.length > 0 
    ? (currentIndex / (filteredData.length - 1)) * 100 
    : 0
  
  return (
    <footer className="h-20 glass-panel border-t border-cyber-cyan/20 flex items-center px-6 gap-6 relative overflow-hidden">
      {/* Subtle animated background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-cyan/5 to-transparent"
          style={{ 
            animation: isPlaying ? 'radar-sweep 2s linear infinite' : 'none',
            opacity: isPlaying ? 1 : 0
          }}
        />
      </div>

      {/* Playback controls */}
      <HUDCorner color="cyan" size="sm" animated={isPlaying}>
        <div className="flex items-center gap-1 p-1 bg-cyber-dark/50 rounded">
          {/* Previous */}
          <button
            onClick={prevFrame}
            disabled={currentIndex === 0 || filteredData.length === 0}
            className="cyber-button px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyber-cyan/10 transition-colors"
            title="Previous frame (←)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          
          {/* Play/Pause - Enhanced with glow when playing */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={filteredData.length === 0}
            className={`
              cyber-button px-4 py-2 disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-300 relative overflow-hidden
              ${isPlaying 
                ? 'bg-cyber-cyan/20 border-cyber-cyan shadow-[0_0_20px_rgba(0,255,247,0.3)] animate-pulse' 
                : 'hover:bg-cyber-cyan/10'
              }
            `}
            title="Play/Pause (Space)"
          >
            {isPlaying ? (
              <svg className="w-5 h-5 text-cyber-cyan" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          
          {/* Next */}
          <button
            onClick={nextFrame}
            disabled={currentIndex >= filteredData.length - 1 || filteredData.length === 0}
            className="cyber-button px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyber-cyan/10 transition-colors"
            title="Next frame (→)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
          
          {/* Stop */}
          <button
            onClick={() => {
              setIsPlaying(false)
              setCurrentIndex(0)
            }}
            disabled={filteredData.length === 0}
            className="cyber-button px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cyber-cyan/10 transition-colors"
            title="Stop"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        </div>
      </HUDCorner>
      
      {/* Timeline slider */}
      <div className="flex-1 flex items-center gap-4 relative z-10">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-cyber-cyan/50 mb-0.5">TIME</span>
          <span className="text-sm font-mono text-cyber-cyan tabular-nums w-20">
            {formatTime(currentPoint?.timestamp)}
          </span>
        </div>
        
        <div className="flex-1 relative py-2">
          {/* Progress background */}
          <div className="absolute inset-x-0 h-2 top-1/2 -translate-y-1/2 bg-cyber-gray/50 rounded-sm overflow-hidden">
            {/* Tick marks */}
            <div className="absolute inset-0 flex">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex-1 border-r border-cyber-cyan/10 last:border-0" />
              ))}
            </div>
          </div>
          
          {/* Progress bar with glow */}
          <div 
            className="absolute left-0 h-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-cyber-cyan to-cyber-magenta rounded-sm transition-all duration-100"
            style={{ width: `${progress}%` }}
          >
            {/* Glow effect at the end */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-cyber-cyan rounded-full shadow-[0_0_10px_rgba(0,255,247,0.8)]" />
          </div>
          
          {/* Slider input */}
          <input
            type="range"
            min="0"
            max={Math.max(0, filteredData.length - 1)}
            value={currentIndex}
            onChange={(e) => setCurrentIndex(Number(e.target.value))}
            disabled={filteredData.length === 0}
            className="relative z-10 w-full cursor-pointer disabled:cursor-not-allowed opacity-0 h-6"
          />
        </div>
        
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-cyber-cyan/50 mb-0.5">FRAME</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-mono text-cyber-cyan tabular-nums">
              {currentIndex + 1}
            </span>
            <span className="text-xs text-cyber-cyan/30">/</span>
            <span className="text-xs text-cyber-cyan/50 tabular-nums">
              {filteredData.length || 0}
            </span>
          </div>
        </div>
      </div>
      
      {/* Speed controls */}
      <div className="flex items-center gap-2 relative z-10">
        <span className="text-[10px] text-cyber-cyan/50 tracking-wider mr-1">SPEED</span>
        <div className="flex gap-1 bg-cyber-dark/50 rounded p-1">
          {[0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`
                px-2 py-1 text-xs font-mono rounded transition-all duration-200
                ${playbackSpeed === speed 
                  ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 shadow-[0_0_10px_rgba(0,255,247,0.2)]' 
                  : 'text-cyber-cyan/50 hover:text-cyber-cyan hover:bg-cyber-cyan/10'
                }
              `}
              title={`Speed ${speed}x (${[0.5, 1, 2, 4].indexOf(speed) + 1})`}
            >
              {speed}×
            </button>
          ))}
        </div>
      </div>
      
      {/* Buffer status and keyboard hints */}
      <div className="flex items-center gap-4 relative z-10">
        {/* Buffer indicator */}
        {isPlaying && preloadProgress < 100 && (
          <div className="flex items-center gap-2">
            <StatusIndicator 
              status={preloadProgress > 50 ? 'active' : preloadProgress > 25 ? 'warning' : 'error'}
              size="sm"
            />
            <div className="flex flex-col">
              <span className="text-[10px] text-cyber-cyan/50">BUFFER</span>
              <div className="w-16 h-1 bg-cyber-dark rounded overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    preloadProgress > 50 ? 'bg-cyber-cyan' : preloadProgress > 25 ? 'bg-cyber-yellow' : 'bg-cyber-magenta'
                  }`}
                  style={{ width: `${preloadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Status indicator when playing */}
        {isPlaying && preloadProgress >= 100 && (
          <StatusIndicator status="active" label="STREAMING" size="sm" />
        )}
        
        {/* Keyboard hints */}
        {showKeyboardHints && !isPlaying && (
          <div className="text-xs text-cyber-cyan/20 hidden xl:flex items-center gap-3 animate-fade-slide-in">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-cyber-dark rounded text-[10px] border border-cyber-cyan/20">SPACE</kbd>
              <span>Play</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-cyber-dark rounded text-[10px] border border-cyber-cyan/20">←→</kbd>
              <span>Nav</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-cyber-dark rounded text-[10px] border border-cyber-cyan/20">1-4</kbd>
              <span>Speed</span>
            </span>
          </div>
        )}
      </div>
    </footer>
  )
}

function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return '--:--:--'
  const parts = timestamp.split(' ')
  return parts[1]?.substring(0, 8) || '--:--:--'
}
