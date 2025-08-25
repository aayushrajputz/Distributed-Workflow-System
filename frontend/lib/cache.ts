// localStorage cache utilities
export interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

export class LocalCache {
  private static instance: LocalCache
  private cache: Map<string, CacheItem<any>> = new Map()
  private readonly MAX_CACHE_SIZE = 50 // Maximum number of items in memory cache
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB limit for localStorage

  static getInstance(): LocalCache {
    if (!LocalCache.instance) {
      LocalCache.instance = new LocalCache()
    }
    return LocalCache.instance
  }

  set<T>(key: string, data: T, ttl = 3600000): void {
    // Check cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest()
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }

    this.cache.set(key, item)

    // Also store in localStorage for persistence
    try {
      const serialized = JSON.stringify(item)
      
      // Check storage size limit
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        console.warn(`Cache item too large (${serialized.length} bytes), skipping localStorage storage`)
        return
      }

      localStorage.setItem(`cache_${key}`, serialized)
    } catch (error) {
      console.warn("Failed to store in localStorage:", error)
      // If localStorage is full, try to clear some space
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearOldestFromStorage()
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify(item))
        } catch (retryError) {
          console.warn("Failed to store in localStorage after cleanup:", retryError)
        }
      }
    }
  }

  get<T>(key: string): T | null {
    let item = this.cache.get(key)

    // If not in memory, try localStorage
    if (!item) {
      try {
        const stored = localStorage.getItem(`cache_${key}`)
        if (stored) {
          item = JSON.parse(stored)
          this.cache.set(key, item)
        }
      } catch (error) {
        console.warn("Failed to read from localStorage:", error)
        // Remove corrupted item
        try {
          localStorage.removeItem(`cache_${key}`)
        } catch (removeError) {
          console.warn("Failed to remove corrupted cache item:", removeError)
        }
      }
    }

    if (!item) return null

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key)
      return null
    }

    return item.data
  }

  delete(key: string): void {
    this.cache.delete(key)
    try {
      localStorage.removeItem(`cache_${key}`)
    } catch (error) {
      console.warn("Failed to remove from localStorage:", error)
    }
  }

  clear(): void {
    this.cache.clear()
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith("cache_"))
      keys.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      console.warn("Failed to clear localStorage:", error)
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  private clearOldestFromStorage(): void {
    try {
      const cacheKeys = Object.keys(localStorage).filter((key) => key.startsWith("cache_"))
      const cacheItems = cacheKeys.map(key => ({
        key,
        timestamp: JSON.parse(localStorage.getItem(key) || '{}').timestamp || 0
      }))

      // Sort by timestamp and remove oldest items
      cacheItems.sort((a, b) => a.timestamp - b.timestamp)
      
      // Remove 20% of oldest items
      const itemsToRemove = Math.ceil(cacheItems.length * 0.2)
      for (let i = 0; i < itemsToRemove; i++) {
        localStorage.removeItem(cacheItems[i].key)
      }
    } catch (error) {
      console.warn("Failed to clear oldest items from localStorage:", error)
    }
  }

  getStats(): { totalEntries: number; usedSpace: string } {
    let totalSize = 0
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith("cache_"))
      keys.forEach((key) => {
        const value = localStorage.getItem(key)
        if (value) {
          totalSize += value.length
        }
      })
    } catch (error) {
      console.warn("Failed to calculate cache size:", error)
    }

    return {
      totalEntries: this.cache.size,
      usedSpace: `${(totalSize / 1024 / 1024).toFixed(1)} MB`,
    }
  }
}

export const cache = LocalCache.getInstance()
