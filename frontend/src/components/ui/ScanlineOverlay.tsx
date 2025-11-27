interface ScanlineOverlayProps {
  opacity?: number
  speed?: 'slow' | 'medium' | 'fast'
  className?: string
}

const speedConfig = {
  slow: '12s',
  medium: '8s',
  fast: '4s'
}

export default function ScanlineOverlay({
  opacity = 0.03,
  speed = 'medium',
  className = ''
}: ScanlineOverlayProps) {
  return (
    <>
      {/* Horizontal scanlines */}
      <div 
        className={`pointer-events-none fixed inset-0 z-50 ${className}`}
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 247, ${opacity}) 2px,
            rgba(0, 255, 247, ${opacity}) 4px
          )`
        }}
      />
      
      {/* Moving scanline */}
      <div 
        className={`pointer-events-none fixed inset-x-0 h-[2px] z-50 ${className}`}
        style={{
          background: `linear-gradient(90deg, 
            transparent, 
            rgba(0, 255, 247, 0.1), 
            transparent
          )`,
          animation: `scanline-move ${speedConfig[speed]} linear infinite`,
        }}
      />

      {/* CRT vignette effect */}
      <div 
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          background: `radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 60%,
            rgba(0, 0, 0, 0.3) 100%
          )`
        }}
      />
    </>
  )
}

