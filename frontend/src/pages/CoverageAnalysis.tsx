/**
 * Coverage Analysis Page
 * Compares NYC official speed sign database with our YOLO detections
 */
import { useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useCoverageStore, useFilteredGeoJSON, CoverageGeoJSON, CoverageStats } from '../stores/coverageStore'
import { useTripStore } from '../stores/tripStore'
import { DataPanel, AnimatedNumber } from '../components/ui'

const API_BASE = '/api'

// Fetch coverage analysis from API
async function fetchCoverageAnalysis(matchRadius: number, clusterRadius: number): Promise<{
  geojson: CoverageGeoJSON
  stats: CoverageStats
}> {
  const res = await fetch(
    `${API_BASE}/coverage/analysis?radius=${matchRadius}&cluster_radius=${clusterRadius}`
  )
  if (!res.ok) throw new Error('Failed to fetch coverage analysis')
  return res.json()
}

export default function CoverageAnalysis() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  
  const {
    matchRadius,
    clusterRadius,
    filters,
    stats,
    isLoading,
    error,
    setAnalysisData,
    setMatchRadius,
    toggleFilter,
    setLoading,
    setError
  } = useCoverageStore()
  
  const filteredGeoJSON = useFilteredGeoJSON()
  const { setViewMode } = useTripStore()
  
  // Fetch analysis data
  const { data, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['coverage-analysis', matchRadius, clusterRadius],
    queryFn: () => fetchCoverageAnalysis(matchRadius, clusterRadius),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  })
  
  // Update store when data changes
  useEffect(() => {
    if (data) {
      setAnalysisData(data.geojson, data.stats)
    }
  }, [data, setAnalysisData])
  
  useEffect(() => {
    setLoading(queryLoading)
  }, [queryLoading, setLoading])
  
  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          }
        },
        layers: [{
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 19
        }]
      },
      center: [-73.95, 40.70],
      zoom: 11
    })
    
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    
    // Add sources and layers once map loads
    map.current.on('load', () => {
      if (!map.current) return
      
      // Add empty source for coverage points
      map.current.addSource('coverage-points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })
      
      // Undetected layer (red circles)
      map.current.addLayer({
        id: 'coverage-undetected',
        type: 'circle',
        source: 'coverage-points',
        filter: ['==', ['get', 'status'], 'undetected'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8
        }
      })
      
      // Matched layer (green circles)
      map.current.addLayer({
        id: 'coverage-matched',
        type: 'circle',
        source: 'coverage-points',
        filter: ['==', ['get', 'status'], 'matched'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#22c55e',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8
        }
      })
      
      // New findings layer (yellow stars - using circles for now)
      map.current.addLayer({
        id: 'coverage-new-findings',
        type: 'circle',
        source: 'coverage-points',
        filter: ['==', ['get', 'status'], 'new_finding'],
        paint: {
          'circle-radius': 7,
          'circle-color': '#eab308',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9
        }
      })
      
      // Add popups on click
      const layers = ['coverage-undetected', 'coverage-matched', 'coverage-new-findings']
      
      layers.forEach(layerId => {
        map.current!.on('click', layerId, (e) => {
          if (!e.features || e.features.length === 0) return
          
          const feature = e.features[0]
          const props = feature.properties
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
          
          let content = `<div class="p-2 font-mono text-xs">
            <div class="font-bold text-${props.status === 'matched' ? 'green' : props.status === 'undetected' ? 'red' : 'yellow'}-400 uppercase mb-1">
              ${props.status === 'matched' ? '✓ MATCHED' : props.status === 'undetected' ? '✗ UNDETECTED' : '★ NEW FINDING'}
            </div>`
          
          if (props.id) content += `<div>ID: ${props.id}</div>`
          if (props.sign_type) content += `<div>Type: ${props.sign_type}</div>`
          if (props.description) content += `<div class="text-[10px] text-gray-400 mt-1">${props.description.substring(0, 50)}...</div>`
          if (props.class_name) content += `<div>Class: ${props.class_name}</div>`
          if (props.confidence) content += `<div>Confidence: ${(props.confidence * 100).toFixed(1)}%</div>`
          if (props.match_distance) content += `<div>Match dist: ${props.match_distance.toFixed(1)}m</div>`
          
          content += `</div>`
          
          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(content)
            .addTo(map.current!)
        })
        
        map.current!.on('mouseenter', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer'
        })
        
        map.current!.on('mouseleave', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = ''
        })
      })
    })
    
    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])
  
  // Update map data when filtered GeoJSON changes
  useEffect(() => {
    if (!map.current || !filteredGeoJSON) return
    
    const source = map.current.getSource('coverage-points') as maplibregl.GeoJSONSource
    if (source) {
      source.setData(filteredGeoJSON as GeoJSON.FeatureCollection)
    }
  }, [filteredGeoJSON])
  
  // Handle radius change
  const handleRadiusChange = useCallback((value: number) => {
    setMatchRadius(value)
  }, [setMatchRadius])
  
  return (
    <div className="h-full flex bg-cyber-black">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-cyber-cyan/30 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-cyber-cyan/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyber-yellow rounded-full animate-pulse" />
              <h1 className="text-cyber-yellow font-mono text-sm tracking-wider">COVERAGE ANALYSIS</h1>
            </div>
            <button
              onClick={() => setViewMode('2d')}
              className="p-1.5 rounded border border-cyber-cyan/30 text-cyber-cyan/70 
                hover:border-cyber-cyan hover:text-cyber-cyan hover:bg-cyber-cyan/10
                transition-all duration-200"
              title="Back to Map"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-cyber-cyan/50 text-xs">NYC DB vs Our Detections</p>
        </div>
        
        {/* Stats Panel */}
        <div className="p-4 border-b border-cyber-cyan/30">
          <DataPanel title="STATISTICS" variant="cyan">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="cyber-spinner" />
              </div>
            ) : stats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-cyber-dark/50 p-2 rounded border border-cyber-cyan/20">
                    <div className="text-[10px] text-cyber-cyan/50 uppercase">NYC DB</div>
                    <div className="text-lg font-mono text-cyber-cyan">
                      <AnimatedNumber value={stats.total_nyc_signs} />
                    </div>
                  </div>
                  <div className="bg-cyber-dark/50 p-2 rounded border border-cyber-cyan/20">
                    <div className="text-[10px] text-cyber-cyan/50 uppercase">Our Detections</div>
                    <div className="text-lg font-mono text-cyber-cyan">
                      <AnimatedNumber value={stats.total_our_detections} />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-xs text-white">Matched</span>
                    </div>
                    <span className="font-mono text-green-500">{stats.matched}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-xs text-white">Undetected</span>
                    </div>
                    <span className="font-mono text-red-500">{stats.undetected}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-xs text-white">New Findings</span>
                    </div>
                    <span className="font-mono text-yellow-500">{stats.new_findings}</span>
                  </div>
                </div>
                
                <div className="mt-3 p-2 bg-cyber-cyan/10 rounded border border-cyber-cyan/30">
                  <div className="text-[10px] text-cyber-cyan/70 uppercase mb-1">Coverage Rate</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-mono text-cyber-cyan font-bold">
                      {stats.coverage_percent.toFixed(1)}%
                    </span>
                    <span className="text-xs text-cyber-cyan/50 mb-1">
                      ({stats.matched}/{stats.total_nyc_signs})
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-cyber-dark rounded overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-magenta transition-all duration-500"
                      style={{ width: `${stats.coverage_percent}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-cyber-cyan/30 text-sm">
                No data available
              </div>
            )}
          </DataPanel>
        </div>
        
        {/* Filters */}
        <div className="p-4 border-b border-cyber-cyan/30">
          <DataPanel title="FILTERS" variant="magenta">
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.showMatched}
                  onChange={() => toggleFilter('showMatched')}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                  ${filters.showMatched 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-green-500/50 group-hover:border-green-500'
                  }`}>
                  {filters.showMatched && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-white">Matched (NYC + Ours)</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.showUndetected}
                  onChange={() => toggleFilter('showUndetected')}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                  ${filters.showUndetected 
                    ? 'bg-red-500 border-red-500' 
                    : 'border-red-500/50 group-hover:border-red-500'
                  }`}>
                  {filters.showUndetected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-white">Undetected (NYC only)</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.showNewFindings}
                  onChange={() => toggleFilter('showNewFindings')}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                  ${filters.showNewFindings 
                    ? 'bg-yellow-500 border-yellow-500' 
                    : 'border-yellow-500/50 group-hover:border-yellow-500'
                  }`}>
                  {filters.showNewFindings && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-white">New Findings (Ours only)</span>
              </label>
            </div>
          </DataPanel>
        </div>
        
        {/* Parameters */}
        <div className="p-4 flex-1">
          <DataPanel title="PARAMETERS" variant="cyan">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-cyber-cyan/70">Match Radius</label>
                  <span className="text-xs font-mono text-cyber-cyan">{matchRadius}m</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={matchRadius}
                  onChange={(e) => handleRadiusChange(Number(e.target.value))}
                  className="w-full h-2 bg-cyber-dark rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:bg-cyber-cyan [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,247,0.5)]"
                />
                <div className="flex justify-between text-[10px] text-cyber-cyan/30 mt-1">
                  <span>10m</span>
                  <span>100m</span>
                </div>
              </div>
              
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-cyber-cyan/20 hover:bg-cyber-cyan/30 
                  border border-cyber-cyan/50 rounded text-cyber-cyan text-sm font-mono
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'ANALYZING...' : 'REFRESH ANALYSIS'}
              </button>
            </div>
          </DataPanel>
        </div>
        
        {/* Legend */}
        <div className="p-4 border-t border-cyber-cyan/30">
          <div className="text-[10px] text-cyber-cyan/50 uppercase mb-2">Legend</div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-white">Matched</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-white">Undetected</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-white">New</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-cyber-black/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <div className="cyber-spinner mb-4" />
              <div className="text-cyber-cyan font-mono text-sm">ANALYZING COVERAGE...</div>
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20
            bg-red-500/20 border border-red-500 rounded px-4 py-2 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}
        
        {/* Quick Stats Overlay */}
        {stats && !isLoading && (
          <div className="absolute bottom-4 right-4 z-10 glass-panel border border-cyber-cyan/30 rounded p-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-mono text-green-500 font-bold">{stats.matched}</div>
                <div className="text-[10px] text-green-500/70">MATCHED</div>
              </div>
              <div>
                <div className="text-lg font-mono text-red-500 font-bold">{stats.undetected}</div>
                <div className="text-[10px] text-red-500/70">MISSED</div>
              </div>
              <div>
                <div className="text-lg font-mono text-yellow-500 font-bold">{stats.new_findings}</div>
                <div className="text-[10px] text-yellow-500/70">NEW</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

