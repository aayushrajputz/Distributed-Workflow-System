import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: api.getWorkflows,
    meta: { useCache: true },
  })
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ["workflow", id],
    queryFn: () => api.getWorkflow(id),
    enabled: !!id,
    meta: { useCache: true },
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: api.createWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] })
    },
  })
}

export function useWorkflowTasks(workflowId: string) {
  return useQuery({
    queryKey: ["workflow-tasks", workflowId],
    queryFn: () => api.getWorkflowTasks(workflowId),
    enabled: !!workflowId,
    meta: { useCache: true },
  })
}
