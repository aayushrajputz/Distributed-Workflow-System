import { renderHook, waitFor } from '@testing-library/react';
import { useWorkflows } from 'hooks/use-workflows';
import { api } from 'lib/api';
import { wrapper } from '../utils/test-utils';

// Mock is set up in jest.setup.ts

describe('useWorkflows', () => {
  const mockWorkflows = [
    { id: '1', name: 'Workflow 1' },
    { id: '2', name: 'Workflow 2' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches workflows', async () => {
    (api.getWorkflows as jest.Mock).mockResolvedValueOnce(mockWorkflows);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockWorkflows);
    });

    expect(api.getWorkflows).toHaveBeenCalled();
  });

  it('handles error state', async () => {
    const error = new Error('Failed to fetch workflows');
    (api.getWorkflows as jest.Mock).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('creates new workflow', async () => {
    const newWorkflow = { name: 'New Workflow' };
    (api.createWorkflow as jest.Mock).mockResolvedValueOnce(newWorkflow);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await result.current.mutateAsync(newWorkflow);

    expect(api.createWorkflow).toHaveBeenCalledWith(newWorkflow);
  });

  it('updates existing workflow', async () => {
    const updatedWorkflow = { id: '1', name: 'Updated Workflow' };
    (api.updateWorkflow as jest.Mock).mockResolvedValueOnce(updatedWorkflow);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await result.current.mutateAsync({ id: '1', name: 'Updated Workflow' });

    expect(api.updateWorkflow).toHaveBeenCalledWith('1', { name: 'Updated Workflow' });
  });

  it('deletes workflow', async () => {
    (api.deleteWorkflow as jest.Mock).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useWorkflows(), { wrapper });

    await result.current.mutateAsync('1');

    expect(api.deleteWorkflow).toHaveBeenCalledWith('1');
  });
});