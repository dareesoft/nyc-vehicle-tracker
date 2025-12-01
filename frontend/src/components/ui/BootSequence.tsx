import { useEffect, useState, useRef, useCallback } from 'react'
import TypeWriter from './TypeWriter'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface BootSequenceProps {
  onComplete: (prefetchedData?: PrefetchedData) => void
  skipDelay?: number
}

interface BootStep {
  id: string
  text: string
  status: 'pending' | 'running' | 'complete' | 'error'
  message?: string
}

export interface PrefetchedData {
  health?: {
    status: string
    cache_size: number
  }
  trips?: Array<{
    device_id: string
    date: string
    image_count: number
    detection_count: number
  }>
  recent_trip?: {
    device_id: string
    date: string
    images: unknown[]
  }
  coverage?: unknown
}

// Initial boot steps (will be updated by SSE)
const initialBootSteps: BootStep[] = [
  { id: 'db_connection', text: 'ESTABLISHING DATABASE CONNECTION', status: 'pending' },
  { id: 'trips', text: 'LOADING SURVEILLANCE NETWORK', status: 'pending' },
  { id: 'recent_trip', text: 'SYNCING VEHICLE TELEMETRY', status: 'pending' },
  { id: 'coverage', text: 'INITIALIZING COVERAGE ANALYSIS', status: 'pending' },
  { id: 'nyc_signs', text: 'ACTIVATING CAMERA FEEDS', status: 'pending' },
  { id: 'complete', text: 'SYSTEM READY', status: 'pending' }
]

export default function BootSequence({ onComplete, skipDelay = 10000 }: BootSequenceProps) {
  const [steps, setSteps] = useState<BootStep[]>(initialBootSteps)
  const [progress, setProgress] = useState(0)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [currentMessage, setCurrentMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const prefetchedDataRef = useRef<PrefetchedData>({})
  const isCompleteRef = useRef(false)
  
  // Handle completion
  const handleComplete = useCallback(() => {
    if (isCompleteRef.current) return
    isCompleteRef.current = true
    
    setIsFadingOut(true)
    setTimeout(() => {
      onComplete(prefetchedDataRef.current)
    }, 500)
  }, [onComplete])
  
  // Fallback timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isCompleteRef.current) {
        console.warn('Boot sequence timeout - forcing completion')
        handleComplete()
      }
    }, skipDelay)
    
    return () => clearTimeout(timeout)
  }, [skipDelay, handleComplete])
  
  // SSE Connection
  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/boot-sequence`)
    eventSourceRef.current = eventSource
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.error) {
          setError(data.error)
          // Still complete even on error
          setTimeout(handleComplete, 2000)
          return
        }
        
        // Update progress
        if (data.progress !== undefined) {
          setProgress(data.progress)
        }
        
        // Update message
        if (data.message) {
          setCurrentMessage(data.message)
        }
        
        // Update step status
        if (data.step) {
          setSteps(prev => prev.map(step => {
            if (step.id === data.step) {
              return {
                ...step,
                status: data.final ? 'complete' : 'running',
                message: data.message
              }
            }
            // Mark previous steps as complete
            const stepIndex = prev.findIndex(s => s.id === data.step)
            const currentIndex = prev.findIndex(s => s.id === step.id)
            if (currentIndex < stepIndex && step.status !== 'complete') {
              return { ...step, status: 'complete' }
            }
            return step
          }))
        }
        
        // Store prefetched data
        if (data.data) {
          if (data.step === 'db_connection') {
            prefetchedDataRef.current.health = data.data
          } else if (data.step === 'trips') {
            prefetchedDataRef.current.trips = data.data
          } else if (data.step === 'recent_trip') {
            prefetchedDataRef.current.recent_trip = data.data
          } else if (data.step === 'coverage') {
            prefetchedDataRef.current.coverage = data.data
          }
        }
        
        // Handle final prefetched data
        if (data.prefetched) {
          prefetchedDataRef.current = {
            ...prefetchedDataRef.current,
            ...data.prefetched
          }
        }
        
        // Handle completion
        if (data.final || data.step === 'complete') {
          // Mark all steps as complete
          setSteps(prev => prev.map(step => ({ ...step, status: 'complete' })))
          setProgress(100)
          
          setTimeout(() => {
            eventSource.close()
            handleComplete()
          }, 500)
        }
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }
    
    eventSource.onerror = () => {
      console.error('Boot sequence SSE error')
      eventSource.close()
      // Fallback: complete anyway
      handleComplete()
    }
    
    return () => {
      eventSource.close()
    }
  }, [handleComplete])

  return (
    <div 
      className={`
        fixed inset-0 z-[100] bg-cyber-black flex flex-col items-center justify-center
        transition-opacity duration-500
        ${isFadingOut ? 'opacity-0' : 'opacity-100'}
      `}
    >
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 247, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 247, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Logo */}
      <div className="mb-12 text-center">
        <div className="w-20 h-20 mx-auto mb-6 border-2 border-cyber-cyan rounded-xl flex items-center justify-center animate-pulse">
          <svg 
            className="w-12 h-12 text-cyber-cyan" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
        </div>
        <h1 className="text-2xl font-display font-bold text-cyber-cyan tracking-[0.3em] glow-text">
          NYC SURVEILLANCE
        </h1>
        <p className="text-xs text-cyber-cyan/50 tracking-[0.5em] mt-2">
          VEHICLE TRACKING SYSTEM
        </p>
      </div>

      {/* Boot steps */}
      <div className="w-96 space-y-2 mb-8">
        {steps.map((step) => (
          <div 
            key={step.id}
            className={`
              flex items-center gap-3 text-xs font-mono
              transition-all duration-300
              ${step.status === 'complete' ? 'opacity-50' : ''}
              ${step.status === 'pending' ? 'opacity-30' : ''}
              ${step.status === 'error' ? 'text-red-500' : ''}
            `}
          >
            {/* Status indicator */}
            <div className="w-4 flex justify-center">
              {step.status === 'complete' && (
                <span className="text-cyber-green">✓</span>
              )}
              {step.status === 'running' && (
                <span className="text-cyber-cyan animate-pulse">▶</span>
              )}
              {step.status === 'pending' && (
                <span className="text-cyber-cyan/30">○</span>
              )}
              {step.status === 'error' && (
                <span className="text-red-500">✕</span>
              )}
            </div>
            
            {/* Step text */}
            <span className={`
              flex-1
              ${step.status === 'running' ? 'text-cyber-cyan' : 'text-cyber-cyan/70'}
            `}>
              {step.status === 'running' ? (
                <TypeWriter text={step.message || step.text} speed={15} cursor={false} />
              ) : step.status === 'complete' && step.message ? (
                step.message
              ) : (
                step.text
              )}
            </span>
            
            {/* Completion indicator */}
            {step.status === 'complete' && (
              <span className="text-cyber-green/70">[OK]</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-96 h-1.5 bg-cyber-gray rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-xs text-cyber-cyan/50 mt-4 font-mono">
        {Math.round(progress)}% COMPLETE
      </p>
      
      {/* Current message */}
      {currentMessage && (
        <p className="text-xs text-cyber-cyan/30 mt-2 font-mono max-w-96 text-center truncate">
          {currentMessage}
        </p>
      )}
      
      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 mt-2 font-mono">
          ⚠ {error}
        </p>
      )}

      {/* Status hint */}
      <p className="absolute bottom-8 text-xs text-cyber-cyan/20 font-mono">
        {progress < 100 ? 'SYSTEM INITIALIZATION IN PROGRESS' : 'INITIALIZATION COMPLETE'}
      </p>
    </div>
  )
}
