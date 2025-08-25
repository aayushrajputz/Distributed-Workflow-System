import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: api.getTasks,
    meta: { useCache: true },
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api.getTask(id),
    enabled: !!id,
    meta: { useCache: true },
  })
}

export function useRetryTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.retryTask,
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.cancelTask,
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}
