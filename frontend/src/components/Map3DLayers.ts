/**
 * Map3D Layer Factories
 * Creates deck.gl layers for 3D map visualization
 */

import { PathLayer, ScatterplotLayer, TextLayer, ColumnLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { hexToRgba, PathData } from './Map3DUtils'
import type { ImagePoint } from '../stores/tripStore'

/**
 * Create path layer for 3D route segments
 */
export function createPathLayer(
  paths: PathData[],
  onHover: (info: PickingInfo) => void
) {
  return new PathLayer<PathData>({
    id: 'path-layer',
    data: paths,
    getPath: (d: PathData) => d.path,
    getColor: (d: PathData) => d.color,
    getWidth: (d: PathData) => d.width,
    widthMinPixels: 2,
    widthMaxPixels: 10,
    jointRounded: true,
    capRounded: true,
    pickable: true,
    onHover,
  })
}

/**
 * Create glow path layer (wider, transparent for glow effect)
 */
export function createGlowPathLayer(paths: PathData[]) {
  return new PathLayer<PathData>({
    id: 'glow-path-layer',
    data: paths,
    getPath: (d: PathData) => d.path,
    getColor: (d: PathData) => [...d.color.slice(0, 3), 80] as [number, number, number, number],
    getWidth: (d: PathData) => d.width * 3,
    widthMinPixels: 6,
    widthMaxPixels: 30,
    jointRounded: true,
    capRounded: true,
  })
}

/**
 * Create scatter plot layer for points
 */
export function createPointsLayer(
  data: ImagePoint[],
  currentIndex: number,
  onPointClick: (index: number) => void
) {
  return new ScatterplotLayer({
    id: 'points-layer',
    data,
    getPosition: (d) => [d.longitude, d.latitude, 10],
    getRadius: (_d, { index }) => index === currentIndex ? 15 : 5,
    getFillColor: (d, { index }) => {
      if (index === currentIndex) return [0, 255, 247, 255]
      return d.camera_type === '101' ? [0, 255, 247, 150] : [255, 0, 255, 150]
    },
    pickable: true,
    onClick: (info) => {
      if (info.index !== undefined) {
        onPointClick(info.index)
      }
    },
  })
}

/**
 * Create current position highlight layer
 */
export function createCurrentPositionLayer(currentPoint: ImagePoint) {
  return new ScatterplotLayer({
    id: 'current-position',
    data: [currentPoint],
    getPosition: (d) => [d.longitude, d.latitude, 20],
    getRadius: 25,
    getFillColor: [0, 255, 247, 100],
    stroked: true,
    getLineColor: [0, 255, 247, 255],
    lineWidthMinPixels: 2,
  })
}

/**
 * Create link ID labels layer
 */
export function createLabelsLayer(paths: PathData[]) {
  const labelData = paths
    .filter((p: PathData) => p.link_id && p.path.length > 0)
    .map((p: PathData) => ({
      position: p.path[Math.floor(p.path.length / 2)],
      text: `${p.link_id}`,
      link_id: p.link_id,
    }))

  return new TextLayer({
    id: 'labels-layer',
    data: labelData,
    getPosition: (d) => d.position,
    getText: (d) => d.text,
    getSize: 12,
    getColor: [255, 255, 255, 200],
    getAngle: 0,
    billboard: true,
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 'bold',
  })
}

/**
 * Create combined routes layer for multi-trip overlay
 */
export function createCombinedRoutesLayer(combinedRoutes: { features: any[] }) {
  const routeFeatures = combinedRoutes.features.filter(
    (f: any) => f.properties?.type === 'route'
  )

  if (routeFeatures.length === 0) return null

  const pathData = routeFeatures.map((f: any, i: number) => ({
    path: f.geometry.coordinates,
    color: f.properties?.trip_color || '#00fff7',
    tripIndex: f.properties?.trip_index || i,
  }))

  return new PathLayer({
    id: 'combined-routes-layer',
    data: pathData,
    getPath: (d) => d.path,
    getColor: (d) => hexToRgba(d.color, 200),
    getWidth: 5,
    widthMinPixels: 3,
    capRounded: true,
    jointRounded: true,
  })
}

interface DetectionPin {
  id: number
  coordinates: [number, number]
  color: [number, number, number]
}

/**
 * Create detection pins layer (3D columns for speed sign detections)
 */
export function createDetectionPinsLayer(
  combinedDetections: { features: any[]; total: number } | null,
  detectionsData: { detections: any[] } | null
): ColumnLayer<DetectionPin> | null {
  const PIN_HEIGHT = 20 // 20m height

  let processedData: DetectionPin[] = []

  if (combinedDetections?.features && combinedDetections.features.length > 0) {
    // Multi-trip overlay
    processedData = combinedDetections.features.map((f: any) => {
      const [r, g, b] = hexToRgba(f.properties?.trip_color || '#ff00ff')
      return {
        id: f.properties?.id,
        coordinates: f.geometry.coordinates as [number, number],
        color: [r, g, b] as [number, number, number],
      }
    })
  } else if (detectionsData?.detections && detectionsData.detections.length > 0) {
    // Single trip
    processedData = detectionsData.detections.map((d) => ({
      id: d.id,
      coordinates: [d.longitude, d.latitude] as [number, number],
      color: [255, 0, 255] as [number, number, number], // Magenta
    }))
  }

  if (processedData.length === 0) return null

  return new ColumnLayer<DetectionPin>({
    id: 'detection-pins-layer',
    data: processedData,
    diskResolution: 5,
    radius: 1, // 1m radius
    elevationScale: 1,
    extruded: true,
    getPosition: (d) => d.coordinates,
    getElevation: PIN_HEIGHT,
    getFillColor: [255, 255, 255, 255], // White
    getLineColor: [200, 200, 200, 255],
    lineWidthMinPixels: 2,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 150],
  })
}

