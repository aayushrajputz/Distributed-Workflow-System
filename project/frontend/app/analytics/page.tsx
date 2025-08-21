'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Activity, TrendingUp, Clock, CheckCircle, XCircle, BarChart3 } from 'lucide-react'
import { api, AnalyticsData } from '@/lib/api'
import { toast } from 'sonner'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('30')

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeframe])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching analytics data...')

      const data = await api.getDashboardData(parseInt(timeframe))
      console.log('📊 Analytics data received:', data)

      if (data && typeof data === 'object') {
        setAnalyticsData(data)
      } else {
        console.warn('⚠️ Invalid analytics data format:', data)
        // Set empty data structure to prevent crashes
        setAnalyticsData({
          overview: {
            totalRequests: 0,
            successRate: 0,
            avgResponseTime: 0,
            errorRate: 0,
            successfulRequests: 0
          },
          endpoints: [],
          daily: [],
          recentLogs: [],
          insights: {
            avgDailyRequests: 0,
            peakHour: '12:00',
            mostUsedEndpoint: 'N/A',
            errorTrend: 'stable'
          }
        })
      }
    } catch (error: any) {
      console.error('❌ Error fetching analytics:', error)

      // Set empty data structure to prevent crashes
      setAnalyticsData({
        overview: {
          totalRequests: 0,
          successRate: 0,
          avgResponseTime: 0,
          errorRate: 0,
          successfulRequests: 0
        },
        endpoints: [],
        daily: [],
        recentLogs: [],
        insights: {
          avgDailyRequests: 0,
          peakHour: '12:00',
          mostUsedEndpoint: 'N/A',
          errorTrend: 'stable'
        }
      })

      if (error.status === 401) {
        toast.error('Authentication required. Please login again.', {
          duration: 6000,
          action: {
            label: 'Go to Login',
            onClick: () => {
              window.location.href = '/auth'
            }
          }
        })
      } else if (error.status === 403) {
        toast.error('API key required. Please configure your API key in settings.', {
          duration: 6000,
          action: {
            label: 'Configure API Key',
            onClick: () => {
              window.location.href = '/dashboard/api-keys'
            }
          }
        })
      } else {
        toast.error(`Failed to fetch analytics data: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-600'
    if (statusCode >= 400) return 'text-red-600'
    return 'text-yellow-600'
  }

  const getStatusIcon = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (statusCode >= 400) return <XCircle className="h-4 w-4 text-red-500" />
    return <Clock className="h-4 w-4 text-yellow-500" />
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">No analytics data available</p>
        </div>
      </div>
    )
  }

  const { overview, endpoints, daily, recentLogs, insights } = analyticsData || {}

  // Provide default values to prevent crashes
  const safeOverview = overview || {
    totalRequests: 0,
    successRate: 0,
    avgResponseTime: 0,
    errorRate: 0,
    successfulRequests: 0
  }
  
  const safeInsights = insights || {
    avgDailyRequests: 0,
    peakHour: '12:00',
    mostUsedEndpoint: 'N/A',
    errorTrend: 'stable'
  }

  const safeEndpoints = endpoints || []
  const safeDaily = daily || []
  const safeRecentLogs = recentLogs || []

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-gray-600 mt-2">
            Detailed insights into your API usage and performance.
          </p>
        </div>
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeOverview.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {safeInsights.avgDailyRequests} avg per day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeOverview.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {safeOverview.successfulRequests || 0} successful requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(safeOverview.avgResponseTime)}ms</div>
            <p className="text-xs text-muted-foreground">
              Across all endpoints
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeInsights.apiKeysCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active API keys
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>API Usage Trend</CardTitle>
            <CardDescription>Daily request volume over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safeDaily.map(d => ({ ...d, date: formatDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="requestCount" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Total Requests"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="successfulRequests" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Successful"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="failedRequests" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Failed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints</CardTitle>
            <CardDescription>Most frequently used API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safeEndpoints.slice(0, 8)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="endpoint" 
                    width={120}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="requestCount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoint Details */}
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Performance</CardTitle>
            <CardDescription>Detailed performance metrics by endpoint</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {safeEndpoints.slice(0, 10).map((endpoint, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="text-xs">
                      {endpoint.method}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-48">
                      {endpoint.endpoint}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {endpoint.requestCount} requests
                    </div>
                    <div className="text-xs text-gray-500">
                      {endpoint.avgResponseTime}ms • {endpoint.successRate}% success
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest API requests and responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {safeRecentLogs.slice(0, 10).map((log) => (
                <div key={log._id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.statusCode)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {log.method}
                        </Badge>
                        <span className="text-sm font-medium truncate max-w-32">
                          {log.endpoint}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {log.apiKey.name} • {log.responseTimeMs}ms
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getStatusColor(log.statusCode)}`}>
                      {log.statusCode}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights && (
        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Key metrics and trends from your API usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {safeInsights.mostUsedEndpoint && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">Most Used Endpoint</p>
                  <p className="font-semibold text-blue-600 truncate">
                    {safeInsights.mostUsedEndpoint.endpoint}
                  </p>
                  <p className="text-xs text-gray-500">
                    {safeInsights.mostUsedEndpoint.requestCount} requests
                  </p>
                </div>
              )}
              <div className="text-center">
                <p className="text-sm text-gray-600">Avg Daily Requests</p>
                <p className="font-semibold text-blue-600">
                  {safeInsights.avgDailyRequests}
                </p>
              </div>
              {safeInsights.peakUsageDay && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">Peak Usage Day</p>
                  <p className="font-semibold text-blue-600">
                    {formatDate(safeInsights.peakUsageDay.date)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {safeInsights.peakUsageDay.requestCount} requests
                  </p>
                </div>
              )}
              <div className="text-center">
                <p className="text-sm text-gray-600">Error Trend</p>
                <p className={`font-semibold ${
                  safeInsights.errorTrend > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {safeInsights.errorTrend > 0 ? '+' : ''}
                  {safeInsights.errorTrend}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
