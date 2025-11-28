import { Suspense, lazy } from 'react'
import { useTripStore } from '../stores/tripStore'
import { MapErrorBoundary } from './ErrorBoundary'

// Lazy load map components for better code splitting
const Map2D = lazy(() => import('./Map2D'))
const Map3D = lazy(() => import('./Map3D'))

// Loading fallback for map
function MapLoader() {
  return (
    <div className="absolute inset-0 bg-cyber-dark flex items-center justify-center">
      <div className="text-center">
        <div className="cyber-spinner mx-auto mb-4" />
        <p className="text-cyber-cyan font-mono text-sm tracking-wider animate-pulse">
          LOADING MAP...
        </p>
      </div>
    </div>
  )
}

export default function MapView() {
  const { viewMode } = useTripStore()
  
  return (
    <div className="absolute inset-0">
      <MapErrorBoundary>
        <Suspense fallback={<MapLoader />}>
          {viewMode === '2d' ? <Map2D /> : <Map3D />}
        </Suspense>
      </MapErrorBoundary>
    </div>
  )
}
