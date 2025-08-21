"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateWorkflow } from "@/hooks/use-workflows"
import { useNotificationIntegration } from "@/hooks/use-notification-integration"
import { useToast } from "@/hooks/use-toast"

interface WorkflowNode {
  id: string
  name: string
  type: string
  description: string
}

export default function CreateWorkflowPage() {
  const router = useRouter()
  const { toast } = useToast()
  const createWorkflowMutation = useCreateWorkflow()
  const { notifyWorkflowComplete, notifyWorkflowFailed } = useNotificationIntegration()

  const [workflowName, setWorkflowName] = useState("")
  const [workflowDescription, setWorkflowDescription] = useState("")
  const [nodes, setNodes] = useState<WorkflowNode[]>([{ id: "1", name: "", type: "input", description: "" }])

  const addNode = () => {
    const newNode: WorkflowNode = {
      id: Date.now().toString(),
      name: "",
      type: "process",
      description: "",
    }
    setNodes([...nodes, newNode])
  }

  const removeNode = (id: string) => {
    if (nodes.length > 1) {
      setNodes(nodes.filter((node) => node.id !== id))
    }
  }

  const updateNode = (id: string, field: keyof WorkflowNode, value: string) => {
    setNodes(nodes.map((node) => (node.id === id ? { ...node, [field]: value } : node)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!workflowName.trim()) {
      toast({
        title: "Validation Error",
        description: "Workflow name is required",
        variant: "destructive",
      })
      return
    }

    const invalidNodes = nodes.filter((node) => !node.name.trim())
    if (invalidNodes.length > 0) {
      toast({
        title: "Validation Error",
        description: "All nodes must have a name",
        variant: "destructive",
      })
      return
    }

    try {
      const workflowData = {
        name: workflowName,
        description: workflowDescription,
        owner: "Current User", // In a real app, this would come from auth context
        nodeCount: nodes.length,
        nodes: nodes.map((node, index) => ({
          ...node,
          x: 100 + index * 200, // Simple positioning
          y: 100,
          status: "pending" as const,
        })),
      }

      const newWorkflow = await createWorkflowMutation.mutateAsync(workflowData)

      toast({
        title: "Workflow Created",
        description: `${workflowName} has been created successfully`,
      })

      notifyWorkflowComplete(workflowName, newWorkflow.id)
      router.push("/dashboard/workflows")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create workflow. Please try again.",
        variant: "destructive",
      })
      notifyWorkflowFailed(workflowName, "new", "Failed to create workflow")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/workflows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Workflow</h1>
          <p className="text-muted-foreground">Design a new workflow for your system</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
            <CardDescription>Basic information about your workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                placeholder="Enter workflow name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                placeholder="Describe what this workflow does"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Workflow Nodes</CardTitle>
                <CardDescription>Define the steps in your workflow</CardDescription>
              </div>
              <Button type="button" onClick={addNode} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Node
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {nodes.map((node, index) => (
              <div key={node.id} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Node {index + 1}</h4>
                  {nodes.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeNode(node.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Node Name</Label>
                    <Input
                      placeholder="Enter node name"
                      value={node.name}
                      onChange={(e) => updateNode(node.id, "name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Node Type</Label>
                    <Select value={node.type} onValueChange={(value) => updateNode(node.id, "type", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="input">Input</SelectItem>
                        <SelectItem value="process">Process</SelectItem>
                        <SelectItem value="output">Output</SelectItem>
                        <SelectItem value="condition">Condition</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe what this node does"
                    value={node.description}
                    onChange={(e) => updateNode(node.id, "description", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={createWorkflowMutation.isPending}>
            {createWorkflowMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Workflow"
            )}
          </Button>
          <Link href="/dashboard/workflows">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
