/**
 * Media Query Hooks for Responsive Design
 * Provides hooks for detecting screen size and device type
 */

import { useState, useEffect } from 'react'

/**
 * Generic media query hook
 * @param query - CSS media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // SSR safety: return false if window is not defined
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(query)
    
    // Update state when media query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Set initial value
    setMatches(mediaQuery.matches)

    // Add listener (using modern API with fallback)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [query])

  return matches
}

// Breakpoint constants (matching Tailwind defaults)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

/**
 * Check if the current viewport is mobile-sized (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`)
}

/**
 * Check if the current viewport is tablet-sized (768px - 1023px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`)
}

/**
 * Check if the current viewport is desktop-sized (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`)
}

/**
 * Check if the device prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * Check if the device is in portrait orientation
 */
export function useIsPortrait(): boolean {
  return useMediaQuery('(orientation: portrait)')
}

/**
 * Check if the device is in landscape orientation
 */
export function useIsLandscape(): boolean {
  return useMediaQuery('(orientation: landscape)')
}

/**
 * Check if the device supports touch
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - msMaxTouchPoints for IE
      navigator.msMaxTouchPoints > 0
    )
  }, [])

  return isTouch
}

/**
 * Get current breakpoint name
 */
export function useBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
  const [breakpoint, setBreakpoint] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'>('xs')

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width >= BREAKPOINTS['2xl']) setBreakpoint('2xl')
      else if (width >= BREAKPOINTS.xl) setBreakpoint('xl')
      else if (width >= BREAKPOINTS.lg) setBreakpoint('lg')
      else if (width >= BREAKPOINTS.md) setBreakpoint('md')
      else if (width >= BREAKPOINTS.sm) setBreakpoint('sm')
      else setBreakpoint('xs')
    }

    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])

  return breakpoint
}

/**
 * Get window dimensions with SSR safety
 */
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return size
}

