import { useQuery } from '@tanstack/react-query'

const API_BASE = '/api'

// Fetch devices
export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/devices`)
      if (!res.ok) throw new Error('Failed to fetch devices')
      return res.json()
    },
  })
}

// Fetch trips for a device
export function useTrips(deviceId: string | null) {
  return useQuery({
    queryKey: ['trips', deviceId],
    queryFn: async () => {
      if (!deviceId) return []
      const res = await fetch(`${API_BASE}/trips/${deviceId}`)
      if (!res.ok) throw new Error('Failed to fetch trips')
      return res.json()
    },
    enabled: !!deviceId,
  })
}

// Fetch trip details
export function useTripDetails(deviceId: string | null, date: string | null) {
  return useQuery({
    queryKey: ['tripDetails', deviceId, date],
    queryFn: async () => {
      if (!deviceId || !date) return null
      const res = await fetch(`${API_BASE}/trip/${deviceId}/${date}`)
      if (!res.ok) throw new Error('Failed to fetch trip details')
      return res.json()
    },
    enabled: !!deviceId && !!date,
  })
}

// Fetch GeoJSON route
export function useTripGeoJSON(deviceId: string | null, date: string | null) {
  return useQuery({
    queryKey: ['tripGeoJSON', deviceId, date],
    queryFn: async () => {
      if (!deviceId || !date) return null
      const res = await fetch(`${API_BASE}/trip/${deviceId}/${date}/geojson`)
      if (!res.ok) throw new Error('Failed to fetch GeoJSON')
      return res.json()
    },
    enabled: !!deviceId && !!date,
  })
}

// Fetch 3D path data
export function useTrip3D(deviceId: string | null, date: string | null) {
  return useQuery({
    queryKey: ['trip3D', deviceId, date],
    queryFn: async () => {
      if (!deviceId || !date) return null
      const res = await fetch(`${API_BASE}/trip/${deviceId}/${date}/3d`)
      if (!res.ok) throw new Error('Failed to fetch 3D data')
      return res.json()
    },
    enabled: !!deviceId && !!date,
  })
}

// Fetch link network
export function useLinkNetwork() {
  return useQuery({
    queryKey: ['linkNetwork'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/links`)
      if (!res.ok) throw new Error('Failed to fetch link network')
      return res.json()
    },
  })
}

// Fetch system stats
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/stats`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })
}

// Fetch scan status
export function useScanStatus() {
  return useQuery({
    queryKey: ['scanStatus'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/scan/status`)
      if (!res.ok) throw new Error('Failed to fetch scan status')
      return res.json() as Promise<{ is_scanning: boolean; current: number; total: number; status: string }>
    },
    refetchInterval: (query) => {
      // Poll every 2 seconds while scanning
      return query.state.data?.is_scanning ? 2000 : false
    },
  })
}

// Helper to extract image path components
function parseFilePath(filePath: string): { deviceId: string; date: string; sequence: string; filename: string } | null {
  // Path format: .../101/{device_id}/{YYYYMMDD}/{seq}/origin/{filename}.jpg
  // or: .../{device_id}/{YYYYMMDD}/{seq}/origin/{filename}.jpg
  const parts = filePath.split('/')
  const originIdx = parts.findIndex(p => p === 'origin')
  
  if (originIdx >= 3) {
    return {
      deviceId: parts[originIdx - 3],
      date: parts[originIdx - 2],
      sequence: parts[originIdx - 1],
      filename: parts[originIdx + 1]
    }
  }
  return null
}

// Helper to build thumbnail URL (faster loading, ~50KB vs ~1MB)
export function getThumbnailUrl(point: { file_path: string; device_id?: string; sequence?: number }): string {
  const parsed = parseFilePath(point.file_path)
  
  if (parsed) {
    return `${API_BASE}/thumbnail/${parsed.deviceId}/${parsed.date}/${parsed.sequence}/${parsed.filename}`
  }
  
  // Fallback to original
  return `${API_BASE}/image-by-path?path=${encodeURIComponent(point.file_path)}`
}

// Helper to build original (full resolution) image URL
export function getOriginalImageUrl(point: { file_path: string }): string {
  return `${API_BASE}/image-by-path?path=${encodeURIComponent(point.file_path)}`
}

// Default: use thumbnail for performance (can override with getOriginalImageUrl for fullscreen)
export function getImageUrl(point: { file_path: string }, useThumbnail: boolean = true): string {
  if (useThumbnail) {
    return getThumbnailUrl(point)
  }
  return getOriginalImageUrl(point)
}

// Fetch detection status
export function useDetectionStatus() {
  return useQuery({
    queryKey: ['detectionStatus'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/detection/status`)
      if (!res.ok) throw new Error('Failed to fetch detection status')
      return res.json() as Promise<{
        is_detecting: boolean
        current: number
        total: number
        status: string
        yolo_available: boolean
      }>
    },
    refetchInterval: (query) => {
      return query.state.data?.is_detecting ? 2000 : false
    },
  })
}

// Fetch scheduler status
export function useSchedulerStatus() {
  return useQuery({
    queryKey: ['schedulerStatus'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/scheduler/status`)
      if (!res.ok) throw new Error('Failed to fetch scheduler status')
      return res.json()
    },
  })
}

// Detection types
export interface Detection {
  id: number
  image_id: number
  class_name: string
  confidence: number
  bbox_x1: number
  bbox_y1: number
  bbox_x2: number
  bbox_y2: number
  file_path: string
  latitude: number
  longitude: number
  timestamp: string
  link_id: number | null
}

export interface DetectionResponse {
  device_id: string
  date: string
  total: number
  detections: Detection[]
}

// Fetch detections for a trip
export function useDetections(deviceId: string | null, date: string | null) {
  return useQuery<DetectionResponse>({
    queryKey: ['detections', deviceId, date],
    queryFn: async () => {
      if (!deviceId || !date) return { device_id: '', date: '', total: 0, detections: [] }
      const res = await fetch(`${API_BASE}/detections/${deviceId}/${date}`)
      if (!res.ok) throw new Error('Failed to fetch detections')
      return res.json()
    },
    enabled: !!deviceId && !!date,
  })
}

// Fetch notifications
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/notifications`)
      if (!res.ok) throw new Error('Failed to fetch notifications')
      return res.json()
    },
    refetchInterval: 60000, // Refresh every minute
  })
}

// Convert detections to GeoJSON for map display
export function detectionToGeoJSON(detections: Detection[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: detections.map((det) => ({
      type: 'Feature',
      properties: {
        id: det.id,
        class_name: det.class_name,
        confidence: det.confidence,
        file_path: det.file_path,
        timestamp: det.timestamp,
        link_id: det.link_id,
      },
      geometry: {
        type: 'Point',
        coordinates: [det.longitude, det.latitude],
      },
    })),
  }
}

