'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Connection,
  EdgeChange,
  NodeChange,
  ReactFlowProvider,
  ReactFlowInstance,
  Panel
} from 'reactflow'
import 'reactflow/dist/style.css'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

import {
  Play,
  Save,
  Download,
  Upload,
  Trash2,
  Copy,
  Settings,
  Plus,
  Zap,
  GitBranch,
  Mail,
  Clock,
  CheckCircle,
  AlertTriangle,
  Code,
  Database,
  Webhook
} from 'lucide-react'

// Custom Node Types
import StartNode from './nodes/StartNode'
import TaskNode from './nodes/TaskNode'
import ConditionNode from './nodes/ConditionNode'
import EndNode from './nodes/EndNode'
import ApiCallNode from './nodes/ApiCallNode'
import EmailNode from './nodes/EmailNode'
import DelayNode from './nodes/DelayNode'
import ApprovalNode from './nodes/ApprovalNode'

const nodeTypes = {
  start: StartNode,
  task: TaskNode,
  condition: ConditionNode,
  end: EndNode,
  api_call: ApiCallNode,
  email: EmailNode,
  delay: DelayNode,
  approval: ApprovalNode
}

interface WorkflowBuilderProps {
  templateId?: string
  initialTemplate?: any
  onSave?: (template: any) => void
  onExecute?: (template: any, variables: any) => void
  readOnly?: boolean
}

const nodeCategories = [
  {
    category: 'Flow Control',
    nodes: [
      { type: 'start', label: 'Start', icon: Play, color: '#10b981' },
      { type: 'end', label: 'End', icon: CheckCircle, color: '#ef4444' },
      { type: 'condition', label: 'Condition', icon: GitBranch, color: '#f59e0b' }
    ]
  },
  {
    category: 'Actions',
    nodes: [
      { type: 'task', label: 'Task', icon: Zap, color: '#3b82f6' },
      { type: 'api_call', label: 'API Call', icon: Code, color: '#8b5cf6' },
      { type: 'email', label: 'Email', icon: Mail, color: '#06b6d4' },
      { type: 'delay', label: 'Delay', icon: Clock, color: '#84cc16' }
    ]
  },
  {
    category: 'Human Tasks',
    nodes: [
      { type: 'approval', label: 'Approval', icon: AlertTriangle, color: '#f97316' }
    ]
  }
]

