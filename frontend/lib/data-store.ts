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
    
    // Initialize with empty workflows (no sample data)
    if (!localStorage.getItem(this.WORKFLOWS_KEY)) {
      localStorage.setItem(this.WORKFLOWS_KEY, JSON.stringify([]))
    }

    if (!localStorage.getItem(this.TASKS_KEY)) {
      localStorage.setItem(this.TASKS_KEY, JSON.stringify([]))
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

  // Clear all dummy data (force reset to empty state)
  clearAllData() {
    if (typeof window === 'undefined') return
    localStorage.setItem(this.WORKFLOWS_KEY, JSON.stringify([]))
    localStorage.setItem(this.TASKS_KEY, JSON.stringify([]))
    localStorage.setItem(this.COUNTERS_KEY, JSON.stringify({ workflowCounter: 1, taskCounter: 1 }))
    console.log('🧹 All dummy data cleared - app will start with empty state')
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
