/**
 * Map3D Utility Functions
 * Geometry calculations and helper functions for 3D map visualization
 */

/**
 * Calculate bearing (compass heading) from point A to point B
 * Returns 0-360 degrees: 0=North, 90=East, 180=South, 270=West
 */
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI

  const dLng = toRad(to.lng - from.lng)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  
  const bearing = toDeg(Math.atan2(y, x))
  return (bearing + 360) % 360
}

/**
 * Smooth bearing interpolation (handles wraparound at 0/360)
 */
export function interpolateBearing(from: number, to: number, t: number): number {
  let diff = to - from
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return (from + diff * t + 360) % 360
}

/**
 * Position history for stable heading calculation
 */
export interface PositionRecord {
  lat: number
  lng: number
  index: number
}

/**
 * Calculate distance between two points in meters
 */
export function calculateDistance(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dx = (to.lng - from.lng) * Math.cos((from.lat + to.lat) / 2 * Math.PI / 180)
  const dy = to.lat - from.lat
  return Math.sqrt(dx * dx + dy * dy) * 111000 // Approximate meters
}

/**
 * Parse hex color to RGBA array
 */
export function hexToRgba(hex: string, alpha: number = 255): [number, number, number, number] {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.slice(0, 2), 16)
  const g = parseInt(cleanHex.slice(2, 4), 16)
  const b = parseInt(cleanHex.slice(4, 6), 16)
  return [r, g, b, alpha]
}

/**
 * Dark map style for 3D view
 */
export const MAP_STYLE = {
  version: 8 as const,
  name: 'Cyberpunk Dark 3D',
  sources: {
    'osm-tiles': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster' as const,
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
}

/**
 * Path segment data structure
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
 * View state for deck.gl
 */
export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
}

