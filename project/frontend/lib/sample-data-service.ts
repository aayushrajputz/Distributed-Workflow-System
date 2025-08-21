// Sample data service for new users - provides realistic SaaS + Distributed system data
export interface WorkflowTask {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee: string
  project: string
  createdAt: string
  updatedAt: string
  dueDate: string
  tags: string[]
  estimatedHours: number
  actualHours?: number
}

export interface Project {
  id: string
  name: string
  description: string
  status: 'active' | 'completed' | 'on_hold'
  progress: number
  teamMembers: string[]
  startDate: string
  endDate: string
  budget: number
  spent: number
}

export interface SystemMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkIO: number
  activeConnections: number
  requestsPerSecond: number
  errorRate: number
  uptime: string
}

export interface DistributedNode {
  id: string
  name: string
  region: string
  status: 'healthy' | 'warning' | 'critical'
  cpuUsage: number
  memoryUsage: number
  lastHeartbeat: string
  services: string[]
}

class SampleDataService {
  // Generate realistic workflow tasks for new users
  generateSampleTasks(): WorkflowTask[] {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    return [
      {
        id: '1',
        title: 'Setup CI/CD Pipeline',
        description: 'Configure automated deployment pipeline for microservices',
        status: 'in_progress',
        priority: 'high',
        assignee: 'You',
        project: 'Infrastructure Setup',
        createdAt: lastWeek.toISOString(),
        updatedAt: yesterday.toISOString(),
        dueDate: nextWeek.toISOString(),
        tags: ['devops', 'automation', 'infrastructure'],
        estimatedHours: 16,
        actualHours: 8
      },
      {
        id: '2',
        title: 'Implement User Authentication',
        description: 'Add JWT-based authentication with role-based access control',
        status: 'completed',
        priority: 'critical',
        assignee: 'You',
        project: 'Core Platform',
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: yesterday.toISOString(),
        dueDate: yesterday.toISOString(),
        tags: ['security', 'backend', 'authentication'],
        estimatedHours: 12,
        actualHours: 14
      },
      {
        id: '3',
        title: 'Design System Architecture',
        description: 'Create microservices architecture diagram and documentation',
        status: 'pending',
        priority: 'medium',
        assignee: 'Team Lead',
        project: 'Architecture',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['architecture', 'documentation', 'planning'],
        estimatedHours: 8
      },
      {
        id: '4',
        title: 'Database Optimization',
        description: 'Optimize database queries and implement caching layer',
        status: 'blocked',
        priority: 'high',
        assignee: 'Database Admin',
        project: 'Performance',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['database', 'performance', 'optimization'],
        estimatedHours: 20
      },
      {
        id: '5',
        title: 'API Rate Limiting',
        description: 'Implement rate limiting for public APIs to prevent abuse',
        status: 'in_progress',
        priority: 'medium',
        assignee: 'Backend Dev',
        project: 'Security',
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['api', 'security', 'backend'],
        estimatedHours: 6,
        actualHours: 3
      }
    ]
  }

  // Generate realistic projects
  generateSampleProjects(): Project[] {
    const now = new Date()
    return [
      {
        id: '1',
        name: 'Infrastructure Setup',
        description: 'Setup core infrastructure for distributed system',
        status: 'active',
        progress: 65,
        teamMembers: ['You', 'DevOps Engineer', 'System Admin'],
        startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        budget: 50000,
        spent: 32500
      },
      {
        id: '2',
        name: 'Core Platform',
        description: 'Build main application platform with microservices',
        status: 'active',
        progress: 45,
        teamMembers: ['You', 'Frontend Dev', 'Backend Dev', 'QA Engineer'],
        startDate: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString(),
        budget: 120000,
        spent: 54000
      },
      {
        id: '3',
        name: 'Security',
        description: 'Implement comprehensive security measures',
        status: 'active',
        progress: 30,
        teamMembers: ['Security Engineer', 'Backend Dev'],
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        budget: 35000,
        spent: 10500
      }
    ]
  }

  // Generate realistic system metrics
  generateSystemMetrics(): SystemMetrics {
    return {
      cpuUsage: Math.floor(Math.random() * 30) + 45, // 45-75%
      memoryUsage: Math.floor(Math.random() * 25) + 60, // 60-85%
      diskUsage: Math.floor(Math.random() * 20) + 35, // 35-55%
      networkIO: Math.floor(Math.random() * 500) + 200, // 200-700 MB/s
      activeConnections: Math.floor(Math.random() * 500) + 1200, // 1200-1700
      requestsPerSecond: Math.floor(Math.random() * 200) + 150, // 150-350 RPS
      errorRate: Math.random() * 2 + 0.5, // 0.5-2.5%
      uptime: '15d 8h 32m'
    }
  }

  // Generate distributed system nodes
  generateDistributedNodes(): DistributedNode[] {
    const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
    const services = ['auth-service', 'user-service', 'workflow-service', 'notification-service', 'analytics-service']
    
    return regions.map((region, index) => ({
      id: `node-${index + 1}`,
      name: `${region}-primary`,
      region,
      status: Math.random() > 0.1 ? 'healthy' : 'warning',
      cpuUsage: Math.floor(Math.random() * 40) + 30,
      memoryUsage: Math.floor(Math.random() * 35) + 50,
      lastHeartbeat: new Date(Date.now() - Math.random() * 60000).toISOString(),
      services: services.slice(0, Math.floor(Math.random() * 3) + 2)
    }))
  }

