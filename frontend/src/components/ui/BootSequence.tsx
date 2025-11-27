import { useEffect, useState } from 'react'
import TypeWriter from './TypeWriter'

interface BootSequenceProps {
  onComplete: () => void
  skipDelay?: number
}

interface BootStep {
  text: string
  duration: number
  status: 'pending' | 'running' | 'complete'
}

const bootSteps: BootStep[] = [
  { text: 'INITIALIZING SURVEILLANCE NETWORK', duration: 800, status: 'pending' },
  { text: 'ESTABLISHING DATABASE CONNECTION', duration: 600, status: 'pending' },
  { text: 'LOADING VEHICLE TELEMETRY', duration: 700, status: 'pending' },
  { text: 'CALIBRATING GPS MODULES', duration: 500, status: 'pending' },
  { text: 'ACTIVATING CAMERA FEEDS', duration: 600, status: 'pending' },
  { text: 'SYSTEM READY', duration: 400, status: 'pending' }
]

export default function BootSequence({ onComplete, skipDelay = 5000 }: BootSequenceProps) {
  const [steps, setSteps] = useState(bootSteps)
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    // Allow skipping after delay
    const skipTimeout = setTimeout(() => {
      // Auto-complete if taking too long
    }, skipDelay)

    return () => clearTimeout(skipTimeout)
  }, [skipDelay])

  useEffect(() => {
    if (currentStep >= steps.length) {
      // All steps complete - set progress to 100% first
      setProgress(100)
      // Then fade out
      setTimeout(() => {
        setIsFadingOut(true)
        setTimeout(onComplete, 500)
      }, 300)
      return
    }

    // Update current step to running
    setSteps(prev => prev.map((step, i) => ({
      ...step,
      status: i === currentStep ? 'running' : i < currentStep ? 'complete' : 'pending'
    })))

    // Progress animation - ensure we reach 100% on last step
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        // For the last step, target 100%
        const isLastStep = currentStep === steps.length - 1
        const target = isLastStep ? 100 : ((currentStep + 1) / steps.length) * 100
        const step = (target - prev) / 10
        return Math.min(prev + step, target)
      })
    }, 50)

    // Move to next step
    const stepTimeout = setTimeout(() => {
      setSteps(prev => prev.map((step, i) => ({
        ...step,
        status: i === currentStep ? 'complete' : step.status
      })))
      setCurrentStep(prev => prev + 1)
    }, steps[currentStep].duration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(stepTimeout)
    }
  }, [currentStep, steps.length, onComplete])

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
        {steps.map((step, index) => (
          <div 
            key={index}
            className={`
              flex items-center gap-3 text-xs font-mono
              transition-all duration-300
              ${step.status === 'complete' ? 'opacity-50' : ''}
              ${step.status === 'pending' ? 'opacity-30' : ''}
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
            </div>
            
            {/* Step text */}
            <span className={`
              flex-1
              ${step.status === 'running' ? 'text-cyber-cyan' : 'text-cyber-cyan/70'}
            `}>
              {step.status === 'running' ? (
                <TypeWriter text={step.text} speed={20} cursor={false} />
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
      <div className="w-96 h-1 bg-cyber-gray rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-xs text-cyber-cyan/30 mt-4 font-mono">
        {Math.round(progress)}% COMPLETE
      </p>

      {/* Skip hint */}
      <p className="absolute bottom-8 text-xs text-cyber-cyan/20 font-mono">
        SYSTEM INITIALIZATION IN PROGRESS
      </p>
    </div>
  )
}

