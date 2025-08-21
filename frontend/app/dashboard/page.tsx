'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Activity, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Key, 
  BarChart3, 
  TrendingUp,
  Users,
  Server,
  Cpu,
  HardDrive,
  Network,
  Plus,
  Calendar,
  GitBranch,
  Target
} from "lucide-react"
import { useEffect, useState, useMemo, useCallback } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { api, AnalyticsData } from "@/lib/api"
import { sampleDataService, WorkflowTask, Project, SystemMetrics, DistributedNode } from "@/lib/sample-data-service"
import { taskService, Task, TaskStats } from "@/lib/task-service"
import NewTaskForm from "@/components/NewTaskForm"
import { toast } from "sonner"
import { useApiKey } from "@/contexts/api-key-context"
import { useUserSession } from "@/hooks/use-user-session"
import { useTaskMetrics, useSystemMetrics, useApiMetrics } from "@/hooks/use-real-time-metrics"
import { ApiKeySetup } from "@/components/api-key-setup"
import { RealTimeMetricsCard } from "@/components/real-time-metrics-card"
import { DistributedNodesCard } from "@/components/distributed-nodes-card"
import { RealTimeActivityFeed } from "@/components/real-time-activity-feed"
import { activityFeedService } from "@/lib/activity-feed-service"

