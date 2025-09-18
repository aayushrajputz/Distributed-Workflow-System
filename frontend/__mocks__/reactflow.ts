import { type MutableRefObject } from 'react';

const mockReactFlowInstance = {
  fitView: jest.fn(),
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
  getNodes: jest.fn().mockReturnValue([]),
  getEdges: jest.fn().mockReturnValue([]),
  setNodes: jest.fn(),
  setEdges: jest.fn(),
  addNodes: jest.fn(),
  addEdges: jest.fn(),
  toObject: jest.fn().mockReturnValue({ nodes: [], edges: [] }),
  getViewport: jest.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 }),
};

const mockNodeTypes = {
  custom: () => null,
};

const mockEdgeTypes = {
  custom: () => null,
};

export const Position = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom',
};

export const ReactFlow = jest.fn(({ children }) => children || null);
export const Background = jest.fn(() => null);
export const Controls = jest.fn(() => null);
export const MiniMap = jest.fn(() => null);
export const Panel = jest.fn(({ children }) => children || null);
export const Handle = jest.fn(() => null);

export const useNodesState = jest.fn(() => [[], jest.fn()]);
export const useEdgesState = jest.fn(() => [[], jest.fn()]);
export const useReactFlow = jest.fn(() => mockReactFlowInstance);

export const ReactFlowProvider = jest.fn(({ children }) => children || null);

export const addEdge = jest.fn((params) => []);

export const useStoreApi = jest.fn(() => ({
  getState: jest.fn(),
  setState: jest.fn(),
  subscribe: jest.fn(),
  destroy: jest.fn(),
}));

export const useStore = jest.fn();

export function useUpdateNodeInternals() {
  return jest.fn();
}

export const getBezierPath = jest.fn(() => '');
export const getSmoothStepPath = jest.fn(() => '');
export const getMarkerEnd = jest.fn(() => '');

// Re-export types to match the real module
export type Node = any;
export type Edge = any;
export type Connection = any;
export type ReactFlowInstance = typeof mockReactFlowInstance;
export type NodeTypes = typeof mockNodeTypes;
export type EdgeTypes = typeof mockEdgeTypes;

// Mock viewport and zoom functionality
export const useViewport = jest.fn(() => ({ x: 0, y: 0, zoom: 1 }));
export const useZoomPanHelper = jest.fn(() => ({
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
  zoomTo: jest.fn(),
  setTransform: jest.fn(),
  fitView: jest.fn(),
  setCenter: jest.fn(),
  project: jest.fn((pos) => pos),
}));