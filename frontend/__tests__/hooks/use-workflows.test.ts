import { renderHook, waitFor } from '@testing-library/react';
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow } from 'hooks/use-workflows';
import { api } from 'lib/api';
import { wrapper } from '../utils/test-utils';

// Mock is set up in jest.setup.ts

describe('useWorkflows', () => {
  const mockWorkflows = [
    { id: '1', name: 'Workflow 1', description: 'Test workflow 1' },
    { id: '2', name: 'Workflow 2', description: 'Test workflow 2' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useWorkflows hook', () => {
    it('fetches workflows successfully', async () => {
      (api.getWorkflows as jest.Mock).mockResolvedValueOnce({ data: mockWorkflows });

      const { result } = renderHook(() => useWorkflows(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toEqual(mockWorkflows);
        expect(result.current.error).toBe(null);
      });

      expect(api.getWorkflows).toHaveBeenCalled();
    });

    it('handles error state', async () => {
      const error = new Error('Failed to fetch workflows');
      (api.getWorkflows as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useWorkflows(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeTruthy();
        expect(result.current.data).toBeUndefined();
      });

      expect(api.getWorkflows).toHaveBeenCalled();
    });
  });

  describe('useCreateWorkflow hook', () => {
    it('creates new workflow', async () => {
      const newWorkflow = { name: 'New Workflow', description: 'New test workflow' };
      const createdWorkflow = { id: '3', ...newWorkflow };
      (api.createWorkflow as jest.Mock).mockResolvedValueOnce({ data: createdWorkflow });

      const { result } = renderHook(() => useCreateWorkflow(), { wrapper });

      expect(result.current.isPending).toBe(false);

      await result.current.mutateAsync(newWorkflow);

      expect(api.createWorkflow).toHaveBeenCalledWith(newWorkflow);
    });

    it('handles create workflow error', async () => {
      const error = new Error('Failed to create workflow');
      (api.createWorkflow as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCreateWorkflow(), { wrapper });

      try {
        await result.current.mutateAsync({ name: 'Test' });
      } catch (e) {
        expect(e).toBe(error);
      }

      expect(api.createWorkflow).toHaveBeenCalled();
    });
  });

  describe('useUpdateWorkflow hook', () => {
    it('updates existing workflow', async () => {
      const updatedWorkflow = { id: '1', name: 'Updated Workflow', description: 'Updated description' };
      (api.updateWorkflow as jest.Mock).mockResolvedValueOnce({ data: updatedWorkflow });

      const { result } = renderHook(() => useUpdateWorkflow(), { wrapper });

      await result.current.mutateAsync({ 
        id: '1', 
        data: { name: 'Updated Workflow', description: 'Updated description' } 
      });

      expect(api.updateWorkflow).toHaveBeenCalledWith('1', { 
        name: 'Updated Workflow', 
        description: 'Updated description' 
      });
    });
  });

  describe('useDeleteWorkflow hook', () => {
    it('deletes workflow', async () => {
      (api.deleteWorkflow as jest.Mock).mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useDeleteWorkflow(), { wrapper });

      await result.current.mutateAsync('1');

      expect(api.deleteWorkflow).toHaveBeenCalledWith('1');
    });

    it('handles delete workflow error', async () => {
      const error = new Error('Failed to delete workflow');
      (api.deleteWorkflow as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useDeleteWorkflow(), { wrapper });

      try {
        await result.current.mutateAsync('1');
      } catch (e) {
        expect(e).toBe(error);
      }

      expect(api.deleteWorkflow).toHaveBeenCalled();
    });
  });
});