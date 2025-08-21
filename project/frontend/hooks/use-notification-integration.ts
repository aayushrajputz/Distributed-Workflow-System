"use client"
import { useNotifications } from "@/contexts/notification-context"

// Hook to integrate notifications with workflow/task events
export function useNotificationIntegration() {
  const { addNotification } = useNotifications()

  // Workflow event handlers
  const notifyWorkflowComplete = (workflowName: string, workflowId: string) => {
    addNotification({
      title: "Workflow Completed",
      message: `${workflowName} has completed successfully`,
      type: "success",
      category: "workflow",
      actionUrl: `/dashboard/workflows/${workflowId}`,
      actionLabel: "View Workflow",
    })
  }

  const notifyWorkflowFailed = (workflowName: string, workflowId: string, error: string) => {
    addNotification({
      title: "Workflow Failed",
      message: `${workflowName} failed: ${error}`,
      type: "error",
      category: "workflow",
      actionUrl: `/dashboard/workflows/${workflowId}`,
      actionLabel: "View Details",
    })
  }

  // Task event handlers
  const notifyTaskComplete = (taskName: string, taskId: string) => {
    addNotification({
      title: "Task Completed",
      message: `${taskName} has finished successfully`,
      type: "success",
      category: "task",
      actionUrl: `/dashboard/tasks/${taskId}`,
      actionLabel: "View Task",
    })
  }

  const notifyTaskFailed = (taskName: string, taskId: string, error: string) => {
    addNotification({
      title: "Task Failed",
      message: `${taskName} failed: ${error}`,
      type: "error",
      category: "task",
      actionUrl: `/dashboard/tasks/${taskId}`,
      actionLabel: "Retry Task",
    })
  }

  // System event handlers
  const notifySystemAlert = (message: string, severity: "info" | "warning" | "error" = "warning") => {
    addNotification({
      title: "System Alert",
      message,
      type: severity,
      category: "system",
    })
  }

  // Security event handlers
  const notifySecurityEvent = (message: string, severity: "info" | "warning" | "error" = "warning") => {
    addNotification({
      title: "Security Alert",
      message,
      type: severity,
      category: "security",
    })
  }

  return {
    notifyWorkflowComplete,
    notifyWorkflowFailed,
    notifyTaskComplete,
    notifyTaskFailed,
    notifySystemAlert,
    notifySecurityEvent,
  }
}