export default function DashboardPage() {
  const { apiKey, isValid: isApiKeyValid, error: apiKeyError } = useApiKey()
  const { user, isLoading: isUserLoading, isAuthenticated } = useUserSession()

  // Real-time metrics hooks
  const { data: taskMetrics, isLoading: taskMetricsLoading } = useTaskMetrics({
    enabled: isApiKeyValid && !!apiKey
  })
  const { data: systemMetrics, isLoading: systemMetricsLoading } = useSystemMetrics({
    enabled: isApiKeyValid && !!apiKey
  })
  const { data: apiMetrics, isLoading: apiMetricsLoading } = useApiMetrics({
    enabled: isApiKeyValid && !!apiKey
  })

  // Legacy state for fallback data
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null)
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [fallbackSystemMetrics, setFallbackSystemMetrics] = useState<SystemMetrics | null>(null)
  const [distributedNodes, setDistributedNodes] = useState<DistributedNode[]>([])
  const [activityFeed, setActivityFeed] = useState<any[]>([])
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)

  // Use real-time task metrics if available, otherwise fall back to legacy data
  const displayTaskStats = useMemo(() => {
    if (taskMetrics) {
      return {
        total: taskMetrics.total,
        completed: taskMetrics.completed,
        inProgress: taskMetrics.in_progress,
        pending: taskMetrics.pending,
        blocked: taskMetrics.blocked
      }
    }
    if (taskStats) {
      return {
        total: taskStats.taskStats.total,
        completed: taskStats.taskStats.completed,
        inProgress: taskStats.taskStats.in_progress,
        pending: taskStats.taskStats.pending,
        blocked: taskStats.taskStats.blocked
      }
    }
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      blocked: tasks.filter(t => t.status === 'blocked').length
    }
  }, [taskMetrics, taskStats, tasks])

  const taskChartData = useMemo(() => [
    { name: 'Completed', value: displayTaskStats.completed, color: '#10b981' },
    { name: 'In Progress', value: displayTaskStats.inProgress, color: '#3b82f6' },
    { name: 'Pending', value: displayTaskStats.pending, color: '#f59e0b' },
    { name: 'Blocked', value: displayTaskStats.blocked, color: '#ef4444' }
  ], [displayTaskStats])

  // Define loadDashboardData function before useEffect
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Try to load real task data from backend
      try {
        const [tasksResponse, statsResponse, recentResponse] = await Promise.all([
          taskService.getTasks({ limit: 20, sort: '-updatedAt' }),
          taskService.getTaskStats(),
          taskService.getRecentTasks(10)
        ])
        
        if (tasksResponse.success) {
          setTasks(tasksResponse.data)
        }
        
        if (statsResponse.success) {
          setTaskStats(statsResponse.data)
        }
        
        if (recentResponse.success) {
          setRecentTasks(recentResponse.data)
        }
        
        // If we have real tasks, use them; otherwise fall back to sample data
        if (!tasksResponse.success || tasksResponse.data.length === 0) {
          // Load sample data for new users with no tasks yet
          const sampleTasks = sampleDataService.generateSampleTasks()
          setTasks(sampleTasks)
        }
      } catch (taskError) {
        console.log('Using sample data as fallback:', taskError)
        // Load sample data as fallback
        const sampleTasks = sampleDataService.generateSampleTasks()
        setTasks(sampleTasks)
      }
      
      // Load other dashboard data (keeping sample data for fallback)
      const sampleProjects = sampleDataService.generateSampleProjects()
      const sampleMetrics = sampleDataService.generateSystemMetrics()
      const sampleNodes = sampleDataService.generateDistributedNodes()
      const sampleActivity = sampleDataService.generateActivityFeed()
      const sampleAnalytics = sampleDataService.generateAnalyticsData()

      setProjects(sampleProjects)
      setFallbackSystemMetrics(sampleMetrics)
      setDistributedNodes(sampleNodes)
      setActivityFeed(sampleActivity)
      setAnalyticsData(sampleAnalytics)
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, []) // Empty dependency array since this function doesn't depend on any props or state

  // Add useEffect hooks after function definition
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Update activity feed service with user data
  useEffect(() => {
    if (user) {
      activityFeedService.setCurrentUser(user)
    }
  }, [user])

  // Handle task creation
  const handleTaskCreated = useCallback(() => {
    setShowNewTaskForm(false)
    loadDashboardData() // Refresh dashboard data
  }, [loadDashboardData])

  // Test task creation function
  const testTaskCreation = useCallback(async () => {
    try {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const testTask = {
        title: 'Test Task ' + Date.now(),
        description: 'This is a test task created to verify the task creation system is working correctly.',
        project: 'Test Project',
        priority: 'medium' as const,
        dueDate: nextWeek.toISOString(),
        scheduledDate: tomorrow.toISOString(),
        estimatedHours: 2
      }

      console.log('🧪 Testing task creation with data:', testTask)
      const response = await taskService.createTask(testTask)

      if (response.success) {
        toast.success('Test task created successfully!')
        loadDashboardData()
      } else {
        toast.error('Test task creation failed')
      }
    } catch (error: any) {
      console.error('Test task creation error:', error)
      toast.error(`Test failed: ${error.message}`)
    }
  }, [loadDashboardData])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'pending': return 'bg-yellow-500'
      case 'blocked': return 'bg-red-500'
      case 'cancelled': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  // Early return for loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Management Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time overview of your distributed system, projects, and team activity
            {user && ` - Welcome back, ${user.firstName}!`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNewTaskForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
          <Button variant="outline" onClick={testTaskCreation}>
            🧪 Test Task Creation
          </Button>
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {/* API Key Setup */}
      {!isApiKeyValid && (
        <ApiKeySetup
          showTitle={false}
          className="border-yellow-200 bg-yellow-50"
        />
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayTaskStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {displayTaskStats.inProgress} in progress, {displayTaskStats.pending} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {displayTaskStats.total > 0 ? Math.round((displayTaskStats.completed / displayTaskStats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {displayTaskStats.completed} of {displayTaskStats.total} tasks completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {distributedNodes.filter(n => n.status === 'healthy').length}/{distributedNodes.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Healthy nodes across regions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiMetrics?.total_requests?.toLocaleString() ||
               analyticsData?.overview?.totalRequests?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {apiMetrics?.requests_per_second || systemMetrics?.requestsPerSecond || 0} req/sec current
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics?.cpuUsage || 0}%</div>
            <Progress value={systemMetrics?.cpuUsage || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics?.memoryUsage || 0}%</div>
            <Progress value={systemMetrics?.memoryUsage || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics?.networkIO || 0} MB/s</div>
            <p className="text-xs text-muted-foreground">
              {systemMetrics?.activeConnections || 0} active connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemMetrics?.uptime || '0d 0h'}</div>
            <p className="text-xs text-muted-foreground">
              {systemMetrics?.errorRate?.toFixed(1) || 0}% error rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Data */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Task Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Task Distribution</CardTitle>
            <CardDescription>Current status of all workflow tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {(taskChartData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* API Performance */}
        <Card>
          <CardHeader>
            <CardTitle>API Performance</CardTitle>
            <CardDescription>Request volume over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(analyticsData?.daily || []).slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      try {
                        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      } catch {
                        return value
                      }
                    }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="requestCount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Requests"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Metrics Section */}
      {isApiKeyValid && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <RealTimeMetricsCard className="lg:col-span-2" />
          <DistributedNodesCard />
        </div>
      )}

      {/* Real-time Activity Feed */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          {/* Projects and Tasks */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
            <CardDescription>Current project status and progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(projects || []).map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{project.name}</h4>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-xs">{project.teamMembers.length} members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        <span className="text-xs">${project.spent.toLocaleString()}/${project.budget.toLocaleString()}</span>
                      </div>
                    </div>
                    <Progress value={project.progress} className="mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
            <CardDescription>Latest workflow tasks and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(tasks || []).slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-2 border rounded">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{task.project} • {task.assignee}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(task.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distributed System Status */}
      <Card>
        <CardHeader>
          <CardTitle>Distributed System Status</CardTitle>
          <CardDescription>Status of nodes across different regions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(distributedNodes || []).map((node) => (
              <div key={node.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{node.name}</h4>
                  <Badge variant={node.status === 'healthy' ? 'default' : 'destructive'}>
                    {node.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{node.region}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>CPU</span>
                    <span>{node.cpuUsage}%</span>
                  </div>
                  <Progress value={node.cpuUsage} className="h-1" />
                  <div className="flex justify-between text-xs">
                    <span>Memory</span>
                    <span>{node.memoryUsage}%</span>
                  </div>
                  <Progress value={node.memoryUsage} className="h-1" />
                  <div className="text-xs text-muted-foreground">
                    Services: {node.services.length}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

        </div>

        {/* Real-time Activity Feed */}
        <RealTimeActivityFeed limit={15} />
      </div>
      
      {/* New Task Form Modal */}
      {showNewTaskForm && (
        <NewTaskForm
          onTaskCreated={handleTaskCreated}
          onCancel={() => setShowNewTaskForm(false)}
          isOpen={showNewTaskForm}
        />
      )}
    </div>
  )
}
