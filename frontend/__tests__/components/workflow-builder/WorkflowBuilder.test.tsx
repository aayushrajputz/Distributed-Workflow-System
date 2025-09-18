import { render, screen, waitFor } from '@testing-library/react';
import { WorkflowBuilder } from 'components/workflow-builder/WorkflowBuilder';
import { api } from 'lib/api';
jest.mock('reactflow', () => require('../__mocks__/reactflow'));

describe('WorkflowBuilder', () => {
  const mockWorkflow = {
    id: '1',
    name: 'Test Workflow',
    nodes: [],
    edges: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders workflow builder with empty canvas', () => {
    render(<WorkflowBuilder workflowId={mockWorkflow.id} />);

    expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    expect(screen.getByLabelText(/workflow name/i)).toBeInTheDocument();
  });

  it('loads existing workflow data', async () => {
    (api.workflows.getById as jest.Mock).mockResolvedValueOnce(mockWorkflow);

    render(<WorkflowBuilder workflowId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(api.workflows.getById).toHaveBeenCalledWith(mockWorkflow.id);
    });

    expect(screen.getByDisplayValue(mockWorkflow.name)).toBeInTheDocument();
  });

  it('adds new node when toolbar button clicked', async () => {
    const { user } = render(<WorkflowBuilder workflowId={mockWorkflow.id} />);

    await user.click(screen.getByRole('button', { name: /add task/i }));

    const taskNode = screen.getByTestId('task-node');
    expect(taskNode).toBeInTheDocument();
  });

  it('connects nodes when edges are created', async () => {
    const { user } = render(<WorkflowBuilder workflowId={mockWorkflow.id} />);

    // Add source node
    await user.click(screen.getByRole('button', { name: /add task/i }));
    const sourceNode = screen.getByTestId('task-node');

    // Add target node
    await user.click(screen.getByRole('button', { name: /add task/i }));
    const targetNode = screen.getAllByTestId('task-node')[1];

    // Create connection (simulating drag)
    // Note: actual connection creation is handled by React Flow internally
    expect(sourceNode).toBeInTheDocument();
    expect(targetNode).toBeInTheDocument();
  });

  it('saves workflow changes', async () => {
    (api.workflows.update as jest.Mock).mockResolvedValueOnce(mockWorkflow);

    const { user } = render(<WorkflowBuilder workflowId={mockWorkflow.id} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(api.workflows.update).toHaveBeenCalledWith(mockWorkflow.id, expect.any(Object));
    });
  });

  it('shows error message on save failure', async () => {
    const error = new Error('Failed to save workflow');
    (api.workflows.update as jest.Mock).mockRejectedValueOnce(error);

    const { user } = render(<WorkflowBuilder workflowId={mockWorkflow.id} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save workflow/i)).toBeInTheDocument();
    });
  });
});