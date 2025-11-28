/**
 * Bottom Sheet Component
 * Draggable bottom sheet for mobile with multiple snap points
 */

import { useState, useRef, useEffect, ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
  isOpen: boolean
  onClose?: () => void
  snapPoints?: number[]  // Percentages of screen height (e.g., [0.3, 0.6, 0.9])
  defaultSnapIndex?: number
  header?: ReactNode
}

export default function BottomSheet({
  children,
  isOpen,
  onClose,
  snapPoints = [0.15, 0.5, 0.85],
  defaultSnapIndex = 0,
  header,
}: BottomSheetProps) {
  const [currentSnapIndex, setCurrentSnapIndex] = useState(defaultSnapIndex)
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const currentHeight = snapPoints[currentSnapIndex] * 100

  // Handle touch/mouse events for dragging
  const handleDragStart = (clientY: number) => {
    setIsDragging(true)
    startYRef.current = clientY
    startHeightRef.current = snapPoints[currentSnapIndex] * window.innerHeight
  }

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return
    const delta = startYRef.current - clientY
    setDragY(delta)
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    const newHeight = startHeightRef.current + dragY
    const screenHeight = window.innerHeight
    const newPercent = newHeight / screenHeight

    // Find closest snap point
    let closestIndex = 0
    let minDiff = Math.abs(snapPoints[0] - newPercent)
    
    snapPoints.forEach((point, index) => {
      const diff = Math.abs(point - newPercent)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = index
      }
    })

    // Check if dragged below minimum - close sheet
    if (newPercent < snapPoints[0] * 0.5) {
      onClose?.()
      setCurrentSnapIndex(0)
    } else {
      setCurrentSnapIndex(closestIndex)
    }

    setDragY(0)
  }

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }

  const handleTouchEnd = () => {
    handleDragEnd()
  }

  // Mouse event handlers (for testing on desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY)
    }

    const handleMouseUp = () => {
      handleDragEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Calculate actual height with drag offset
  const actualHeight = isDragging 
    ? startHeightRef.current + dragY 
    : snapPoints[currentSnapIndex] * window.innerHeight

  if (!isOpen) return null

  return (
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 z-30 glass-panel rounded-t-2xl border-t border-x border-cyber-cyan/30 transition-all"
      style={{
        height: isDragging ? actualHeight : `${currentHeight}vh`,
        transitionDuration: isDragging ? '0ms' : '300ms',
      }}
    >
      {/* Drag handle */}
      <div
        className="h-8 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div className="w-10 h-1 bg-cyber-cyan/30 rounded-full" />
      </div>

      {/* Header */}
      {header && (
        <div className="px-4 pb-2 border-b border-cyber-cyan/20">
          {header}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden h-[calc(100%-2rem)]">
        {children}
      </div>

      {/* Snap point indicators */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
        {snapPoints.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSnapIndex(index)}
            className={`
              w-1.5 h-1.5 rounded-full transition-all
              ${currentSnapIndex === index 
                ? 'bg-cyber-cyan scale-125' 
                : 'bg-cyber-cyan/30'
              }
            `}
          />
        ))}
      </div>
    </div>
  )
}

// Quick action buttons for the bottom sheet
interface QuickActionProps {
  icon: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  color?: 'cyan' | 'magenta'
}

export function QuickAction({ icon, label, onClick, active, color = 'cyan' }: QuickActionProps) {
  const colorClasses = color === 'cyan' 
    ? 'border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/10'
    : 'border-cyber-magenta/30 text-cyber-magenta hover:bg-cyber-magenta/10'

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-1 p-3 rounded-lg border transition-all
        ${colorClasses}
        ${active ? (color === 'cyan' ? 'bg-cyber-cyan/20' : 'bg-cyber-magenta/20') : ''}
      `}
    >
      {icon}
      <span className="text-[10px] font-mono">{label}</span>
    </button>
  )
}

