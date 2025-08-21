// Real data store with localStorage persistence
export class DataStore {
  private static instance: DataStore
  private readonly WORKFLOWS_KEY = "workflows_data"
  private readonly TASKS_KEY = "tasks_data"
  private readonly SYSTEM_STATUS_KEY = "system_status_data"
  private readonly COUNTERS_KEY = "data_counters"

  private constructor() {
    this.initializeData()
  }

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore()
    }
    return DataStore.instance
  }

  private initializeData() {
    // Check if we're on client-side (avoid SSR issues)
    if (typeof window === 'undefined') return
    
    // Initialize with sample data if empty
    if (!localStorage.getItem(this.WORKFLOWS_KEY)) {
      const initialWorkflows = [
        {
          id: "wf-001",
          name: "Data Processing Pipeline",
          status: "running" as const,
          createdAt: "2024-01-15T10:30:00Z",
          lastUpdated: new Date().toISOString(),
          owner: "John Doe",
          nodeCount: 5,
          description: "Processes incoming data files and transforms them for analysis",
          nodes: [
            {
              id: "node-1",
              name: "Input Reader",
              type: "input" as const,
              status: "completed" as const,
              x: 100,
              y: 100,
            },
            {
              id: "node-2",
              name: "Data Validator",
              type: "process" as const,
              status: "completed" as const,
              x: 300,
              y: 100,
            },
            {
              id: "node-3",
              name: "Transform Data",
              type: "process" as const,
              status: "running" as const,
              x: 500,
              y: 100,
            },
            {
              id: "node-4",
              name: "Quality Check",
              type: "condition" as const,
              status: "pending" as const,
              x: 700,
              y: 100,
            },
            {
              id: "node-5",
              name: "Output Writer",
              type: "output" as const,
              status: "pending" as const,
              x: 900,
              y: 100,
            },
          ],
        },
        {
          id: "wf-002",
          name: "Email Campaign Workflow",
          status: "completed" as const,
          createdAt: "2024-01-14T09:15:00Z",
          lastUpdated: "2024-01-14T11:45:00Z",
          owner: "Jane Smith",
          nodeCount: 3,
          description: "Automated email marketing campaign with personalization",
          nodes: [
            {
              id: "node-1",
              name: "Load Recipients",
              type: "input" as const,
              status: "completed" as const,
              x: 100,
              y: 100,
            },
            {
              id: "node-2",
              name: "Personalize Content",
              type: "process" as const,
              status: "completed" as const,
              x: 400,
              y: 100,
            },
            {
              id: "node-3",
              name: "Send Emails",
              type: "output" as const,
              status: "completed" as const,
              x: 700,
              y: 100,
            },
          ],
        },
      ]
      localStorage.setItem(this.WORKFLOWS_KEY, JSON.stringify(initialWorkflows))
    }

    if (!localStorage.getItem(this.TASKS_KEY)) {
      const initialTasks = [
        {
          id: "task-001",
          name: "Read input file",
          workflowId: "wf-001",
          workflowName: "Data Processing Pipeline",
          status: "completed" as const,
          startTime: "2024-01-15T10:30:00Z",
          endTime: "2024-01-15T10:32:00Z",
          duration: "2m 15s",
          owner: "John Doe",
          description: "Reading and parsing input CSV file",
          input: { filePath: "/data/input.csv", format: "csv" },
          output: { recordsRead: 10000, validRecords: 9987 },
          logs: [
            { timestamp: "2024-01-15T10:30:00Z", level: "INFO" as const, message: "Starting file read operation" },
            { timestamp: "2024-01-15T10:31:30Z", level: "WARN" as const, message: "Found 13 invalid records" },
            { timestamp: "2024-01-15T10:32:00Z", level: "INFO" as const, message: "File read completed successfully" },
          ],
          metrics: { cpuUsage: "45%", memoryUsage: "2.1GB", diskIO: "150MB/s", networkIO: "0MB/s" },
        },
        {
          id: "task-002",
          name: "Validate data format",
          workflowId: "wf-001",
          workflowName: "Data Processing Pipeline",
          status: "running" as const,
          startTime: "2024-01-15T10:32:00Z",
          endTime: null,
          owner: "John Doe",
          description: "Validating data format and schema compliance",
          input: { schema: "user_data_v2", strictMode: true },
          logs: [
            { timestamp: "2024-01-15T10:32:00Z", level: "INFO" as const, message: "Starting data validation" },
            { timestamp: "2024-01-15T10:33:00Z", level: "INFO" as const, message: "Processed 5000 records" },
          ],
          metrics: { cpuUsage: "78%", memoryUsage: "3.2GB", diskIO: "200MB/s", networkIO: "0MB/s" },
        },
      ]
      localStorage.setItem(this.TASKS_KEY, JSON.stringify(initialTasks))
    }

    if (!localStorage.getItem(this.SYSTEM_STATUS_KEY)) {
      const initialSystemStatus = {
        totalNodes: 10,
        activeNodes: 8,
        failedNodes: 1,
        maintenanceNodes: 1,
        uptime: "99.94%",
        lastFailure: "2024-01-14T15:30:00Z",
        avgResponseTime: 45,
        totalRequests: 1247832,
        errorRate: 0.02,
        lastUpdated: new Date().toISOString(),
      }
      localStorage.setItem(this.SYSTEM_STATUS_KEY, JSON.stringify(initialSystemStatus))
    }

    if (!localStorage.getItem(this.COUNTERS_KEY)) {
      const initialCounters = {
        workflowCounter: 3,
        taskCounter: 3,
      }
      localStorage.setItem(this.COUNTERS_KEY, JSON.stringify(initialCounters))
    }
  }

  // Generic storage methods
  private getData<T>(key: string): T[] {
    if (typeof window === 'undefined') return []
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  private setData<T>(key: string, data: T[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, JSON.stringify(data))
  }

  private getCounters() {
    if (typeof window === 'undefined') return { workflowCounter: 1, taskCounter: 1 }
    try {
      const counters = localStorage.getItem(this.COUNTERS_KEY)
      return counters ? JSON.parse(counters) : { workflowCounter: 1, taskCounter: 1 }
    } catch {
      return { workflowCounter: 1, taskCounter: 1 }
    }
  }

  private updateCounters(updates: Partial<{ workflowCounter: number; taskCounter: number }>) {
    if (typeof window === 'undefined') return
    const counters = this.getCounters()
    const newCounters = { ...counters, ...updates }
    localStorage.setItem(this.COUNTERS_KEY, JSON.stringify(newCounters))
  }

  // Workflow methods
  getWorkflows() {
    return this.getData(this.WORKFLOWS_KEY)
  }

  getWorkflow(id: string) {
    const workflows = this.getWorkflows()
    return workflows.find((w: any) => w.id === id)
  }

  createWorkflow(workflowData: any) {
    const workflows = this.getWorkflows()
    const counters = this.getCounters()
    const newWorkflow = {
      ...workflowData,
      id: `wf-${String(counters.workflowCounter).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      status: "pending",
    }
    workflows.push(newWorkflow)
    this.setData(this.WORKFLOWS_KEY, workflows)
    this.updateCounters({ workflowCounter: counters.workflowCounter + 1 })
    return newWorkflow
  }

  updateWorkflow(id: string, updates: any) {
    const workflows = this.getWorkflows()
    const index = workflows.findIndex((w: any) => w.id === id)
    if (index !== -1) {
      workflows[index] = { ...workflows[index], ...updates, lastUpdated: new Date().toISOString() }
      this.setData(this.WORKFLOWS_KEY, workflows)
      return workflows[index]
    }
    return null
  }

  deleteWorkflow(id: string) {
    const workflows = this.getWorkflows()
    const filtered = workflows.filter((w: any) => w.id !== id)
    this.setData(this.WORKFLOWS_KEY, filtered)

    // Also delete associated tasks
    const tasks = this.getTasks()
    const filteredTasks = tasks.filter((t: any) => t.workflowId !== id)
    this.setData(this.TASKS_KEY, filteredTasks)
  }

  // Task methods
  getTasks() {
    return this.getData(this.TASKS_KEY)
  }

  getTask(id: string) {
    const tasks = this.getTasks()
    return tasks.find((t: any) => t.id === id)
  }

  getWorkflowTasks(workflowId: string) {
    const tasks = this.getTasks()
    return tasks.filter((t: any) => t.workflowId === workflowId)
  }

  createTask(taskData: any) {
    const tasks = this.getTasks()
    const counters = this.getCounters()
    const newTask = {
      ...taskData,
      id: `task-${String(counters.taskCounter).padStart(3, "0")}`,
      startTime: new Date().toISOString(),
      endTime: null,
      status: "running",
    }
    tasks.push(newTask)
    this.setData(this.TASKS_KEY, tasks)
    this.updateCounters({ taskCounter: counters.taskCounter + 1 })
    return newTask
  }

  updateTask(id: string, updates: any) {
    const tasks = this.getTasks()
    const index = tasks.findIndex((t: any) => t.id === id)
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates }
      this.setData(this.TASKS_KEY, tasks)
      return tasks[index]
    }
    return null
  }

  retryTask(id: string) {
    return this.updateTask(id, {
      status: "running",
      startTime: new Date().toISOString(),
      endTime: null,
      logs: [{ timestamp: new Date().toISOString(), level: "INFO", message: "Task retry initiated" }],
    })
  }

  cancelTask(id: string) {
    return this.updateTask(id, {
      status: "failed",
      endTime: new Date().toISOString(),
      logs: [{ timestamp: new Date().toISOString(), level: "WARN", message: "Task cancelled by user" }],
    })
  }

  // System status methods
  getSystemStatus() {
    if (typeof window === 'undefined') return null
    try {
      const data = localStorage.getItem(this.SYSTEM_STATUS_KEY)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  updateSystemStatus(updates: any) {
    if (typeof window === 'undefined') return {}
    const current = this.getSystemStatus() || {}
    const updated = { ...current, ...updates, lastUpdated: new Date().toISOString() }
    localStorage.setItem(this.SYSTEM_STATUS_KEY, JSON.stringify(updated))
    return updated
  }

  // Simulate real-time updates
  simulateTaskProgress(taskId: string) {
    const task = this.getTask(taskId)
    if (task && task.status === "running") {
      // Simulate task completion after random time
      setTimeout(
        () => {
          const completionStatus = Math.random() > 0.2 ? "completed" : "failed"
          this.updateTask(taskId, {
            status: completionStatus,
            endTime: new Date().toISOString(),
            duration: `${Math.floor(Math.random() * 10) + 1}m ${Math.floor(Math.random() * 60)}s`,
            logs: [
              ...task.logs,
              {
                timestamp: new Date().toISOString(),
                level: completionStatus === "completed" ? "INFO" : "ERROR",
                message: completionStatus === "completed" ? "Task completed successfully" : "Task failed with error",
              },
            ],
          })
        },
        Math.random() * 30000 + 10000,
      ) // 10-40 seconds
    }
  }
}

export const dataStore = DataStore.getInstance()
