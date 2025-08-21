"use client"

import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, RotateCcw, X, Play, Download, RefreshCw } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTask, useRetryTask, useCancelTask } from "@/hooks/use-tasks"
import { useNotificationIntegration } from "@/hooks/use-notification-integration"

const getStatusColor = (status: string) => {
  switch (status) {
    case "running":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100"
    case "completed":
      return "bg-green-100 text-green-800 hover:bg-green-100"
    case "failed":
      return "bg-red-100 text-red-800 hover:bg-red-100"
    case "pending":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100"
  }
}

const getLogLevelColor = (level: string) => {
  switch (level) {
    case "ERROR":
      return "text-red-600"
    case "WARN":
      return "text-yellow-600"
    case "INFO":
      return "text-blue-600"
    default:
      return "text-gray-600"
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export default function TaskDetailPage() {
  const params = useParams()
  const taskId = params.id as string

  const { data: task, isLoading, error } = useTask(taskId)
  const retryTaskMutation = useRetryTask()
  const cancelTaskMutation = useCancelTask()
  const { notifyTaskComplete, notifyTaskFailed } = useNotificationIntegration()

  const handleRetry = async () => {
    try {
      await retryTaskMutation.mutateAsync(taskId)
      notifyTaskComplete(task?.name || "Task", taskId)
    } catch (error) {
      notifyTaskFailed(task?.name || "Task", taskId, "Retry failed")
    }
  }

  const handleCancel = async () => {
    try {
      await cancelTaskMutation.mutateAsync(taskId)
      notifyTaskFailed(task?.name || "Task", taskId, "Task cancelled by user")
    } catch (error) {
      console.error("Failed to cancel task:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/tasks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tasks
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading task details...</p>
        </div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/tasks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tasks
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Task not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/tasks">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tasks
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{task.name}</h1>
            <p className="text-muted-foreground">
              Task ID: {task.id} • Workflow: {task.workflowName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {task.status === "failed" && (
            <Button onClick={handleRetry} disabled={retryTaskMutation.isPending}>
              {retryTaskMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              {retryTaskMutation.isPending ? "Retrying..." : "Retry"}
            </Button>
          )}
          {task.status === "running" && (
            <Button variant="destructive" onClick={handleCancel} disabled={cancelTaskMutation.isPending}>
              <X className="mr-2 h-4 w-4" />
              {cancelTaskMutation.isPending ? "Cancelling..." : "Cancel"}
            </Button>
          )}
          {task.status === "pending" && (
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Start
            </Button>
          )}
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
        </div>
      </div>

      {task.status === "failed" && task.output?.error && (
        <Alert>
          <AlertDescription>
            This task failed with error: {task.output.error}. You can retry the task or check the logs for more details.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Task Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={getStatusColor(task.status)}>
                {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="font-medium">{task.owner}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Time</p>
              <p className="font-medium">{task.startTime ? formatDate(task.startTime) : "Not started"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Time</p>
              <p className="font-medium">{task.endTime ? formatDate(task.endTime) : "In progress"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">{task.duration || "N/A"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">CPU Usage</p>
              <p className="font-medium">{task.metrics?.cpuUsage || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Memory Usage</p>
              <p className="font-medium">{task.metrics?.memoryUsage || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Disk I/O</p>
              <p className="font-medium">{task.metrics?.diskIO || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Network I/O</p>
              <p className="font-medium">{task.metrics?.networkIO || "N/A"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Workflow</p>
              <Link href={`/dashboard/workflows/${task.workflowId}`} className="font-medium hover:underline">
                {task.workflowName}
              </Link>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-sm">{task.description || "No description available"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="input" className="space-y-4">
        <TabsList>
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          <Card>
            <CardHeader>
              <CardTitle>Task Input</CardTitle>
              <CardDescription>Input parameters and configuration for this task</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(task.input || {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="output">
          <Card>
            <CardHeader>
              <CardTitle>Task Output</CardTitle>
              <CardDescription>Results and output data from this task</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(task.output || {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Task Logs</CardTitle>
              <CardDescription>Detailed execution logs for this task</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {task.logs && task.logs.length > 0 ? (
                  task.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm font-mono">
                      <span className="text-muted-foreground whitespace-nowrap">{formatDate(log.timestamp)}</span>
                      <span className={`font-medium whitespace-nowrap ${getLogLevelColor(log.level)}`}>
                        [{log.level}]
                      </span>
                      <span className="flex-1">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">No logs available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
