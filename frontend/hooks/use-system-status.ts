import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: api.getSystemStatus,
    refetchInterval: 5000, // Refresh every 5 seconds
    meta: { useCache: true },
  })
}
