"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { api, SystemStatus } from "@/lib/api"
import { toast } from "sonner"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  Server,
  Activity,
  Database,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  HardDrive,
  Network,
} from "lucide-react"

// Mock data for system metrics
const mockSystemHealth = {
  totalNodes: 10,
  activeNodes: 8,
  failedNodes: 1,
  maintenanceNodes: 1,
  uptime: "99.94%",
  lastFailure: "2024-01-14T15:30:00Z",
  avgResponseTime: 45,
  totalRequests: 1247832,
  errorRate: 0.02,
}

const mockNodes = [
  { id: "node-01", name: "Worker Node 01", status: "active", cpu: 65, memory: 78, uptime: "15d 4h" },
  { id: "node-02", name: "Worker Node 02", status: "active", cpu: 42, memory: 56, uptime: "15d 4h" },
  { id: "node-03", name: "Worker Node 03", status: "active", cpu: 89, memory: 91, uptime: "12d 8h" },
  { id: "node-04", name: "Worker Node 04", status: "active", cpu: 23, memory: 34, uptime: "15d 4h" },
  { id: "node-05", name: "Worker Node 05", status: "active", cpu: 67, memory: 72, uptime: "10d 2h" },
  { id: "node-06", name: "Worker Node 06", status: "active", cpu: 45, memory: 58, uptime: "15d 4h" },
  { id: "node-07", name: "Worker Node 07", status: "active", cpu: 78, memory: 83, uptime: "8d 12h" },
  { id: "node-08", name: "Worker Node 08", status: "active", cpu: 34, memory: 41, uptime: "15d 4h" },
  { id: "node-09", name: "Worker Node 09", status: "failed", cpu: 0, memory: 0, uptime: "0d 0h" },
  { id: "node-10", name: "Worker Node 10", status: "maintenance", cpu: 0, memory: 0, uptime: "0d 0h" },
]

const mockApiLatencyData = [
  { time: "00:00", latency: 42 },
  { time: "04:00", latency: 38 },
  { time: "08:00", latency: 52 },
  { time: "12:00", latency: 67 },
  { time: "16:00", latency: 45 },
  { time: "20:00", latency: 39 },
  { time: "24:00", latency: 41 },
]

const mockCacheData = [
  { time: "00:00", hitRate: 94.2, missRate: 5.8 },
  { time: "04:00", hitRate: 96.1, missRate: 3.9 },
  { time: "08:00", hitRate: 92.8, missRate: 7.2 },
  { time: "12:00", hitRate: 89.5, missRate: 10.5 },
  { time: "16:00", hitRate: 93.7, missRate: 6.3 },
  { time: "20:00", hitRate: 95.4, missRate: 4.6 },
  { time: "24:00", hitRate: 94.8, missRate: 5.2 },
]

const mockRequestVolumeData = [
  { time: "00:00", requests: 1200 },
  { time: "04:00", requests: 800 },
  { time: "08:00", requests: 2400 },
  { time: "12:00", requests: 3200 },
  { time: "16:00", requests: 2800 },
  { time: "20:00", requests: 1800 },
  { time: "24:00", requests: 1400 },
]

const mockCacheUsageData = [
  { name: "Used", value: 68, color: "#3b82f6" },
  { name: "Available", value: 32, color: "#e5e7eb" },
]

const getNodeStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 hover:bg-green-100"
    case "failed":
      return "bg-red-100 text-red-800 hover:bg-red-100"
    case "maintenance":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100"
  }
}

const getNodeStatusIcon = (status: string) => {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case "failed":
      return <AlertTriangle className="h-4 w-4 text-red-600" />
    case "maintenance":
      return <Clock className="h-4 w-4 text-yellow-600" />
    default:
      return <Server className="h-4 w-4 text-gray-600" />
  }
}

export default function SystemStatusPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSystemStatus = async () => {
    try {
      setError(null)
      const status = await api.getSystemStatus()
      setSystemStatus(status)
      setLastUpdated(new Date())
    } catch (error: any) {
      console.error('Error fetching system status:', error)
      setError(error.message || 'Failed to fetch system status')
      if (error.status === 401) {
        toast.error('Please log in to view system status')
      } else {
        toast.error('Failed to fetch system status')
      }
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchSystemStatus()
  }

  useEffect(() => {
    fetchSystemStatus()
    
    const interval = setInterval(() => {
      if (!error) {
        fetchSystemStatus()
      }
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
            <p className="text-muted-foreground">Monitor system health and performance</p>
          </div>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load System Status</h3>
            <p className="text-gray-500 text-center mb-6">{error}</p>
            <Button onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
          <p className="text-muted-foreground">
            Monitor system health and performance • Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* System Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Nodes</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.activeNodes}/{systemStatus?.totalNodes}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemStatus?.failedNodes} failed, {systemStatus?.maintenanceNodes} maintenance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus?.uptime}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(systemStatus?.avgResponseTime || 0)}ms</div>
            <p className="text-xs text-muted-foreground">-5ms from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(systemStatus?.errorRate * 100 || 0).toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">Within acceptable range</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>API Response Time</CardTitle>
            <CardDescription>Average response time over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockApiLatencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}ms`, "Response Time"]} />
                <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cache Performance</CardTitle>
            <CardDescription>Cache hit rate and miss rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockCacheData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, ""]} />
                <Area type="monotone" dataKey="hitRate" stackId="1" stroke="#10b981" fill="#10b981" />
                <Area type="monotone" dataKey="missRate" stackId="1" stroke="#ef4444" fill="#ef4444" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Volume</CardTitle>
            <CardDescription>Number of requests processed per hour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockRequestVolumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}`, "Requests"]} />
                <Bar dataKey="requests" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cache Usage</CardTitle>
            <CardDescription>Current cache utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={mockCacheUsageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {mockCacheUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Used (68%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                <span className="text-sm">Available (32%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Node Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cluster Nodes</CardTitle>
          <CardDescription>Individual node status and resource utilization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockNodes.map((node) => (
              <div key={node.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  {getNodeStatusIcon(node.status)}
                  <div>
                    <h4 className="font-medium">{node.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      ID: {node.id} • Uptime: {node.uptime}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">CPU</p>
                    <div className="flex items-center gap-2">
                      <Progress value={node.cpu} className="w-16" />
                      <span className="text-sm font-medium w-8">{node.cpu}%</span>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Memory</p>
                    <div className="flex items-center gap-2">
                      <Progress value={node.memory} className="w-16" />
                      <span className="text-sm font-medium w-8">{node.memory}%</span>
                    </div>
                  </div>

                  <Badge className={getNodeStatusColor(node.status)}>
                    {node.status.charAt(0).toUpperCase() + node.status.slice(1)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Metrics Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStatus?.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Since system start</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Throughput</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4 GB/s</div>
            <p className="text-xs text-muted-foreground">Current average</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
