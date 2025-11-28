/**
 * Logout Confirmation Modal
 * Cyberpunk themed confirmation dialog for logout action
 */

import { useEffect } from 'react'

interface LogoutConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function LogoutConfirmModal({ isOpen, onConfirm, onCancel }: LogoutConfirmModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-cyber-black/70 backdrop-blur-md" />
      
      {/* Modal */}
      <div 
        className="relative glass-panel border border-cyber-magenta/50 rounded-lg p-6 max-w-sm w-full animate-fade-slide-in mx-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          boxShadow: '0 0 40px rgba(255, 0, 255, 0.2), 0 0 80px rgba(255, 0, 255, 0.1)',
        }}
      >
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyber-magenta" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyber-magenta" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyber-magenta" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyber-magenta" />

        {/* Warning icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full border-2 border-cyber-magenta/50 flex items-center justify-center bg-cyber-magenta/10 animate-pulse">
            <svg className="w-8 h-8 text-cyber-magenta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-center font-mono text-lg text-cyber-magenta tracking-wider mb-2">
          ⚠ CONFIRM LOGOUT
        </h3>
        
        {/* Message */}
        <p className="text-center text-cyber-cyan/70 font-mono text-sm mb-6">
          Terminate current session and return to access terminal?
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded font-mono text-sm tracking-wider
              border-2 border-cyber-cyan/30 text-cyber-cyan/70
              hover:border-cyber-cyan hover:text-cyber-cyan hover:bg-cyber-cyan/10
              transition-all duration-200"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded font-mono text-sm tracking-wider
              border-2 border-cyber-magenta bg-cyber-magenta/20 text-cyber-magenta
              hover:bg-cyber-magenta/30 hover:shadow-[0_0_20px_rgba(255,0,255,0.3)]
              transition-all duration-200"
          >
            LOGOUT
          </button>
        </div>

        {/* Scanline effect */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden opacity-20"
          style={{
            background: `linear-gradient(
              to bottom,
              transparent 50%,
              rgba(255, 0, 255, 0.1) 50%
            )`,
            backgroundSize: '100% 4px',
          }}
        />
      </div>
    </div>
  )
}
