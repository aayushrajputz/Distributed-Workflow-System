import { Page, Locator, expect } from '@playwright/test';

export class WorkflowBuilderPage {
  readonly page: Page;
  readonly workflowCanvas: Locator;
  readonly nodePalette: Locator;
  readonly propertiesPanel: Locator;
  readonly workflowNameInput: Locator;
  readonly workflowCategorySelect: Locator;
  readonly saveWorkflowButton: Locator;
  readonly executeWorkflowButton: Locator;
  readonly zoomToFitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.workflowCanvas = page.getByTestId('workflow-canvas');
    this.nodePalette = page.getByTestId('node-palette');
    this.propertiesPanel = page.getByTestId('properties-panel');
    this.workflowNameInput = page.getByTestId('workflow-name-input');
    this.workflowCategorySelect = page.getByTestId('workflow-category-select');
    this.saveWorkflowButton = page.getByTestId('save-workflow-button');
    this.executeWorkflowButton = page.getByTestId('execute-workflow-button');
    this.zoomToFitButton = page.getByTestId('zoom-to-fit-button');
  }

  async navigateToWorkflowBuilder() {
    await this.page.goto('/dashboard/workflows/builder');
    await this.page.waitForLoadState('networkidle');
    await this.workflowCanvas.waitFor();
  }

  async setWorkflowName(name: string) {
    await this.workflowNameInput.fill(name);
  }

  async setWorkflowCategory(category: string) {
    await this.workflowCategorySelect.click();
    await this.page.getByText(category).click();
  }

  async dragNodeFromPalette(nodeType: string, position: { x: number; y: number }) {
    const paletteNode = this.nodePalette.locator(`[data-testid="palette-node-${nodeType}"]`);
    
    // Get the bounding box of the canvas
    const canvasBox = await this.workflowCanvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas not found');
    
    // Calculate absolute position
    const targetX = canvasBox.x + position.x;
    const targetY = canvasBox.y + position.y;
    
    // Drag from palette to canvas
    await paletteNode.dragTo(this.workflowCanvas, {
      targetPosition: { x: position.x, y: position.y }
    });
    
    // Wait for node to be created
    await this.page.waitForTimeout(500);
  }

  async connectNodes(sourceNodeId: string, targetNodeId: string) {
    const sourceNode = this.workflowCanvas.locator(`[data-node-id="${sourceNodeId}"]`);
    const targetNode = this.workflowCanvas.locator(`[data-node-id="${targetNodeId}"]`);
    
    // Find the output handle of source node
    const sourceHandle = sourceNode.locator('.react-flow__handle-right');
    const targetHandle = targetNode.locator('.react-flow__handle-left');
    
    // Drag from source handle to target handle
    await sourceHandle.dragTo(targetHandle);
    
    // Wait for connection to be established
    await this.page.waitForTimeout(500);
  }

  async selectNode(nodeId: string) {
    const node = this.workflowCanvas.locator(`[data-node-id="${nodeId}"]`);
    await node.click();
    
    // Wait for properties panel to update
    await this.page.waitForTimeout(300);
  }

  async configureTaskNode(nodeId: string, config: any) {
    await this.selectNode(nodeId);
    
    if (config.label) {
      const labelInput = this.propertiesPanel.getByTestId('node-label-input');
      await labelInput.fill(config.label);
    }
    
    if (config.assignee) {
      const assigneeSelect = this.propertiesPanel.getByTestId('task-assignee-select');
      await assigneeSelect.click();
      await this.page.getByText(config.assignee).click();
    }
    
    if (config.priority) {
      const prioritySelect = this.propertiesPanel.getByTestId('task-priority-select');
      await prioritySelect.click();
      await this.page.getByText(config.priority).click();
    }
    
    if (config.description) {
      const descriptionInput = this.propertiesPanel.getByTestId('task-description-input');
      await descriptionInput.fill(config.description);
    }
  }

  async configureApiCallNode(nodeId: string, config: any) {
    await this.selectNode(nodeId);
    
    if (config.label) {
      const labelInput = this.propertiesPanel.getByTestId('node-label-input');
      await labelInput.fill(config.label);
    }
    
    if (config.endpoint) {
      const endpointInput = this.propertiesPanel.getByTestId('api-endpoint-input');
      await endpointInput.fill(config.endpoint);
    }
    
    if (config.method) {
      const methodSelect = this.propertiesPanel.getByTestId('api-method-select');
      await methodSelect.click();
      await this.page.getByText(config.method).click();
    }
  }

  async configureEmailNode(nodeId: string, config: any) {
    await this.selectNode(nodeId);
    
    if (config.label) {
      const labelInput = this.propertiesPanel.getByTestId('node-label-input');
      await labelInput.fill(config.label);
    }
    
    if (config.subject) {
      const subjectInput = this.propertiesPanel.getByTestId('email-subject-input');
      await subjectInput.fill(config.subject);
    }
    
    if (config.recipients) {
      const recipientsInput = this.propertiesPanel.getByTestId('email-recipients-input');
      await recipientsInput.fill(config.recipients);
    }
  }

  async configureDelayNode(nodeId: string, config: any) {
    await this.selectNode(nodeId);
    
    if (config.label) {
      const labelInput = this.propertiesPanel.getByTestId('node-label-input');
      await labelInput.fill(config.label);
    }
    
    if (config.amount) {
      const amountInput = this.propertiesPanel.getByTestId('delay-amount-input');
      await amountInput.fill(config.amount.toString());
    }
    
    if (config.unit) {
      const unitSelect = this.propertiesPanel.getByTestId('delay-unit-select');
      await unitSelect.click();
      await this.page.getByText(config.unit).click();
    }
  }

  async saveWorkflow() {
    await this.saveWorkflowButton.click();
    // Wait for save operation to complete
    await this.page.waitForTimeout(1000);
  }

  async waitForWorkflowSaved() {
    // Wait for save success indicator
    const saveIndicator = this.page.getByTestId('workflow-saved');
    await saveIndicator.waitFor({ timeout: 5000 });
  }

  async startExecution() {
    await this.executeWorkflowButton.click();
    // Wait for execution to start
    await this.page.waitForTimeout(1000);
  }

  async waitForExecutionComplete() {
    // Wait for execution to complete (this could be enhanced with specific conditions)
    const executionStatus = this.page.getByTestId('execution-status');
    await executionStatus.waitFor();
    
    // Wait for completion status
    await this.page.waitForFunction(() => {
      const statusElement = document.querySelector('[data-testid="execution-status"]');
      return statusElement && (
        statusElement.textContent?.includes('completed') ||
        statusElement.textContent?.includes('finished') ||
        statusElement.textContent?.includes('success')
      );
    }, {}, { timeout: 30000 });
  }

  async verifyExecutionSuccess(): Promise<boolean> {
    const executionStatus = this.page.getByTestId('execution-status');
    const statusText = await executionStatus.textContent();
    
    return statusText?.toLowerCase().includes('success') ||
           statusText?.toLowerCase().includes('completed') ||
           statusText?.toLowerCase().includes('finished') || false;
  }

  async getExecutionStatus(): Promise<string> {
    const executionStatus = this.page.getByTestId('execution-status');
    return await executionStatus.textContent() || '';
  }

  async verifyNodeExists(nodeType: string, position: { x: number; y: number }): Promise<boolean> {
    const nodes = await this.workflowCanvas.locator(`[data-node-type="${nodeType}"]`).all();
    
    for (const node of nodes) {
      const box = await node.boundingBox();
      if (box && Math.abs(box.x - position.x) < 50 && Math.abs(box.y - position.y) < 50) {
        return true;
      }
    }
    
    return false;
  }

  async verifyNodesConnected(sourceNodeId: string, targetNodeId: string): Promise<boolean> {
    const edge = this.workflowCanvas.locator(`[data-edge-source="${sourceNodeId}"][data-edge-target="${targetNodeId}"]`);
    return await edge.isVisible();
  }

  async getNodeCount(): Promise<number> {
    return await this.workflowCanvas.locator('.react-flow__node').count();
  }

  async zoomToFit() {
    await this.zoomToFitButton.click();
    await this.page.waitForTimeout(500);
  }

  async panCanvas(direction: 'left' | 'right' | 'up' | 'down', distance: number) {
    const canvasBox = await this.workflowCanvas.boundingBox();
    if (!canvasBox) return;
    
    const centerX = canvasBox.x + canvasBox.width / 2;
    const centerY = canvasBox.y + canvasBox.height / 2;
    
    let startX = centerX, startY = centerY;
    let endX = centerX, endY = centerY;
    
    switch (direction) {
      case 'left':
        endX = centerX - distance;
        break;
      case 'right':
        endX = centerX + distance;
        break;
      case 'up':
        endY = centerY - distance;
        break;
      case 'down':
        endY = centerY + distance;
        break;
    }
    
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();
    
    await this.page.waitForTimeout(500);
  }

  async deleteSelectedNode() {
    await this.page.keyboard.press('Delete');
    await this.page.waitForTimeout(500);
  }

  async createSimpleWorkflow(name: string) {
    await this.setWorkflowName(name);
    await this.setWorkflowCategory('Development');
    
    // Add start node
    await this.dragNodeFromPalette('start', { x: 100, y: 100 });
    
    // Add task node
    await this.dragNodeFromPalette('task', { x: 300, y: 100 });
    
    // Add end node
    await this.dragNodeFromPalette('end', { x: 500, y: 100 });
    
    // Connect nodes
    await this.connectNodes('start', 'task');
    await this.connectNodes('task', 'end');
    
    // Configure task node
    await this.configureTaskNode('task', {
      label: 'Simple Task',
      assignee: 'user@test.com',
      priority: 'medium'
    });
    
    // Save workflow
    await this.saveWorkflow();
    await this.waitForWorkflowSaved();
  }

  async verifyWorkflowValid(): Promise<boolean> {
    // Check if save button is enabled and no validation errors are shown
    const saveButtonDisabled = await this.saveWorkflowButton.isDisabled();
    const validationErrors = await this.page.locator('.validation-error').count();
    
    return !saveButtonDisabled && validationErrors === 0;
  }

  async isPropertiesPanelVisible(): Promise<boolean> {
    return await this.propertiesPanel.isVisible();
  }

  async openNodeProperties(nodeId: string) {
    await this.selectNode(nodeId);
    await this.propertiesPanel.waitFor();
  }

  async setNodeLabel(label: string) {
    const labelInput = this.propertiesPanel.getByTestId('node-label-input');
    await labelInput.fill(label);
  }

  getNodeCategory(category: string) {
    return this.nodePalette.locator(`[data-testid="node-category-${category}"]`);
  }
}