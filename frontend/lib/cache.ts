// localStorage cache utilities
export interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

export class LocalCache {
  private static instance: LocalCache
  private cache: Map<string, CacheItem<any>> = new Map()

  static getInstance(): LocalCache {
    if (!LocalCache.instance) {
      LocalCache.instance = new LocalCache()
    }
    return LocalCache.instance
  }

  set<T>(key: string, data: T, ttl = 3600000): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }

    this.cache.set(key, item)

    // Also store in localStorage for persistence
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(item))
    } catch (error) {
      console.warn("Failed to store in localStorage:", error)
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
