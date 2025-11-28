import { useState, lazy, Suspense } from 'react'
import { useIsMobile } from './hooks/useMediaQuery'
import { BootSequence } from './components/ui'

// Lazy load layouts for code splitting
const DesktopLayout = lazy(() => import('./layouts/DesktopLayout'))
const MobileLayout = lazy(() => import('./layouts/MobileLayout'))

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

function App() {
  const [isBooting, setIsBooting] = useState(true)
  const isMobile = useIsMobile()

  // Handle boot sequence completion
  const handleBootComplete = () => {
    setIsBooting(false)
  }

  // Show boot sequence on initial load
  if (isBooting) {
    return <BootSequence onComplete={handleBootComplete} />
  }

  return (
    <Suspense fallback={<LayoutLoader />}>
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </Suspense>
  )
}

export default App
