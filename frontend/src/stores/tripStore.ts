import { create } from 'zustand'

export interface ImagePoint {
  id: number
  file_path: string
  device_id: string
  camera_type: string
  latitude: number
  longitude: number
  timestamp: string
  link_id: number | null
  forward: boolean | null
  sequence: number
}

export interface TripStats {
  total_images: number
  unique_links: number
  start_time: string
  end_time: string
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  center: {
    latitude: number
    longitude: number
  }
}

export interface Device {
  device_id: string
  total_images: number
  total_days: number
  first_seen: string
  last_seen: string
}

export interface Trip {
  date: string
  image_count: number
  start_time: string
  end_time: string
  unique_links: number
}

export interface SelectedTrip {
  device_id: string
  date: string
}

export interface CombinedRoute {
  type: string
  features: any[]
  trip_count: number
}

export interface CombinedDetections {
  type: string
  features: any[]
  total: number
  trip_count: number
}

interface TripState {
  // Selected data
  selectedDevice: Device | null
  selectedTrip: Trip | null
  tripData: ImagePoint[]
  tripStats: TripStats | null
  
  // Multi-trip selection for overlay
  selectedTrips: SelectedTrip[]
  combinedRoutes: CombinedRoute | null
  combinedDetections: CombinedDetections | null
  showTripSelector: boolean
  
  // Detection layer toggle
  showDetectionLayer: boolean
  
  // Playback state
  currentIndex: number
  isPlaying: boolean
  playbackSpeed: number
  
  // View state
  viewMode: '2d' | '3d'
  
  // Map state
  mapCenter: [number, number]
  mapZoom: number
  followVehicle: boolean
  
  // Actions
  setSelectedDevice: (device: Device | null) => void
  setSelectedTrip: (trip: Trip | null) => void
  setTripData: (data: ImagePoint[], stats: TripStats | null) => void
  setCurrentIndex: (index: number) => void
  setIsPlaying: (playing: boolean) => void
  setPlaybackSpeed: (speed: number) => void
  setViewMode: (mode: '2d' | '3d') => void
  setMapCenter: (center: [number, number]) => void
  setMapZoom: (zoom: number) => void
  setFollowVehicle: (follow: boolean) => void
  
  // Multi-trip actions
  toggleTripSelection: (device_id: string, date: string) => void
  clearSelectedTrips: () => void
  setCombinedRoutes: (routes: CombinedRoute | null) => void
  setCombinedDetections: (detections: CombinedDetections | null) => void
  setShowTripSelector: (show: boolean) => void
  
  // Detection layer toggle
  setShowDetectionLayer: (show: boolean) => void
  
  // Playback controls
  nextFrame: () => void
  prevFrame: () => void
  jumpToFrame: (index: number) => void
  
  // Computed
  getCurrentPoint: () => ImagePoint | null
  getFilteredData: () => ImagePoint[]
}

export const useTripStore = create<TripState>((set, get) => ({
  // Initial state
  selectedDevice: null,
  selectedTrip: null,
  tripData: [],
  tripStats: null,
  selectedTrips: [],
  combinedRoutes: null,
  combinedDetections: null,
  showTripSelector: false,
  showDetectionLayer: true,  // Default to showing detections
  currentIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  viewMode: '2d',
  mapCenter: [-73.85, 40.76], // Default to NYC
  mapZoom: 12,
  followVehicle: true,
  
  // Actions
  setSelectedDevice: (device) => set({ 
    selectedDevice: device, 
    selectedTrip: null, 
    tripData: [], 
    tripStats: null,
    currentIndex: 0,
    isPlaying: false 
  }),
  
  setSelectedTrip: (trip) => set({ 
    selectedTrip: trip, 
    currentIndex: 0,
    isPlaying: false 
  }),
  
  setTripData: (data, stats) => {
    set({ 
      tripData: data, 
      tripStats: stats,
      currentIndex: 0,
      isPlaying: false
    })
    
    // Update map center if we have data
    if (stats?.center) {
      set({
        mapCenter: [stats.center.longitude, stats.center.latitude],
        mapZoom: 14
      })
    }
  },
  
  setCurrentIndex: (index) => {
    const state = get()
    const data = state.tripData
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1))
    
    set({ currentIndex: clampedIndex })
    
    // Update map center if following vehicle
    if (state.followVehicle && data[clampedIndex]) {
      const point = data[clampedIndex]
      set({ mapCenter: [point.longitude, point.latitude] })
    }
  },
  
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setFollowVehicle: (follow) => set({ followVehicle: follow }),
  
  // Multi-trip actions
  toggleTripSelection: (device_id, date) => {
    const { selectedTrips } = get()
    const exists = selectedTrips.some(t => t.device_id === device_id && t.date === date)
    if (exists) {
      set({ selectedTrips: selectedTrips.filter(t => !(t.device_id === device_id && t.date === date)) })
    } else {
      set({ selectedTrips: [...selectedTrips, { device_id, date }] })
    }
  },
  clearSelectedTrips: () => set({ selectedTrips: [], combinedRoutes: null, combinedDetections: null }),
  setCombinedRoutes: (routes) => set({ combinedRoutes: routes }),
  setCombinedDetections: (detections) => set({ combinedDetections: detections }),
  setShowTripSelector: (show) => set({ showTripSelector: show }),
  setShowDetectionLayer: (show) => set({ showDetectionLayer: show }),
  
  // Playback controls
  nextFrame: () => {
    const state = get()
    if (state.currentIndex < state.tripData.length - 1) {
      state.setCurrentIndex(state.currentIndex + 1)
    } else {
      set({ isPlaying: false })
    }
  },
  
  prevFrame: () => {
    const state = get()
    if (state.currentIndex > 0) {
      state.setCurrentIndex(state.currentIndex - 1)
    }
  },
  
  jumpToFrame: (index) => {
    get().setCurrentIndex(index)
  },
  
  // Computed
  getCurrentPoint: () => {
    const state = get()
    return state.tripData[state.currentIndex] || null
  },
  
  // Returns all trip data (no camera filtering)
  getFilteredData: () => {
    return get().tripData
  },
}))

