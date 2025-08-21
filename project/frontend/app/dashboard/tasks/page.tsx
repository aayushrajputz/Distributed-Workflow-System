"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, RotateCcw, X } from "lucide-react"

// Mock data for tasks
const mockTasks = [
  {
    id: "task-1",
    name: "Read input file",
    workflowId: "wf-001",
    workflowName: "Data Processing Pipeline",
    status: "completed",
    startTime: "2024-01-15T10:30:00Z",
    endTime: "2024-01-15T10:32:00Z",
    duration: "2m 15s",
    owner: "John Doe",
  },
  {
    id: "task-2",
    name: "Validate CSV format",
    workflowId: "wf-001",
    workflowName: "Data Processing Pipeline",
    status: "completed",
    startTime: "2024-01-15T10:32:00Z",
    endTime: "2024-01-15T10:35:00Z",
    duration: "3m 42s",
    owner: "John Doe",
  },
  {
    id: "task-3",
    name: "Transform records",
    workflowId: "wf-001",
    workflowName: "Data Processing Pipeline",
    status: "running",
    startTime: "2024-01-15T10:35:00Z",
    endTime: null,
    duration: "15m 23s",
    owner: "John Doe",
  },
  {
    id: "task-4",
    name: "Insert to database",
    workflowId: "wf-001",
    workflowName: "Data Processing Pipeline",
    status: "pending",
    startTime: null,
    endTime: null,
    duration: null,
    owner: "John Doe",
  },
  {
    id: "task-5",
    name: "Send email notification",
    workflowId: "wf-002",
    workflowName: "Email Campaign Workflow",
    status: "failed",
    startTime: "2024-01-14T09:15:00Z",
    endTime: "2024-01-14T09:18:00Z",
    duration: "3m 12s",
    owner: "Jane Smith",
  },
  {
    id: "task-6",
    name: "Generate PDF report",
    workflowId: "wf-003",
    workflowName: "Report Generation",
    status: "failed",
    startTime: "2024-01-13T16:20:00Z",
    endTime: "2024-01-13T16:35:00Z",
    duration: "15m 8s",
    owner: "Mike Johnson",
  },
]

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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function TasksPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [workflowFilter, setWorkflowFilter] = useState("all")

  const filteredTasks = mockTasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.workflowName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesWorkflow = workflowFilter === "all" || task.workflowId === workflowFilter
    return matchesSearch && matchesStatus && matchesWorkflow
  })

  const uniqueWorkflows = Array.from(
    new Map(mockTasks.map((task) => [task.workflowId, { id: task.workflowId, name: task.workflowName }])).values()
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">View and manage individual tasks across all workflows</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by workflow" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workflows</SelectItem>
            {uniqueWorkflows.map((workflow) => (
              <SelectItem key={workflow.id} value={workflow.id}>
                {workflow.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {(filteredTasks || []).map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    <Link href={`/dashboard/tasks/${task.id}`} className="hover:underline">
                      {task.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    Task ID: {task.id} • Workflow: {task.workflowName} • Owner: {task.owner}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(task.status)}>
                    {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                  </Badge>
                  {task.status === "failed" && (
                    <Button variant="outline" size="sm">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Retry
                    </Button>
                  )}
                  {task.status === "running" && (
                    <Button variant="outline" size="sm">
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Start Time</p>
                  <p className="font-medium">{task.startTime ? formatDate(task.startTime) : "Not started"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Time</p>
                  <p className="font-medium">{task.endTime ? formatDate(task.endTime) : "In progress"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{task.duration || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{task.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tasks found matching your criteria.</p>
        </div>
      )}
    </div>
  )
}
