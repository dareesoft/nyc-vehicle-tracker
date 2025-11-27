/**
 * Centralized theme configuration for the NYC Vehicle Surveillance System
 */

export const THEME_COLORS = {
  cyber: {
    black: '#0a0a0f',
    dark: '#12121a',
    gray: '#1a1a2e',
    cyan: '#00fff7',
    magenta: '#ff00ff',
    yellow: '#ffff00',
    green: '#00ff88',
    orange: '#ff8800',
    purple: '#8800ff',
  }
} as const

export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
  verySlow: 1000,
  
  // Specific animations
  countUp: 1500,
  typewriter: 50, // per character
  stagger: 100,
  glitch: 200,
  fadeIn: 400,
  slideIn: 500,
  bootSequence: 3500,
} as const

export const ANIMATION_EASINGS = {
  easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  linear: 'linear',
} as const

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  scanline: 50,
  tooltip: 60,
  boot: 100,
} as const

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

// Component-specific configs
export const BOOT_SEQUENCE_CONFIG = {
  steps: [
    { text: 'INITIALIZING SURVEILLANCE NETWORK', duration: 800 },
    { text: 'ESTABLISHING DATABASE CONNECTION', duration: 600 },
    { text: 'LOADING VEHICLE TELEMETRY', duration: 700 },
    { text: 'CALIBRATING GPS MODULES', duration: 500 },
    { text: 'ACTIVATING CAMERA FEEDS', duration: 600 },
    { text: 'SYSTEM READY', duration: 400 },
  ],
  skipDelay: 5000,
} as const

export const HUD_CONFIG = {
  cornerSize: {
    sm: 12,
    md: 20,
    lg: 32,
  },
  borderWidth: 2,
  animationDelay: 100,
} as const

export const MAP_CONFIG = {
  defaultCenter: [-73.935242, 40.730610] as [number, number], // NYC
  defaultZoom: 12,
  flyToDuration: 500,
  routeColor: '#00fff7',
  routeWidth: 3,
  pulseRadius: 50,
} as const

export const PLAYBACK_CONFIG = {
  speeds: [0.5, 1, 2, 4],
  defaultSpeed: 1,
  preloadBuffer: 50,
  updateInterval: 500,
} as const

// Utility type for extracting theme values
export type ThemeColor = keyof typeof THEME_COLORS.cyber
export type AnimationDuration = keyof typeof ANIMATION_DURATIONS
export type AnimationEasing = keyof typeof ANIMATION_EASINGS

