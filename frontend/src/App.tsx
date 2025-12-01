import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from './hooks/useMediaQuery'
import { useAuth } from './hooks/useAuth'
import { useTripStore } from './stores/tripStore'
import { BootSequence, type PrefetchedData } from './components/ui'

// Lazy load layouts and pages for code splitting
const DesktopLayout = lazy(() => import('./layouts/DesktopLayout'))
const MobileLayout = lazy(() => import('./layouts/MobileLayout'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const CoverageAnalysis = lazy(() => import('./pages/CoverageAnalysis'))

// Loading fallback component
function LayoutLoader() {
  return (
    <div className="h-screen w-screen bg-cyber-black flex items-center justify-center">
      <div className="text-center">
        <div className="cyber-spinner mx-auto mb-4" />
        <p className="text-cyber-cyan font-mono text-sm tracking-wider animate-pulse">
          LOADING INTERFACE...
        </p>
      </div>
    </div>
  )
}

// Auth loading screen
function AuthLoader() {
  return (
    <div className="h-screen w-screen bg-cyber-black flex items-center justify-center">
      <div className="text-center">
        <div className="cyber-spinner mx-auto mb-4" />
        <p className="text-cyber-cyan font-mono text-sm tracking-wider animate-pulse">
          VERIFYING CREDENTIALS...
        </p>
      </div>
    </div>
  )
}

function App() {
  const [showBoot, setShowBoot] = useState(false)
  const [bootComplete, setBootComplete] = useState(false)
  const isMobile = useIsMobile()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { viewMode } = useTripStore()
  const queryClient = useQueryClient()
  
  // Track previous auth state to detect login
  const wasAuthenticated = useRef(isAuthenticated)
  const hasShownInitialBoot = useRef(false)

  // Detect when user just logged in
  useEffect(() => {
    // User just logged in (was not authenticated, now is)
    if (!wasAuthenticated.current && isAuthenticated && !isAuthLoading) {
      setShowBoot(true)
      setBootComplete(false)
    }
    wasAuthenticated.current = isAuthenticated
  }, [isAuthenticated, isAuthLoading])

  // Show initial boot sequence for already authenticated users (on page load)
  useEffect(() => {
    if (isAuthenticated && !isAuthLoading && !hasShownInitialBoot.current) {
      hasShownInitialBoot.current = true
      setShowBoot(true)
    }
  }, [isAuthenticated, isAuthLoading])

  // Handle boot sequence completion - store prefetched data in React Query cache
  const handleBootComplete = useCallback((prefetchedData?: PrefetchedData) => {
    if (prefetchedData) {
      // Store health/status data
      if (prefetchedData.health) {
        queryClient.setQueryData(['health'], prefetchedData.health)
      }
      
      // Store trips list
      if (prefetchedData.trips) {
        queryClient.setQueryData(['trips'], prefetchedData.trips)
      }
      
      // Store recent trip details
      if (prefetchedData.recent_trip) {
        const { device_id, date } = prefetchedData.recent_trip
        queryClient.setQueryData(['trip', device_id, date], prefetchedData.recent_trip)
      }
      
      // Store coverage analysis data
      if (prefetchedData.coverage) {
        queryClient.setQueryData(['coverage-analysis', 50, 30, 'greedy_nearest'], prefetchedData.coverage)
      }
      
      console.log('[Boot] Prefetched data cached:', Object.keys(prefetchedData))
    }
    
    setShowBoot(false)
    setBootComplete(true)
  }, [queryClient])

  // Show auth loading while verifying token
  if (isAuthLoading) {
    return <AuthLoader />
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<AuthLoader />}>
        <LoginPage />
      </Suspense>
    )
  }

  // Show boot sequence after login or on initial load
  if (showBoot && !bootComplete) {
    return <BootSequence onComplete={handleBootComplete} />
  }

  // Show main application
  // Coverage mode is full-screen (no sidebar/panels)
  if (viewMode === 'coverage') {
    return (
      <Suspense fallback={<LayoutLoader />}>
        <CoverageAnalysis />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<LayoutLoader />}>
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </Suspense>
  )
}

export default App
