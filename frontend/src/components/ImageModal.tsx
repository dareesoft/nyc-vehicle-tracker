/**
 * Image Modal Component
 * Full-screen zoomable image viewer with pan support
 */

import { useState } from 'react'

interface ImageModalProps {
  imageUrl: string
  timestamp: string
  frameNumber: number
  totalFrames: number
  latitude?: number
  longitude?: number
  linkId?: number | null
  onClose: () => void
}

export default function ImageModal({
  imageUrl,
  timestamp,
  frameNumber,
  totalFrames,
  latitude,
  longitude,
  linkId,
  onClose,
}: ImageModalProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((prev) => Math.max(0.5, Math.min(5, prev * delta)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const resetView = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <div className="fixed inset-0 z-50 bg-cyber-black/95 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-cyber-cyan/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-6 hud-text-outline">
          <div>
            <span className="text-[10px] opacity-60 block">TIME</span>
            <span className="text-lg">{timestamp}</span>
          </div>
          <div>
            <span className="text-[10px] opacity-60 block">FRAME</span>
            <span className="text-lg font-bold">{frameNumber}</span>
            <span className="text-sm opacity-50">/{totalFrames}</span>
          </div>
          {latitude && longitude && (
            <div>
              <span className="text-[10px] opacity-60 block">COORDINATES</span>
              <span className="text-sm">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </span>
            </div>
          )}
          {linkId != null && (
            <div className="hud-text-outline-magenta">
              <span className="text-[10px] opacity-60 block">LINK</span>
              <span className="text-lg font-bold">{linkId}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Zoom controls */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.25))}
              className="px-2 py-1 border border-cyber-cyan/30 rounded hover:bg-cyber-cyan/10 text-cyber-cyan"
            >
              −
            </button>
            <span className="text-cyber-cyan font-mono w-16 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(5, prev + 0.25))}
              className="px-2 py-1 border border-cyber-cyan/30 rounded hover:bg-cyber-cyan/10 text-cyber-cyan"
            >
              +
            </button>
            <button
              onClick={resetView}
              className="px-3 py-1 border border-cyber-cyan/30 rounded hover:bg-cyber-cyan/10 text-cyber-cyan text-xs ml-2"
            >
              RESET
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 border border-cyber-cyan/30 rounded hover:bg-cyber-cyan/10"
          >
            <svg className="w-6 h-6 text-cyber-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image container */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center cursor-move"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt="Expanded view"
          className="max-w-none select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          draggable={false}
        />
      </div>

      {/* Help text */}
      <div className="p-2 text-center text-cyber-cyan/30 text-xs">
        Scroll to zoom • Drag to pan • Click outside or ESC to close
      </div>
    </div>
  )
}

