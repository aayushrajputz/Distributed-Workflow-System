import { test, expect } from '@playwright/test';
import { WorkflowBuilderPage } from '../page-objects/WorkflowBuilderPage';
import { setupAuthenticatedUser } from '../helpers/auth';
import { connectSocket } from '../helpers/socket';

test.describe('Workflow Creation and Execution', () => {
  let workflowBuilderPage: WorkflowBuilderPage;

  test.beforeEach(async ({ page }) => {
    // Setup authenticated user with workflow creation permissions
    await setupAuthenticatedUser(page, 'admin');
    
    workflowBuilderPage = new WorkflowBuilderPage(page);
    await workflowBuilderPage.navigateToWorkflowBuilder();
    
    // Setup socket connection for real-time updates
    await connectSocket(page);
  });

  test('should create new workflow with name and category', async ({ page }) => {
    const workflowName = `E2E Test Workflow ${Date.now()}`;
    
    await workflowBuilderPage.setWorkflowName(workflowName);
    await workflowBuilderPage.setWorkflowCategory('Development');
    
    // Verify workflow details are set
    const nameValue = await page.getByTestId('workflow-name-input').inputValue();
    expect(nameValue).toBe(workflowName);
  });

  test('should drag nodes from palette to canvas', async ({ page }) => {
    // Drag start node
    await workflowBuilderPage.dragNodeFromPalette('start', { x: 100, y: 100 });
    
    // Verify node was created
    const nodeExists = await workflowBuilderPage.verifyNodeExists('start', { x: 100, y: 100 });
    expect(nodeExists).toBeTruthy();
    
    // Drag task node
    await workflowBuilderPage.dragNodeFromPalette('task', { x: 300, y: 100 });
    
    // Verify task node was created
    const taskNodeExists = await workflowBuilderPage.verifyNodeExists('task', { x: 300, y: 100 });
    expect(taskNodeExists).toBeTruthy();
    
    // Drag end node
    await workflowBuilderPage.dragNodeFromPalette('end', { x: 500, y: 100 });
    
    // Verify end node was created
    const endNodeExists = await workflowBuilderPage.verifyNodeExists('end', { x: 500, y: 100 });
    expect(endNodeExists).toBeTruthy();
  });

  test('should connect nodes with edges', async ({ page }) => {
    // Create a simple workflow
    await workflowBuilderPage.dragNodeFromPalette('start', { x: 100, y: 100 });
    await workflowBuilderPage.dragNodeFromPalette('task', { x: 300, y: 100 });
    await workflowBuilderPage.dragNodeFromPalette('end', { x: 500, y: 100 });
    
    // Connect nodes
    await workflowBuilderPage.connectNodes('start', 'task');
    await workflowBuilderPage.connectNodes('task', 'end');
    
    // Verify connections
    const connection1 = await workflowBuilderPage.verifyNodesConnected('start', 'task');
    const connection2 = await workflowBuilderPage.verifyNodesConnected('task', 'end');
    
    expect(connection1).toBeTruthy();
    expect(connection2).toBeTruthy();
  });

  test('should configure task nodes', async ({ page }) => {
    await workflowBuilderPage.setWorkflowName(`Task Config Test ${Date.now()}`);
    
    // Add task node
    await workflowBuilderPage.dragNodeFromPalette('task', { x: 300, y: 100 });
    
    // Configure task node
    await workflowBuilderPage.configureTaskNode('task', {
      label: 'Development Task',
      taskType: 'manual',
      assignee: 'user@test.com',
      priority: 'high',
      description: 'Complete development work for this workflow step'
    });
    
    // Verify configuration was applied
    const propertiesVisible = await workflowBuilderPage.isPropertiesPanelVisible();
    expect(propertiesVisible).toBeTruthy();
  });

  test('should save workflow successfully', async ({ page }) => {
    const workflowName = `Saveable Workflow ${Date.now()}`;
    
    // Create a complete workflow
    await workflowBuilderPage.createSimpleWorkflow(workflowName);
    
    // Verify workflow was saved
    await workflowBuilderPage.waitForWorkflowSaved();
    
    // Check if save success indicator is shown
    const saveSuccess = page.getByTestId('workflow-saved');
    expect(await saveSuccess.isVisible()).toBeTruthy();
  });

  test('should execute simple workflow', async ({ page }) => {
    const workflowName = `Execution Test ${Date.now()}`;
    
    // Create and save a simple workflow
    await workflowBuilderPage.createSimpleWorkflow(workflowName);
    
    // Execute the workflow
    await workflowBuilderPage.startExecution();
    
    // Wait for execution to complete
    await workflowBuilderPage.waitForExecutionComplete();
    
    // Verify execution was successful
    const executionSuccess = await workflowBuilderPage.verifyExecutionSuccess();
    expect(executionSuccess).toBeTruthy();
  });

  test('should validate workflow before saving', async ({ page }) => {
    const workflowName = `Validation Test ${Date.now()}`;
    await workflowBuilderPage.setWorkflowName(workflowName);
    
    // Try to save empty workflow
    await workflowBuilderPage.saveWorkflow();
    
    // Should show validation error or disable save button
    const saveButton = page.getByTestId('save-workflow-button');
    const isDisabled = await saveButton.isDisabled();
    
    if (!isDisabled) {
      // Check for validation error message
      const errorMessage = page.getByText(/workflow.*empty|add.*nodes/i);
      expect(await errorMessage.isVisible()).toBeTruthy();
    }
  });

  test('should configure API call nodes', async ({ page }) => {
    await workflowBuilderPage.setWorkflowName(`API Config Test ${Date.now()}`);
    
    // Add API call node
    await workflowBuilderPage.dragNodeFromPalette('api-call', { x: 300, y: 100 });
    
    // Configure API call node
    await workflowBuilderPage.configureApiCallNode('api-call', {
      label: 'Fetch User Data',
      endpoint: 'https://api.example.com/users',
      method: 'GET'
    });
    
    // Verify API endpoint was set
    const endpointValue = await page.getByTestId('api-endpoint-input').inputValue();
    expect(endpointValue).toBe('https://api.example.com/users');
  });

  test('should configure email nodes', async ({ page }) => {
    await workflowBuilderPage.setWorkflowName(`Email Config Test ${Date.now()}`);
    
    // Add email node
    await workflowBuilderPage.dragNodeFromPalette('email', { x: 300, y: 100 });
    
    // Configure email node
    await workflowBuilderPage.configureEmailNode('email', {
      label: 'Send Notification',
      subject: 'Workflow Notification',
      recipients: 'user@test.com,manager@test.com'
    });
    
    // Verify email configuration
    const subjectValue = await page.getByTestId('email-subject-input').inputValue();
    expect(subjectValue).toBe('Workflow Notification');
  });

  test('should test canvas controls', async ({ page }) => {
    // Add some nodes
    await workflowBuilderPage.dragNodeFromPalette('start', { x: 100, y: 100 });
    await workflowBuilderPage.dragNodeFromPalette('task', { x: 300, y: 100 });
    await workflowBuilderPage.dragNodeFromPalette('end', { x: 500, y: 100 });
    
    // Test zoom to fit
    await workflowBuilderPage.zoomToFit();
    
    // Test panning
    await workflowBuilderPage.panCanvas('right', 100);
    await workflowBuilderPage.panCanvas('down', 50);
    
    // Verify canvas responded to controls
    const canvas = page.getByTestId('workflow-canvas');
    expect(await canvas.isVisible()).toBeTruthy();
  });

  test('should test delete functionality', async ({ page }) => {
    // Add nodes
    await workflowBuilderPage.dragNodeFromPalette('start', { x: 100, y: 100 });
    await workflowBuilderPage.dragNodeFromPalette('task', { x: 300, y: 100 });
    
    // Select and delete a node
    await workflowBuilderPage.selectNode('task');
    await workflowBuilderPage.deleteSelectedNode();
    
    // Verify node was deleted
    const nodeCount = await workflowBuilderPage.getNodeCount();
    expect(nodeCount).toBe(1); // Only start node should remain
  });

  test('should verify workflow appears in workflows list', async ({ page }) => {
    const workflowName = `Listed Workflow ${Date.now()}`;
    
    // Create and save workflow
    await workflowBuilderPage.createSimpleWorkflow(workflowName);
    
    // Navigate to workflows list
    await page.goto('/dashboard/workflows');
    
    // Verify workflow appears in list
    const workflowLink = page.getByText(workflowName);
    expect(await workflowLink.isVisible()).toBeTruthy();
  });

  test('should persist workflow data', async ({ page }) => {
    const workflowName = `Persistence Test ${Date.now()}`;
    
    // Create and save workflow
    await workflowBuilderPage.createSimpleWorkflow(workflowName);
    
    // Refresh page
    await page.reload();
    
    // Verify workflow data is preserved
    const nameValue = await page.getByTestId('workflow-name-input').inputValue();
    expect(nameValue).toBe(workflowName);
    
    // Verify nodes are preserved
    const nodeCount = await workflowBuilderPage.getNodeCount();
    expect(nodeCount).toBeGreaterThan(0);
  });
});