  // Generate realistic analytics data
  generateAnalyticsData() {
    const now = new Date()
    const days = 30
    
    // Generate daily data for the last 30 days
    const daily = Array.from({ length: days }, (_, i) => {
      const date = new Date(now.getTime() - (days - i - 1) * 24 * 60 * 60 * 1000)
      const baseRequests = 1200 + Math.sin(i * 0.2) * 300 // Simulate weekly patterns
      const requests = Math.floor(baseRequests + Math.random() * 400)
      
      return {
        date: date.toISOString().split('T')[0],
        requestCount: requests,
        successfulRequests: Math.floor(requests * (0.95 + Math.random() * 0.04)),
        errorCount: Math.floor(requests * (0.01 + Math.random() * 0.04)),
        avgResponseTime: Math.floor(120 + Math.random() * 80)
      }
    })

    // Generate endpoint data
    const endpoints = [
      { endpoint: '/api/auth/login', method: 'POST', requestCount: 2847, successRate: 98.2, avgResponseTime: 145 },
      { endpoint: '/api/workflows', method: 'GET', requestCount: 5234, successRate: 99.1, avgResponseTime: 89 },
      { endpoint: '/api/tasks', method: 'POST', requestCount: 1923, successRate: 97.8, avgResponseTime: 156 },
      { endpoint: '/api/users/profile', method: 'GET', requestCount: 3456, successRate: 99.5, avgResponseTime: 67 },
      { endpoint: '/api/analytics', method: 'GET', requestCount: 876, successRate: 96.4, avgResponseTime: 234 },
      { endpoint: '/api/notifications', method: 'GET', requestCount: 4321, successRate: 99.2, avgResponseTime: 78 },
      { endpoint: '/api/projects', method: 'GET', requestCount: 2109, successRate: 98.9, avgResponseTime: 123 },
      { endpoint: '/api/teams', method: 'GET', requestCount: 1654, successRate: 99.0, avgResponseTime: 95 }
    ]

    // Generate recent logs
    const recentLogs = Array.from({ length: 20 }, (_, i) => {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
      const isError = Math.random() < 0.05
      
      return {
        _id: `log-${i}`,
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        statusCode: isError ? (Math.random() < 0.5 ? 404 : 500) : 200,
        responseTime: Math.floor(endpoint.avgResponseTime + (Math.random() - 0.5) * 100),
        timestamp: new Date(now.getTime() - i * 300000).toISOString(), // Every 5 minutes
        userAgent: 'WorkflowApp/1.0',
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`
      }
    })

    const totalRequests = daily.reduce((sum, day) => sum + day.requestCount, 0)
    const totalSuccessful = daily.reduce((sum, day) => sum + day.successfulRequests, 0)
    const totalErrors = daily.reduce((sum, day) => sum + day.errorCount, 0)
    const avgResponseTime = daily.reduce((sum, day) => sum + day.avgResponseTime, 0) / daily.length

    return {
      overview: {
        totalRequests,
        successfulRequests: totalSuccessful,
        successRate: Math.round((totalSuccessful / totalRequests) * 100 * 10) / 10,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: Math.round((totalErrors / totalRequests) * 100 * 10) / 10
      },
      daily,
      endpoints,
      recentLogs,
      insights: {
        avgDailyRequests: Math.floor(totalRequests / days),
        peakHour: '14:00',
        mostUsedEndpoint: {
          endpoint: endpoints[0].endpoint,
          requestCount: endpoints[0].requestCount
        },
        errorTrend: Math.random() > 0.5 ? -0.2 : 0.1,
        apiKeysCount: 12,
        peakUsageDay: {
          date: daily[Math.floor(Math.random() * daily.length)].date,
          requestCount: Math.max(...daily.map(d => d.requestCount))
        }
      }
    }
  }

  // Generate team activity feed
  generateActivityFeed() {
    const activities = [
      'completed task "Setup CI/CD Pipeline"',
      'created new project "Mobile App Development"',
      'updated workflow "User Onboarding Process"',
      'assigned task "Database Migration" to Backend Team',
      'deployed version 2.1.4 to production',
      'resolved 3 critical bugs in authentication service',
      'added new team member Sarah Johnson',
      'updated system configuration for load balancing',
      'created backup of production database',
      'optimized API response times by 23%'
    ]

    const users = ['You', 'John Smith', 'Sarah Johnson', 'Mike Chen', 'Emily Davis', 'System']
    
    return Array.from({ length: 15 }, (_, i) => ({
      id: `activity-${i}`,
      user: users[Math.floor(Math.random() * users.length)],
      action: activities[Math.floor(Math.random() * activities.length)],
      timestamp: new Date(Date.now() - i * 1800000).toISOString(), // Every 30 minutes
      type: Math.random() > 0.7 ? 'system' : 'user'
    }))
  }
}

export const sampleDataService = new SampleDataService()
