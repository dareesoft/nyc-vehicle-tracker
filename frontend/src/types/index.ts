/**
 * Common Type Definitions
 * Centralized type definitions for the NYC Vehicle Tracker
 */

// ==================== Device & Trip Types ====================

/**
 * Device information from the backend
 */
export interface Device {
  device_id: string
  total_images: number
  total_days: number
  first_seen: string
  last_seen: string
}

/**
 * Trip information for a specific date
 */
export interface Trip {
  date: string
  image_count: number
  start_time: string
  end_time: string
  unique_links: number
}

/**
 * Selected trip reference
 */
export interface SelectedTrip {
  device_id: string
  date: string
}

// ==================== Image & Point Types ====================

/**
 * Individual image point with GPS and metadata
 */
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

/**
 * Statistics for a trip
 */
export interface TripStats {
  total_images: number
  unique_links: number
  start_time: string
  end_time: string
  bounds: GeoBounds
  center: GeoPoint
}

// ==================== Geo Types ====================

/**
 * Geographic point (latitude, longitude)
 */
export interface GeoPoint {
  latitude: number
  longitude: number
}

/**
 * Geographic bounding box
 */
export interface GeoBounds {
  north: number
  south: number
  east: number
  west: number
}

/**
 * Map view state for deck.gl
 */
export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
}

// ==================== Detection Types ====================

/**
 * YOLO detection result
 */
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

/**
 * Detection response from API
 */
export interface DetectionResponse {
  device_id: string
  date: string
  total: number
  detections: Detection[]
}

/**
 * Detection statistics
 */
export interface DetectionStats {
  by_class: Record<string, number>
  images_processed: number
  images_with_detections: number
  total_detections: number
}

// ==================== Combined Route Types ====================

/**
 * Combined routes for multi-trip overlay
 */
export interface CombinedRoute {
  type: string
  features: GeoJSONFeature[]
  trip_count: number
}

/**
 * Combined detections for multi-trip overlay
 */
export interface CombinedDetections {
  type: string
  features: GeoJSONFeature[]
  total: number
  trip_count: number
}

// ==================== GeoJSON Types ====================

/**
 * GeoJSON Feature
 */
export interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONGeometry
  properties: Record<string, any>
}

/**
 * GeoJSON Geometry
 */
export interface GeoJSONGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon'
  coordinates: any
}

/**
 * GeoJSON Feature Collection
 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// ==================== Notification Types ====================

/**
 * System notification
 */
export interface Notification {
  id: number
  type: 'new_trip' | 'detection_complete' | 'scan_complete' | 'error'
  device_id?: string
  date?: string
  message: string
  count: number
  read: boolean
  created_at: string
}

/**
 * Notification response from API
 */
export interface NotificationResponse {
  notifications: Notification[]
  unread_count: number
}

// ==================== Scan & Status Types ====================

/**
 * Scan status
 */
export interface ScanStatus {
  is_scanning: boolean
  current: number
  total: number
  status: string
}

/**
 * Detection status
 */
export interface DetectionStatus {
  is_detecting: boolean
  current: number
  total: number
  status: string
  yolo_available: boolean
}

/**
 * Scheduler status
 */
export interface SchedulerStatus {
  is_running: boolean
  next_run: string | null
  schedule: string
  timezone: string
}

/**
 * System statistics
 */
export interface SystemStats {
  total_images: number
  total_devices: number
  devices: Device[]
  data_root: string
  cache_status: 'ready' | 'scanning'
  detection_status: 'detecting' | 'ready'
  detection_stats: DetectionStats
}

// ==================== 3D Path Types ====================

/**
 * 3D path segment data
 */
export interface PathData {
  path: [number, number, number][]
  link_id: number | null
  forward: boolean
  color: [number, number, number, number]
  width: number
  start_time: string
  end_time: string
}

/**
 * 3D trip data response
 */
export interface Trip3DResponse {
  paths: PathData[]
  stats: TripStats
}

// ==================== UI State Types ====================

/**
 * View mode for map
 */
export type ViewMode = '2d' | '3d'

/**
 * Tab ID for mobile navigation
 */
export type MobileTabId = 'map' | 'camera' | 'info' | 'menu'

/**
 * Right panel tab in desktop view
 */
export type RightPanelTab = 'info' | 'detection'

// ==================== API Response Types ====================

/**
 * Generic API error response
 */
export interface APIError {
  detail: string
  status_code?: number
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  cache_size: number
}

// ==================== Utility Types ====================

/**
 * RGBA color array for deck.gl
 */
export type RGBAColor = [number, number, number, number]

/**
 * RGB color array
 */
export type RGBColor = [number, number, number]

/**
 * Coordinate pair [longitude, latitude]
 */
export type LngLat = [number, number]

/**
 * 3D coordinate [longitude, latitude, elevation]
 */
export type LngLatElevation = [number, number, number]

