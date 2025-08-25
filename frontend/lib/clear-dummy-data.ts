// Utility to clear all dummy/sample data from localStorage
export function clearAllDummyData() {
  if (typeof window === 'undefined') return
  
  // Clear all workflow and task data
  const keys = [
    'workflows_data',
    'tasks_data', 
    'system_status_data',
    'data_counters'
  ]
  
  keys.forEach(key => {
    localStorage.removeItem(key)
  })
  
  // Reset with empty arrays
  localStorage.setItem('workflows_data', JSON.stringify([]))
  localStorage.setItem('tasks_data', JSON.stringify([]))
  localStorage.setItem('data_counters', JSON.stringify({ workflowCounter: 1, taskCounter: 1 }))
  
  console.log('🧹 All dummy data cleared from localStorage')
  
  // Reload the page to ensure clean state
  window.location.reload()
}

// Call this function to clear dummy data immediately
export function initializeEmptyState() {
  if (typeof window === 'undefined') return
  
  // Only clear if there's existing dummy data
  const workflows = localStorage.getItem('workflows_data')
  if (workflows) {
    try {
      const parsed = JSON.parse(workflows)
      // Check if it contains sample data (by looking for known dummy IDs)
      if (parsed.some((w: any) => w.id === 'wf-001' || w.id === 'wf-002' || w.owner === 'John Doe' || w.owner === 'Jane Smith')) {
        clearAllDummyData()
      }
    } catch (e) {
      // If there's an error parsing, clear it anyway
      clearAllDummyData()
    }
  }
}
