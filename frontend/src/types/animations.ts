/**
 * Animation-related type definitions
 */

export interface AnimationConfig {
  duration: number
  delay?: number
  easing?: string
}

export interface StaggerConfig extends AnimationConfig {
  staggerDelay: number
  direction?: 'forward' | 'reverse'
}

export interface TypewriterConfig {
  speed: number
  delay?: number
  cursor?: boolean
}

export interface GlitchConfig {
  intensity: 'low' | 'medium' | 'high'
  duration: number
  trigger: 'hover' | 'always' | 'interval'
}

export interface CountUpConfig {
  duration: number
  delay?: number
  startValue?: number
  formatter?: (value: number) => string
}

export interface PulseConfig {
  interval: number
  scale?: number
  opacity?: [number, number]
}

// Animation state types
export interface AnimationState {
  isAnimating: boolean
  isComplete: boolean
  progress: number
}

// HUD element types
export interface HUDCornerConfig {
  size: 'sm' | 'md' | 'lg'
  color: 'cyan' | 'magenta' | 'yellow'
  animated: boolean
}

// Data panel types
export interface DataPanelConfig {
  variant: 'cyan' | 'magenta'
  radarSweep: boolean
  animated: boolean
}

// Boot sequence types
export interface BootStep {
  text: string
  duration: number
  status: 'pending' | 'running' | 'complete'
}

export interface BootSequenceState {
  currentStep: number
  progress: number
  isComplete: boolean
  isFadingOut: boolean
}

// Status indicator types
export type StatusType = 'active' | 'warning' | 'error' | 'idle' | 'processing'

export interface StatusConfig {
  color: string
  glow: string
  label: string
}

// Camera HUD types
export interface CameraHUDConfig {
  showCorners: boolean
  showTimestamp: boolean
  showCoordinates: boolean
  showZoom: boolean
  scanlines: boolean
}

// Map animation types
export interface RouteAnimationConfig {
  drawDuration: number
  dashArray: [number, number]
  pulseEnabled: boolean
}

// Timeline animation types
export interface TimelineAnimationConfig {
  progressGlow: boolean
  buttonPulse: boolean
  bufferVisualization: boolean
}

