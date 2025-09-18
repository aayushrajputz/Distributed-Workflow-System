import { Page, Locator, expect } from '@playwright/test';

export class TasksPage {
  readonly page: Page;
  readonly createTaskButton: Locator;
  readonly taskList: Locator;
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;
  readonly taskModal: Locator;
  
  // Task form elements
  readonly taskTitleInput: Locator;
  readonly taskDescriptionInput: Locator;
  readonly taskAssigneeSelect: Locator;
  readonly taskPrioritySelect: Locator;
  readonly taskDueDateInput: Locator;
  readonly taskProjectInput: Locator;
  readonly saveTaskButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createTaskButton = page.getByTestId('create-task-button');
    this.taskList = page.getByTestId('task-list');
    this.searchInput = page.getByTestId('task-search-input');
    this.filterDropdown = page.getByTestId('task-filter-dropdown');
    this.taskModal = page.getByTestId('task-modal');
    
    // Task form elements
    this.taskTitleInput = page.getByTestId('task-title-input');
    this.taskDescriptionInput = page.getByTestId('task-description-input');
    this.taskAssigneeSelect = page.getByTestId('task-assignee-select');
    this.taskPrioritySelect = page.getByTestId('task-priority-select');
    this.taskDueDateInput = page.getByTestId('task-due-date-input');
    this.taskProjectInput = page.getByTestId('task-project-input');
    this.saveTaskButton = page.getByTestId('save-task-button');
  }

  async navigateToTasks() {
    await this.page.goto('/dashboard/tasks');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForTasksToLoad() {
    await this.taskList.waitFor({ timeout: 10000 });
  }

  async createTask(taskData: any) {
    await this.createTaskButton.click();
    await this.taskModal.waitFor();
    
    await this.taskTitleInput.fill(taskData.title);
    await this.taskDescriptionInput.fill(taskData.description);
    
    if (taskData.assignee) {
      await this.taskAssigneeSelect.click();
      await this.page.getByText(taskData.assignee).click();
    }
    
    if (taskData.priority) {
      await this.taskPrioritySelect.click();
      await this.page.getByText(taskData.priority).click();
    }
    
    if (taskData.dueDate) {
      await this.taskDueDateInput.fill(taskData.dueDate);
    }
    
    if (taskData.project) {
      await this.taskProjectInput.fill(taskData.project);
    }
    
    await this.saveTaskButton.click();
    await this.taskModal.waitFor({ state: 'hidden' });
  }

  async getTaskList(): Promise<any[]> {
    await this.waitForTasksToLoad();
    
    const taskElements = await this.taskList.locator('[data-testid^="task-item-"]').all();
    const tasks = [];
    
    for (const taskElement of taskElements) {
      const title = await taskElement.locator('[data-testid="task-title"]').textContent();
      const status = await taskElement.locator('[data-testid="task-status"]').textContent();
      const priority = await taskElement.locator('[data-testid="task-priority"]').textContent();
      const id = await taskElement.getAttribute('data-task-id');
      
      tasks.push({
        id,
        title: title?.trim(),
        status: status?.trim(),
        priority: priority?.trim()
      });
    }
    
    return tasks;
  }

  async getTaskCount(): Promise<number> {
    await this.waitForTasksToLoad();
    return await this.taskList.locator('[data-testid^="task-item-"]').count();
  }

  async searchTasks(searchTerm: string) {
    await this.searchInput.fill(searchTerm);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1000); // Wait for search to complete
  }

  async filterByStatus(status: string) {
    await this.filterDropdown.click();
    await this.page.getByText(status).click();
    await this.page.waitForTimeout(1000); // Wait for filter to apply
  }

  async updateTaskStatus(taskId: string, newStatus: string) {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const statusDropdown = taskElement.locator('[data-testid="task-status-dropdown"]');
    
    await statusDropdown.click();
    await this.page.getByText(newStatus).click();
    
    // Wait for status update to complete
    await this.page.waitForTimeout(1000);
  }

  async assignTask(taskId: string, assigneeEmail: string) {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const assigneeDropdown = taskElement.locator('[data-testid="task-assignee-dropdown"]');
    
    await assigneeDropdown.click();
    await this.page.getByText(assigneeEmail).click();
    
    // Wait for assignment to complete
    await this.page.waitForTimeout(1000);
  }

  async verifyTaskExists(taskTitle: string): Promise<boolean> {
    const tasks = await this.getTaskList();
    return tasks.some(task => task.title === taskTitle);
  }

  async verifyTaskStatus(taskId: string, expectedStatus: string): Promise<boolean> {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const statusElement = taskElement.locator('[data-testid="task-status"]');
    
    await statusElement.waitFor();
    const actualStatus = await statusElement.textContent();
    
    return actualStatus?.trim().toLowerCase() === expectedStatus.toLowerCase();
  }

  async verifyTaskAssignment(taskId: string, assigneeEmail: string): Promise<boolean> {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const assigneeElement = taskElement.locator('[data-testid="task-assignee"]');
    
    await assigneeElement.waitFor();
    const actualAssignee = await assigneeElement.textContent();
    
    return actualAssignee?.includes(assigneeEmail) || false;
  }

  async getTaskStatus(taskId: string): Promise<string> {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const statusElement = taskElement.locator('[data-testid="task-status"]');
    
    await statusElement.waitFor();
    return await statusElement.textContent() || '';
  }

  async clickTask(taskId: string) {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    await taskElement.click();
  }

  async retryTask(taskId: string) {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const retryButton = taskElement.locator('[data-testid="retry-task-button"]');
    
    await retryButton.click();
    await this.page.waitForTimeout(1000);
  }

  async cancelTask(taskId: string) {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const cancelButton = taskElement.locator('[data-testid="cancel-task-button"]');
    
    await cancelButton.click();
    
    // Confirm cancellation if modal appears
    const confirmButton = this.page.getByTestId('confirm-cancel-button');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
    
    await this.page.waitForTimeout(1000);
  }

  async waitForTaskUpdate(taskId: string) {
    // Wait for task to be updated (this could be enhanced with specific conditions)
    await this.page.waitForTimeout(2000);
  }
}