export default function WorkflowBuilder({
  templateId,
  initialTemplate,
  onSave,
  onExecute,
  readOnly = false
}: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDescription, setWorkflowDescription] = useState('')
  const [workflowCategory, setWorkflowCategory] = useState('general')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionVariables, setExecutionVariables] = useState<Record<string, any>>({})
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null)

  // Load initial template
  useEffect(() => {
    if (initialTemplate) {
      setWorkflowName(initialTemplate.name || '')
      setWorkflowDescription(initialTemplate.description || '')
      setWorkflowCategory(initialTemplate.category || 'general')
      
      if (initialTemplate.nodes) {
        setNodes(initialTemplate.nodes)
      }
      
      if (initialTemplate.connections) {
        setEdges(initialTemplate.connections)
      }
    }
  }, [initialTemplate, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      const edge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: 'default',
        animated: false
      }
      setEdges((eds) => addEdge(edge, eds))
    },
    [setEdges]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }, [])

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      if (!draggedNodeType || !reactFlowInstance) {
        return
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      })

      const newNode: Node = {
        id: `${draggedNodeType}-${Date.now()}`,
        type: draggedNodeType,
        position,
        data: {
          label: `${draggedNodeType.charAt(0).toUpperCase() + draggedNodeType.slice(1)} Node`,
          ...getDefaultNodeData(draggedNodeType)
        }
      }

      setNodes((nds) => nds.concat(newNode))
      setDraggedNodeType(null)
    },
    [draggedNodeType, reactFlowInstance, setNodes]
  )

  const getDefaultNodeData = (nodeType: string) => {
    switch (nodeType) {
      case 'task':
        return {
          taskType: 'manual',
          assignee: '',
          priority: 'medium',
          estimatedHours: 1,
          description: ''
        }
      case 'condition':
        return {
          conditionType: 'if_then',
          conditions: []
        }
      case 'api_call':
        return {
          apiEndpoint: '',
          httpMethod: 'GET',
          headers: {},
          payload: {}
        }
      case 'email':
        return {
          emailTemplate: '',
          recipients: [],
          subject: ''
        }
      case 'delay':
        return {
          delayAmount: 1,
          delayUnit: 'minutes'
        }
      case 'approval':
        return {
          approvers: [],
          approvalType: 'any'
        }
      default:
        return {}
    }
  }

  const handleNodeDragStart = (nodeType: string) => {
    setDraggedNodeType(nodeType)
  }

  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id))
      setEdges((eds) => eds.filter((edge) => 
        edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ))
      setSelectedNode(null)
    }
  }, [selectedNode, setNodes, setEdges])

  const deleteSelectedEdge = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge.id))
      setSelectedEdge(null)
    }
  }, [selectedEdge, setEdges])

  const saveWorkflow = useCallback(async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name')
      return
    }

    const template = {
      name: workflowName,
      description: workflowDescription,
      category: workflowCategory,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.data.label,
        position: node.position,
        data: node.data,
        style: node.style
      })),
      connections: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
        type: edge.type,
        animated: edge.animated,
        style: edge.style
      }))
    }

    try {
      if (onSave) {
        await onSave(template)
        toast.success('Workflow saved successfully')
      }
    } catch (error) {
      console.error('Error saving workflow:', error)
      toast.error('Failed to save workflow')
    }
  }, [workflowName, workflowDescription, workflowCategory, nodes, edges, onSave])

  const executeWorkflow = useCallback(async () => {
    if (!workflowName.trim()) {
      toast.error('Please save the workflow first')
      return
    }

    setIsExecuting(true)
    try {
      const template = {
        name: workflowName,
        description: workflowDescription,
        category: workflowCategory,
        nodes,
        connections: edges
      }

      if (onExecute) {
        await onExecute(template, executionVariables)
        toast.success('Workflow execution started')
      }
    } catch (error) {
      console.error('Error executing workflow:', error)
      toast.error('Failed to execute workflow')
    } finally {
      setIsExecuting(false)
    }
  }, [workflowName, workflowDescription, workflowCategory, nodes, edges, executionVariables, onExecute])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Input
              placeholder="Workflow Name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-64"
              disabled={readOnly}
            />
            <Select value={workflowCategory} onValueChange={setWorkflowCategory} disabled={readOnly}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="approval">Approval</SelectItem>
                <SelectItem value="data_processing">Data Processing</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="integration">Integration</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            {!readOnly && (
              <>
                <Button onClick={saveWorkflow} variant="outline">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button onClick={executeWorkflow} disabled={isExecuting}>
                  <Play className="w-4 h-4 mr-2" />
                  {isExecuting ? 'Executing...' : 'Execute'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Node Palette */}
        {!readOnly && (
          <div className="w-64 border-r bg-gray-50 p-4">
            <h3 className="font-semibold mb-4">Node Palette</h3>
            <ScrollArea className="h-full">
              {nodeCategories.map((category) => (
                <div key={category.category} className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {category.category}
                  </h4>
                  <div className="space-y-2">
                    {category.nodes.map((node) => {
                      const IconComponent = node.icon
                      return (
                        <div
                          key={node.type}
                          draggable
                          onDragStart={() => handleNodeDragStart(node.type)}
                          className="flex items-center p-2 bg-white border rounded cursor-move hover:shadow-sm transition-shadow"
                        >
                          <IconComponent 
                            className="w-4 h-4 mr-2" 
                            style={{ color: node.color }}
                          />
                          <span className="text-sm">{node.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {/* Main Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
            <MiniMap />
            
            {/* Delete Button Panel */}
            {(selectedNode || selectedEdge) && !readOnly && (
              <Panel position="top-right">
                <Button
                  onClick={selectedNode ? deleteSelectedNode : deleteSelectedEdge}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Properties Panel */}
        {(selectedNode || selectedEdge) && (
          <div className="w-80 border-l bg-white">
            <Card className="h-full rounded-none border-0">
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedNode ? 'Node Properties' : 'Edge Properties'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-full">
                  {selectedNode && (
                    <NodePropertiesPanel 
                      node={selectedNode} 
                      onUpdate={(updatedNode) => {
                        setNodes((nds) => 
                          nds.map((node) => 
                            node.id === updatedNode.id ? updatedNode : node
                          )
                        )
                        setSelectedNode(updatedNode)
                      }}
                      readOnly={readOnly}
                    />
                  )}
                  {selectedEdge && (
                    <EdgePropertiesPanel 
                      edge={selectedEdge}
                      onUpdate={(updatedEdge) => {
                        setEdges((eds) => 
                          eds.map((edge) => 
                            edge.id === updatedEdge.id ? updatedEdge : edge
                          )
                        )
                        setSelectedEdge(updatedEdge)
                      }}
                      readOnly={readOnly}
                    />
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// Node Properties Panel Component
function NodePropertiesPanel({ 
  node, 
  onUpdate, 
  readOnly 
}: { 
  node: Node
  onUpdate: (node: Node) => void
  readOnly: boolean
}) {
  const updateNodeData = (key: string, value: any) => {
    if (readOnly) return
    
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        [key]: value
      }
    }
    onUpdate(updatedNode)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="node-label">Label</Label>
        <Input
          id="node-label"
          value={node.data.label || ''}
          onChange={(e) => updateNodeData('label', e.target.value)}
          disabled={readOnly}
        />
      </div>

      {node.type === 'task' && (
        <>
          <div>
            <Label htmlFor="task-type">Task Type</Label>
            <Select 
              value={node.data.taskType || 'manual'} 
              onValueChange={(value) => updateNodeData('taskType', value)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="automated">Automated</SelectItem>
                <SelectItem value="script">Script</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="assignee">Assignee</Label>
            <Input
              id="assignee"
              value={node.data.assignee || ''}
              onChange={(e) => updateNodeData('assignee', e.target.value)}
              placeholder="Enter email or user ID"
              disabled={readOnly}
            />
          </div>
          
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select 
              value={node.data.priority || 'medium'} 
              onValueChange={(value) => updateNodeData('priority', value)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={node.data.description || ''}
              onChange={(e) => updateNodeData('description', e.target.value)}
              disabled={readOnly}
            />
          </div>
        </>
      )}

      {node.type === 'api_call' && (
        <>
          <div>
            <Label htmlFor="api-endpoint">API Endpoint</Label>
            <Input
              id="api-endpoint"
              value={node.data.apiEndpoint || ''}
              onChange={(e) => updateNodeData('apiEndpoint', e.target.value)}
              placeholder="https://api.example.com/endpoint"
              disabled={readOnly}
            />
          </div>
          
          <div>
            <Label htmlFor="http-method">HTTP Method</Label>
            <Select 
              value={node.data.httpMethod || 'GET'} 
              onValueChange={(value) => updateNodeData('httpMethod', value)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {node.type === 'email' && (
        <>
          <div>
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={node.data.subject || ''}
              onChange={(e) => updateNodeData('subject', e.target.value)}
              disabled={readOnly}
            />
          </div>
          
          <div>
            <Label htmlFor="email-recipients">Recipients</Label>
            <Input
              id="email-recipients"
              value={Array.isArray(node.data.recipients) ? node.data.recipients.join(', ') : ''}
              onChange={(e) => updateNodeData('recipients', e.target.value.split(',').map(r => r.trim()))}
              placeholder="email1@example.com, email2@example.com"
              disabled={readOnly}
            />
          </div>
        </>
      )}

      {node.type === 'delay' && (
        <>
          <div>
            <Label htmlFor="delay-amount">Delay Amount</Label>
            <Input
              id="delay-amount"
              type="number"
              value={node.data.delayAmount || 1}
              onChange={(e) => updateNodeData('delayAmount', parseInt(e.target.value))}
              disabled={readOnly}
            />
          </div>
          
          <div>
            <Label htmlFor="delay-unit">Delay Unit</Label>
            <Select 
              value={node.data.delayUnit || 'minutes'} 
              onValueChange={(value) => updateNodeData('delayUnit', value)}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  )
}

// Edge Properties Panel Component
function EdgePropertiesPanel({ 
  edge, 
  onUpdate, 
  readOnly 
}: { 
  edge: Edge
  onUpdate: (edge: Edge) => void
  readOnly: boolean
}) {
  const updateEdgeData = (key: string, value: any) => {
    if (readOnly) return
    
    const updatedEdge = {
      ...edge,
      [key]: value
    }
    onUpdate(updatedEdge)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="edge-label">Label</Label>
        <Input
          id="edge-label"
          value={edge.label || ''}
          onChange={(e) => updateEdgeData('label', e.target.value)}
          disabled={readOnly}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="edge-animated"
          checked={edge.animated || false}
          onChange={(e) => updateEdgeData('animated', e.target.checked)}
          disabled={readOnly}
        />
        <Label htmlFor="edge-animated">Animated</Label>
      </div>
    </div>
  )
}
