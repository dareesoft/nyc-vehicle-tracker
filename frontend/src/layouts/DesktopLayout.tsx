/**
 * Desktop Layout Component
 * Three-column layout with sidebar, map, and right panel
 */

import { useEffect, useState } from 'react'
import { useTripStore } from '../stores/tripStore'
import { useDevices, useTrips, useTripDetails, useScanStatus } from '../hooks/useTrip'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import MapView from '../components/MapView'
import CameraViewer from '../components/CameraViewer'
import InfoPanel from '../components/InfoPanel'
import DetectionPanel from '../components/DetectionPanel'
import Timeline from '../components/Timeline'
import LoadingOverlay from '../components/LoadingOverlay'
import TripSelector from '../components/TripSelector'
import { ScanlineOverlay } from '../components/ui'

export default function DesktopLayout() {
  const [rightPanelTab, setRightPanelTab] = useState<'info' | 'detection'>('info')
  const { 
    selectedDevice, 
    selectedTrip, 
    setTripData,
    showTripSelector,
    setShowTripSelector,
    setCombinedRoutes,
    setCombinedDetections,
  } = useTripStore()
  
  const { data: scanStatus } = useScanStatus()
  const { data: devices, isLoading: devicesLoading } = useDevices()
  const { data: trips } = useTrips(selectedDevice?.device_id || null)
  const { data: tripDetails, isLoading: tripLoading } = useTripDetails(
    selectedDevice?.device_id || null,
    selectedTrip?.date || null
  )
  
  // Update trip data when loaded
  useEffect(() => {
    if (tripDetails) {
      setTripData(tripDetails.data, tripDetails.stats)
    }
  }, [tripDetails, setTripData])
  
  const isScanning = scanStatus?.is_scanning
  
  return (
    <div className="h-screen w-screen flex flex-col bg-cyber-black overflow-hidden">
      {/* Global scanline overlay */}
      <ScanlineOverlay opacity={0.02} speed="slow" />
      
      {/* Header */}
      <Header />
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Device & Trip selection */}
        <Sidebar 
          devices={devices || []} 
          trips={trips || []} 
          isLoading={devicesLoading}
        />
        
        {/* Center - Map view */}
        <div className="flex-1 relative">
          <MapView />
          
          {/* Loading overlay for trip data */}
          {tripLoading && (
            <div className="absolute inset-0 bg-cyber-black/80 flex items-center justify-center z-20 backdrop-blur-sm">
              <div className="text-center animate-fade-slide-in">
                <div className="cyber-spinner mx-auto mb-4" />
                <p className="text-cyber-cyan font-mono text-sm tracking-wider">LOADING TRIP DATA...</p>
                <p className="text-cyber-cyan/30 font-mono text-xs mt-2">Parsing telemetry</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right panel - Camera & Info/Detection */}
        <div className="w-96 flex flex-col border-l border-cyber-cyan/20 bg-cyber-dark/30">
          <CameraViewer />
          
          {/* Tab buttons for Info/Detection */}
          <div className="flex border-b border-cyber-cyan/20">
            <button
              onClick={() => setRightPanelTab('info')}
              className={`
                flex-1 py-2 text-xs font-mono tracking-wider transition-all
                ${rightPanelTab === 'info'
                  ? 'bg-cyber-cyan/10 text-cyber-cyan border-b-2 border-cyber-cyan'
                  : 'text-cyber-cyan/50 hover:text-cyber-cyan hover:bg-cyber-cyan/5'
                }
              `}
            >
              TELEMETRY
            </button>
            <button
              onClick={() => setRightPanelTab('detection')}
              className={`
                flex-1 py-2 text-xs font-mono tracking-wider transition-all
                ${rightPanelTab === 'detection'
                  ? 'bg-cyber-magenta/10 text-cyber-magenta border-b-2 border-cyber-magenta'
                  : 'text-cyber-magenta/50 hover:text-cyber-magenta hover:bg-cyber-magenta/5'
                }
              `}
            >
              DETECTIONS
            </button>
          </div>
          
          {/* Tab content - min-h-0 allows flex children to shrink and scroll */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightPanelTab === 'info' ? <InfoPanel /> : <DetectionPanel />}
          </div>
        </div>
      </div>
      
      {/* Bottom timeline */}
      <Timeline />
      
      {/* Initial scan overlay */}
      {isScanning && (
        <LoadingOverlay 
          progress={scanStatus?.current || 0}
          total={scanStatus?.total || 0}
          status={scanStatus?.status || 'scanning'}
        />
      )}
      
      {/* Multi-Trip Selector Modal */}
      <TripSelector 
        devices={devices || []}
        onRoutesChange={setCombinedRoutes}
        onDetectionsChange={setCombinedDetections}
        isOpen={showTripSelector}
        onClose={() => setShowTripSelector(false)}
      />
    </div>
  )
}

