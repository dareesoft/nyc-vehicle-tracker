/**
 * Coverage Analysis Store
 * Manages state for NYC speed sign coverage analysis
 */
import { create } from 'zustand'

// Types
export interface NYCSign {
  id: string
  sign_code: string
  description: string
  sign_type: string
  speed_limit: number | null
  longitude: number
  latitude: number
}

export interface CoveragePoint {
  id?: string
  latitude: number
  longitude: number
  status: 'matched' | 'undetected' | 'new_finding'
  sign_type?: string
  description?: string
  class_name?: string
  confidence?: number
  match_distance?: number
  color: string
}

export interface CoverageStats {
  total_nyc_signs: number
  total_our_detections: number
  matched: number
  undetected: number
  new_findings: number
  coverage_percent: number
  algorithm?: string
  summary: {
    nyc_coverage: string
    potential_new: string
  }
}

// Supported matching algorithms
export type MatchingAlgorithm = 'greedy_nearest' | 'hungarian' | 'mutual_nearest'

export const ALGORITHM_INFO: Record<MatchingAlgorithm, { name: string, description: string }> = {
  greedy_nearest: {
    name: 'Greedy Nearest',
    description: 'Fast greedy matching. Each NYC sign finds closest unused detection.'
  },
  hungarian: {
    name: 'Hungarian (Optimal)',
    description: 'Globally optimal 1:1 matching. Slower but guarantees best total match.'
  },
  mutual_nearest: {
    name: 'Mutual Nearest',
    description: 'Conservative matching. Only matches when both sides agree on nearest.'
  }
}

export interface CoverageFilters {
  showMatched: boolean
  showUndetected: boolean
  showNewFindings: boolean
}

// Progress state for SSE streaming
export interface ProgressState {
  step: string
  progress: number
  message: string
}

export interface CoverageGeoJSON {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: {
      type: 'Point'
      coordinates: [number, number]
    }
    properties: {
      id?: string
      status: string
      sign_type?: string
      description?: string
      class_name?: string
      confidence?: number
      match_distance?: number
      color: string
    }
  }>
}

interface CoverageState {
  // Data
  analysisGeoJSON: CoverageGeoJSON | null
  stats: CoverageStats | null
  
  // Parameters
  matchRadius: number
  clusterRadius: number
  algorithm: MatchingAlgorithm
  
  // Filters
  filters: CoverageFilters
  
  // Loading state
  isLoading: boolean
  error: string | null
  
  // Progress state for SSE
  progressState: ProgressState | null
  
  // Actions
  setAnalysisData: (geojson: CoverageGeoJSON, stats: CoverageStats) => void
  setMatchRadius: (radius: number) => void
  setClusterRadius: (radius: number) => void
  setAlgorithm: (algorithm: MatchingAlgorithm) => void
  setFilters: (filters: Partial<CoverageFilters>) => void
  toggleFilter: (filter: keyof CoverageFilters) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setProgress: (progress: ProgressState | null) => void
  reset: () => void
}

const initialState = {
  analysisGeoJSON: null,
  stats: null,
  matchRadius: 50,
  clusterRadius: 30,
  algorithm: 'greedy_nearest' as MatchingAlgorithm,
  filters: {
    showMatched: true,
    showUndetected: true,
    showNewFindings: true
  },
  isLoading: false,
  error: null,
  progressState: null
}

export const useCoverageStore = create<CoverageState>((set) => ({
  ...initialState,
  
  setAnalysisData: (geojson, stats) => set({ 
    analysisGeoJSON: geojson, 
    stats,
    error: null,
    progressState: null
  }),
  
  setMatchRadius: (radius) => set({ matchRadius: radius }),
  
  setClusterRadius: (radius) => set({ clusterRadius: radius }),
  
  setAlgorithm: (algorithm) => set({ algorithm }),
  
  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),
  
  toggleFilter: (filter) => set((state) => ({
    filters: {
      ...state.filters,
      [filter]: !state.filters[filter]
    }
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error, isLoading: false, progressState: null }),
  
  setProgress: (progress) => set({ progressState: progress }),
  
  reset: () => set(initialState)
}))

// Selector for filtered GeoJSON
export const useFilteredGeoJSON = () => {
  const { analysisGeoJSON, filters } = useCoverageStore()
  
  if (!analysisGeoJSON) return null
  
  const filteredFeatures = analysisGeoJSON.features.filter((feature) => {
    const status = feature.properties.status
    
    if (status === 'matched' && !filters.showMatched) return false
    if (status === 'undetected' && !filters.showUndetected) return false
    if (status === 'new_finding' && !filters.showNewFindings) return false
    
    return true
  })
  
  return {
    ...analysisGeoJSON,
    features: filteredFeatures
  }
}

