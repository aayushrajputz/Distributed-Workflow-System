"use client"

import type React from "react"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState } from "react"
import { cache } from "./cache"

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchInterval: 5000, // Auto-refresh every 5 seconds
            refetchIntervalInBackground: true,
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (
                error instanceof Error &&
                "status" in error &&
                (error as any).status >= 400 &&
                (error as any).status < 500
              ) {
                return false
              }
              return failureCount < 3
            },
            // Custom cache implementation
            queryFn: async ({ queryKey, meta }) => {
              const cacheKey = JSON.stringify(queryKey)

              // Try cache first
              const cached = cache.get(cacheKey)
              if (cached && meta?.useCache !== false) {
                return cached
              }

              // If no cache or cache disabled, fetch from API
              const result = await (meta?.queryFn as any)?.()

              // Cache the result
              if (result && meta?.useCache !== false) {
                cache.set(cacheKey, result, 5 * 60 * 1000) // 5 minutes TTL
              }

              return result
            },
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
