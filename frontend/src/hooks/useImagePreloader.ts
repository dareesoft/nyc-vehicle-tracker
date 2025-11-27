import { useEffect, useRef, useCallback, useState } from 'react'
import { getImageUrl } from './useTrip'
import type { ImagePoint } from '../stores/tripStore'

// Configuration - Optimized for thumbnails (~50KB vs ~1MB original)
const PRELOAD_AHEAD = 30      // Preload 30 images ahead when playing (increased from 15)
const PRELOAD_BEHIND = 10     // Keep 10 images behind in cache (increased from 5)
const PRELOAD_IDLE = 50       // Preload 50 images ahead when idle (increased from 30)
const MAX_CACHE_SIZE = 200    // Maximum images to keep in cache (increased from 100)
const PRELOAD_BATCH_SIZE = 10 // Load 10 images at a time (increased from 5)
const PRELOAD_DELAY = 30      // Delay between batches (ms) - reduced for faster loading

// Global image cache
const imageCache = new Map<string, { img: HTMLImageElement; loaded: boolean }>()

export function useImagePreloader(
  data: ImagePoint[],
  currentIndex: number,
  isPlaying: boolean
) {
  const [preloadedCount, setPreloadedCount] = useState(0)
  const [preloadProgress, setPreloadProgress] = useState(0)
  const preloadQueueRef = useRef<string[]>([])
  const isPreloadingRef = useRef(false)
  const preloadTimeoutRef = useRef<number | null>(null)
  
  // Get cached image or null
  const getCachedImage = useCallback((point: ImagePoint): string | null => {
    const url = getImageUrl(point)
    const cached = imageCache.get(url)
    if (cached && cached.loaded) {
      return url
    }
    return null
  }, [])
  
  // Check if image is preloaded
  const isPreloaded = useCallback((point: ImagePoint): boolean => {
    const url = getImageUrl(point)
    const cached = imageCache.get(url)
    return cached?.loaded ?? false
  }, [])
  
  // Preload a single image
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve) => {
      if (imageCache.has(url)) {
        resolve()
        return
      }
      
      const img = new Image()
      imageCache.set(url, { img, loaded: false })
      
      img.onload = () => {
        const cached = imageCache.get(url)
        if (cached) {
          cached.loaded = true
        }
        resolve()
      }
      
      img.onerror = () => {
        imageCache.delete(url)
        resolve()
      }
      
      img.src = url
    })
  }, [])
  
  // Process preload queue
  const processPreloadQueue = useCallback(async () => {
    if (isPreloadingRef.current || preloadQueueRef.current.length === 0) return
    
    isPreloadingRef.current = true
    
    // Take a batch from queue
    const batch = preloadQueueRef.current.splice(0, PRELOAD_BATCH_SIZE)
    
    // Preload batch in parallel
    await Promise.all(batch.map(url => preloadImage(url)))
    
    // Update preloaded count
    let count = 0
    for (const [, cached] of imageCache) {
      if (cached.loaded) count++
    }
    setPreloadedCount(count)
    
    // Calculate progress based on current position
    if (data.length > 0) {
      const aheadRange = isPlaying ? PRELOAD_AHEAD : PRELOAD_IDLE
      let preloadedAhead = 0
      for (let i = currentIndex; i <= Math.min(currentIndex + aheadRange, data.length - 1); i++) {
        if (isPreloaded(data[i])) preloadedAhead++
      }
      setPreloadProgress(Math.round((preloadedAhead / aheadRange) * 100))
    }
    
    isPreloadingRef.current = false
    
    // Continue processing if queue not empty
    if (preloadQueueRef.current.length > 0) {
      preloadTimeoutRef.current = window.setTimeout(processPreloadQueue, PRELOAD_DELAY)
    }
  }, [data, currentIndex, isPlaying, preloadImage, isPreloaded])
  
  // Build preload queue based on current position
  const buildPreloadQueue = useCallback(() => {
    if (data.length === 0) return
    
    // Clear existing timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current)
    }
    
    const aheadRange = isPlaying ? PRELOAD_AHEAD : PRELOAD_IDLE
    const queue: string[] = []
    
    // Prioritize images ahead of current position
    for (let i = currentIndex; i <= Math.min(currentIndex + aheadRange, data.length - 1); i++) {
      const url = getImageUrl(data[i])
      if (!imageCache.has(url) || !imageCache.get(url)?.loaded) {
        queue.push(url)
      }
    }
    
    // Also keep some images behind
    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - PRELOAD_BEHIND); i--) {
      const url = getImageUrl(data[i])
      if (!imageCache.has(url) || !imageCache.get(url)?.loaded) {
        queue.push(url)
      }
    }
    
    preloadQueueRef.current = queue
    
    // Clean up old cache entries
    const keepUrls = new Set<string>()
    const keepStart = Math.max(0, currentIndex - PRELOAD_BEHIND * 2)
    const keepEnd = Math.min(data.length - 1, currentIndex + PRELOAD_IDLE)
    
    for (let i = keepStart; i <= keepEnd; i++) {
      keepUrls.add(getImageUrl(data[i]))
    }
    
    // Remove old entries, keeping within MAX_CACHE_SIZE
    if (imageCache.size > MAX_CACHE_SIZE) {
      for (const [url] of imageCache) {
        if (!keepUrls.has(url)) {
          imageCache.delete(url)
        }
        if (imageCache.size <= MAX_CACHE_SIZE * 0.8) break
      }
    }
    
    // Start processing
    if (queue.length > 0) {
      processPreloadQueue()
    }
  }, [data, currentIndex, isPlaying, processPreloadQueue])
  
  // Rebuild queue when position or data changes
  useEffect(() => {
    buildPreloadQueue()
    
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current)
      }
    }
  }, [buildPreloadQueue])
  
  // Clear cache when data changes completely
  useEffect(() => {
    return () => {
      imageCache.clear()
    }
  }, [])
  
  return {
    preloadedCount,
    preloadProgress,
    getCachedImage,
    isPreloaded,
    totalCached: imageCache.size
  }
}

// Export cache for direct access
export function getPreloadedImageUrl(point: ImagePoint): string | null {
  const url = getImageUrl(point)
  const cached = imageCache.get(url)
  if (cached && cached.loaded) {
    return url
  }
  return null
}

export function clearImageCache() {
  imageCache.clear()
}

