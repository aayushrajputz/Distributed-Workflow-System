"use client"

import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Play, Pause, Square, RotateCcw } from "lucide-react"
import Link from "next/link"

// Mock workflow data
const mockWorkflowDetails = {
  "wf-001": {
    id: "wf-001",
    name: "Data Processing Pipeline",
    status: "running",
    createdAt: "2024-01-15T10:30:00Z",
    lastUpdated: "2024-01-15T14:22:00Z",
    owner: "John Doe",
    description: "Processes incoming data files, validates format, and stores in database",
    nodes: [
      { id: "node-1", name: "File Input", type: "input", status: "completed", x: 100, y: 100 },
      { id: "node-2", name: "Validate Format", type: "process", status: "completed", x: 300, y: 100 },
      { id: "node-3", name: "Transform Data", type: "process", status: "running", x: 500, y: 100 },
      { id: "node-4", name: "Store in DB", type: "process", status: "pending", x: 700, y: 100 },
      { id: "node-5", name: "Send Notification", type: "output", status: "pending", x: 900, y: 100 },
    ],
    tasks: [
      {
        id: "task-1",
        name: "Read input file",
        status: "completed",
        startTime: "2024-01-15T10:30:00Z",
        endTime: "2024-01-15T10:32:00Z",
      },
      {
        id: "task-2",
        name: "Validate CSV format",
        status: "completed",
        startTime: "2024-01-15T10:32:00Z",
        endTime: "2024-01-15T10:35:00Z",
      },
      { id: "task-3", name: "Transform records", status: "running", startTime: "2024-01-15T10:35:00Z", endTime: null },
      { id: "task-4", name: "Insert to database", status: "pending", startTime: null, endTime: null },
      { id: "task-5", name: "Send email notification", status: "pending", startTime: null, endTime: null },
    ],
  },
}

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

const getNodeColor = (status: string) => {
  switch (status) {
    case "running":
      return "border-blue-500 bg-blue-50"
    case "completed":
      return "border-green-500 bg-green-50"
    case "failed":
      return "border-red-500 bg-red-50"
    case "pending":
      return "border-gray-300 bg-gray-50"
    default:
      return "border-gray-300 bg-gray-50"
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

export default function WorkflowDetailPage() {
  const params = useParams()
  const workflowId = params.id as string
  const workflow = mockWorkflowDetails[workflowId as keyof typeof mockWorkflowDetails]

  if (!workflow) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workflows
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Workflow not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/workflows">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workflows
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{workflow.name}</h1>
            <p className="text-muted-foreground">Workflow ID: {workflow.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Play className="mr-2 h-4 w-4" />
            Start
          </Button>
          <Button variant="outline" size="sm">
            <Pause className="mr-2 h-4 w-4" />
            Pause
          </Button>
          <Button variant="outline" size="sm">
            <Square className="mr-2 h-4 w-4" />
            Stop
          </Button>
          <Button variant="outline" size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            Restart
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={getStatusColor(workflow.status)}>
                {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="font-medium">{workflow.owner}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(workflow.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">{formatDate(workflow.lastUpdated)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nodes</p>
              <p className="font-medium">{workflow.nodes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Workflow Visualization</CardTitle>
            <CardDescription>Visual representation of workflow execution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-64 bg-gray-50 rounded-lg overflow-hidden">
              <svg className="w-full h-full">
                {/* Draw connections between nodes */}
                {workflow.nodes.slice(0, -1).map((node, index) => {
                  const nextNode = workflow.nodes[index + 1]
                  return (
                    <line
                      key={`connection-${index}`}
                      x1={node.x + 40}
                      y1={node.y + 20}
                      x2={nextNode.x}
                      y2={nextNode.y + 20}
                      stroke="#d1d5db"
                      strokeWidth="2"
                      markerEnd="url(#arrowhead)"
                    />
                  )
                })}

                {/* Arrow marker definition */}
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
                  </marker>
                </defs>

                {/* Draw nodes */}
                {workflow.nodes.map((node) => (
                  <g key={node.id}>
                    <rect
                      x={node.x}
                      y={node.y}
                      width="80"
                      height="40"
                      rx="4"
                      className={`${getNodeColor(node.status)} stroke-2`}
                    />
                    <text
                      x={node.x + 40}
                      y={node.y + 25}
                      textAnchor="middle"
                      className="text-xs font-medium fill-current"
                    >
                      {node.name}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Tasks</CardTitle>
          <CardDescription>Individual tasks and their execution status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflow.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{task.name}</h4>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Task ID: {task.id}
                    {task.startTime && ` • Started: ${formatDate(task.startTime)}`}
                    {task.endTime && ` • Completed: ${formatDate(task.endTime)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/tasks/${task.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
