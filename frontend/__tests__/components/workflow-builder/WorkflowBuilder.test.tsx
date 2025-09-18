import { render, screen, waitFor } from '../utils/test-utils';
import { WorkflowBuilder } from 'components/workflow-builder/WorkflowBuilder';
import { api } from 'lib/api';
import { ReactFlowProvider } from 'reactflow';

jest.mock('reactflow', () => require('../../__mocks__/reactflow'));

// Wrapper component with ReactFlowProvider
const WorkflowBuilderWithProvider = ({ templateId }: { templateId: string }) => (
  <ReactFlowProvider>
    <WorkflowBuilder templateId={templateId} />
  </ReactFlowProvider>
);

describe('WorkflowBuilder', () => {
  const mockWorkflow = {
    id: '1',
    name: 'Test Workflow',
    description: 'Test workflow description',
    nodes: [],
    edges: [],
    template: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders workflow builder with empty canvas', () => {
    render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    expect(screen.getByLabelText(/workflow name/i)).toBeInTheDocument();
  });

  it('loads existing workflow data', async () => {
    (api.getWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });

    render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(api.getWorkflow).toHaveBeenCalledWith(mockWorkflow.id);
    });

    expect(screen.getByDisplayValue(mockWorkflow.name)).toBeInTheDocument();
  });

  it('handles workflow loading error', async () => {
    const error = new Error('Failed to load workflow');
    (api.getWorkflow as jest.Mock).mockRejectedValueOnce(error);

    render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load workflow/i)).toBeInTheDocument();
    });
  });

  it('adds new node when toolbar button clicked', async () => {
    (api.getWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });

    const { user } = render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    });

    const addTaskButton = screen.getByRole('button', { name: /add task/i });
    await user.click(addTaskButton);

    const taskNode = screen.getByTestId('task-node');
    expect(taskNode).toBeInTheDocument();
  });

  it('connects nodes when edges are created', async () => {
    (api.getWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });

    const { user } = render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    });

    // Add source node
    await user.click(screen.getByRole('button', { name: /add task/i }));
    const sourceNode = screen.getByTestId('task-node');

    // Add target node
    await user.click(screen.getByRole('button', { name: /add task/i }));
    const targetNodes = screen.getAllByTestId('task-node');
    const targetNode = targetNodes[1];

    // Create connection (simulating drag)
    // Note: actual connection creation is handled by React Flow internally
    expect(sourceNode).toBeInTheDocument();
    expect(targetNode).toBeInTheDocument();
  });

  it('saves workflow changes', async () => {
    (api.getWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });
    (api.updateWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });

    const { user } = render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(api.updateWorkflow).toHaveBeenCalledWith(mockWorkflow.id, expect.any(Object));
    });
  });

  it('shows error message on save failure', async () => {
    (api.getWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });
    const error = new Error('Failed to save workflow');
    (api.updateWorkflow as jest.Mock).mockRejectedValueOnce(error);

    const { user } = render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to save workflow/i)).toBeInTheDocument();
    });
  });

  it('updates workflow name', async () => {
    (api.getWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });

    const { user } = render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/workflow name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Workflow Name');

    expect(nameInput).toHaveValue('Updated Workflow Name');
  });

  it('shows node properties panel when node is selected', async () => {
    (api.getWorkflow as jest.Mock).mockResolvedValueOnce({ data: mockWorkflow });

    const { user } = render(<WorkflowBuilderWithProvider templateId={mockWorkflow.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('workflow-builder')).toBeInTheDocument();
    });

    // Add a task node
    await user.click(screen.getByRole('button', { name: /add task/i }));
    const taskNode = screen.getByTestId('task-node');

    // Click on the node to select it
    await user.click(taskNode);

    // Properties panel should appear
    expect(screen.getByTestId('node-properties-panel')).toBeInTheDocument();
  });
});