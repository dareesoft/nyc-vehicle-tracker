/**
 * Mobile Layout Component
 * Full-screen map with bottom sheet and tab navigation
 */

import { useState, useEffect } from 'react'
import { useTripStore, Device, Trip } from '../stores/tripStore'
import { useDevices, useTrips, useTripDetails, useScanStatus } from '../hooks/useTrip'
import { MobileHeader, BottomSheet, TabBar, MobileTimeline } from '../components/mobile'
import type { TabId } from '../components/mobile/TabBar'
import MapView from '../components/MapView'
import CameraViewer from '../components/CameraViewer'
import InfoPanel from '../components/InfoPanel'
import DetectionPanel from '../components/DetectionPanel'
import LoadingOverlay from '../components/LoadingOverlay'
import { ScanlineOverlay } from '../components/ui'

// Mobile-optimized sidebar content
function MobileDeviceSelector() {
  const { data: devices, isLoading } = useDevices()
  const { selectedDevice, setSelectedDevice, selectedTrip, setSelectedTrip } = useTripStore()
  const { data: trips } = useTrips(selectedDevice?.device_id || null)

  return (
    <div className="p-4 space-y-4">
      {/* Devices */}
      <div>
        <h3 className="text-xs text-cyber-cyan/50 font-mono mb-2 tracking-wider">DEVICES</h3>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="cyber-spinner w-6 h-6" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {devices?.map((device: Device) => (
              <button
                key={device.device_id}
                onClick={() => setSelectedDevice(device)}
                className={`
                  px-3 py-2 rounded border text-xs font-mono transition-all
                  ${selectedDevice?.device_id === device.device_id
                    ? 'border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan'
                    : 'border-cyber-cyan/30 text-cyber-cyan/70 hover:border-cyber-cyan/50'
                  }
                `}
              >
                {device.device_id}
                <span className="ml-1 opacity-50">({device.total_days}d)</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trips */}
      {selectedDevice && (
        <div>
          <h3 className="text-xs text-cyber-cyan/50 font-mono mb-2 tracking-wider">TRIPS</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {trips?.map((trip: Trip) => (
              <button
                key={trip.date}
                onClick={() => setSelectedTrip(trip)}
                className={`
                  w-full text-left px-3 py-2 rounded border text-sm font-mono transition-all
                  ${selectedTrip?.date === trip.date
                    ? 'border-cyber-magenta bg-cyber-magenta/20 text-white'
                    : 'border-cyber-cyan/20 text-cyber-cyan/70 hover:border-cyber-magenta/50'
                  }
                `}
              >
                <span>{trip.date}</span>
                <span className="float-right text-xs opacity-50">{trip.image_count} imgs</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MobileLayout() {
  const [activeTab, setActiveTab] = useState<TabId>('map')
  const [bottomSheetOpen, setBottomSheetOpen] = useState(true)
  const [infoTab, setInfoTab] = useState<'telemetry' | 'detection'>('telemetry')
  
  const { 
    selectedDevice, 
    selectedTrip, 
    setTripData,
  } = useTripStore()
  
  const { data: scanStatus } = useScanStatus()
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

  // Render bottom sheet content based on active tab
  const renderBottomSheetContent = () => {
    switch (activeTab) {
      case 'camera':
        return (
          <div className="h-full">
            <CameraViewer />
          </div>
        )
      case 'info':
        return (
          <div className="h-full flex flex-col">
            {/* Tab switcher */}
            <div className="flex border-b border-cyber-cyan/20">
              <button
                onClick={() => setInfoTab('telemetry')}
                className={`flex-1 py-2 text-xs font-mono transition-all
                  ${infoTab === 'telemetry'
                    ? 'bg-cyber-cyan/10 text-cyber-cyan border-b-2 border-cyber-cyan'
                    : 'text-cyber-cyan/50'
                  }`}
              >
                TELEMETRY
              </button>
              <button
                onClick={() => setInfoTab('detection')}
                className={`flex-1 py-2 text-xs font-mono transition-all
                  ${infoTab === 'detection'
                    ? 'bg-cyber-magenta/10 text-cyber-magenta border-b-2 border-cyber-magenta'
                    : 'text-cyber-magenta/50'
                  }`}
              >
                DETECTIONS
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {infoTab === 'telemetry' ? <InfoPanel /> : <DetectionPanel />}
            </div>
          </div>
        )
      case 'menu':
        return <MobileDeviceSelector />
      default:
        return null
    }
  }

  // Get bottom sheet header content
  const getBottomSheetHeader = () => {
    if (activeTab === 'map') {
      return (
        <div className="space-y-2">
          <MobileTimeline />
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-cyber-black overflow-hidden">
      {/* Scanline overlay */}
      <ScanlineOverlay opacity={0.02} speed="slow" />
      
      {/* Header */}
      <MobileHeader />
      
      {/* Main content area - Map is always visible */}
      <div className="flex-1 relative">
        <MapView />
        
        {/* Trip loading overlay */}
        {tripLoading && (
          <div className="absolute inset-0 bg-cyber-black/80 flex items-center justify-center z-20 backdrop-blur-sm">
            <div className="text-center">
              <div className="cyber-spinner mx-auto mb-3" />
              <p className="text-cyber-cyan font-mono text-sm">LOADING...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Sheet - Shows when not on map tab */}
      {activeTab !== 'map' && (
        <BottomSheet
          isOpen={bottomSheetOpen}
          onClose={() => {
            setBottomSheetOpen(false)
            setActiveTab('map')
          }}
          snapPoints={[0.4, 0.7, 0.9]}
          defaultSnapIndex={1}
          header={getBottomSheetHeader()}
        >
          {renderBottomSheetContent()}
        </BottomSheet>
      )}
      
      {/* Timeline on map tab */}
      {activeTab === 'map' && selectedTrip && (
        <div className="glass-panel border-t border-cyber-cyan/20 px-2 py-2">
          <MobileTimeline />
        </div>
      )}
      
      {/* Tab Bar */}
      <TabBar 
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab)
          if (tab !== 'map') {
            setBottomSheetOpen(true)
          }
        }}
      />
      
      {/* Initial scan overlay */}
      {isScanning && (
        <LoadingOverlay 
          progress={scanStatus?.current || 0}
          total={scanStatus?.total || 0}
          status={scanStatus?.status || 'scanning'}
        />
      )}
    </div>
  )
}

