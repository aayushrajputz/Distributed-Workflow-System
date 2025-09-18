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
  screenToFlowPosition: jest.fn((pos) => pos),
  flowToScreenPosition: jest.fn((pos) => pos),
  project: jest.fn((pos) => pos),
  deleteElements: jest.fn(),
  getIntersectingNodes: jest.fn().mockReturnValue([]),
  getConnectedEdges: jest.fn().mockReturnValue([]),
  updateNode: jest.fn(),
  updateNodeData: jest.fn(),
};

const mockNodeTypes = {
  custom: () => null,
  task: () => null,
  condition: () => null,
  start: () => null,
  end: () => null,
};

const mockEdgeTypes = {
  custom: () => null,
  default: () => null,
  straight: () => null,
  step: () => null,
  smoothstep: () => null,
};

export const Position = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom',
};

export const MarkerType = {
  Arrow: 'arrow',
  ArrowClosed: 'arrowclosed',
};

export const ConnectionMode = {
  Strict: 'strict',
  Loose: 'loose',
};

// Mock React components
export const ReactFlow = jest.fn(({ children, onNodesChange, onEdgesChange, onConnect, ...props }) => {
  // Simulate component behavior for testing
  return (
    <div data-testid="react-flow" {...props}>
      {children}
    </div>
  );
});

export const Background = jest.fn((props) => <div data-testid="react-flow-background" {...props} />);
export const Controls = jest.fn((props) => <div data-testid="react-flow-controls" {...props} />);
export const MiniMap = jest.fn((props) => <div data-testid="react-flow-minimap" {...props} />);
export const Panel = jest.fn(({ children, ...props }) => (
  <div data-testid="react-flow-panel" {...props}>
    {children}
  </div>
));
export const Handle = jest.fn((props) => <div data-testid="react-flow-handle" {...props} />);

// Mock hooks
export const useNodesState = jest.fn((initialNodes = []) => {
  const setNodes = jest.fn();
  return [initialNodes, setNodes, jest.fn()];
});

export const useEdgesState = jest.fn((initialEdges = []) => {
  const setEdges = jest.fn();
  return [initialEdges, setEdges, jest.fn()];
});

export const useReactFlow = jest.fn(() => mockReactFlowInstance);

export const ReactFlowProvider = jest.fn(({ children }) => (
  <div data-testid="react-flow-provider">
    {children}
  </div>
));

// Mock utility functions
export const addEdge = jest.fn((params, edges) => {
  const newEdge = {
    id: `edge-${params.source}-${params.target}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    type: params.type || 'default',
  };
  return [...edges, newEdge];
});

export const applyNodeChanges = jest.fn((changes, nodes) => nodes);
export const applyEdgeChanges = jest.fn((changes, edges) => edges);

export const useStoreApi = jest.fn(() => ({
  getState: jest.fn(() => ({
    nodes: [],
    edges: [],
    nodeInternals: new Map(),
    transform: [0, 0, 1],
    width: 800,
    height: 600,
  })),
  setState: jest.fn(),
  subscribe: jest.fn(() => jest.fn()),
  destroy: jest.fn(),
}));

export const useStore = jest.fn((selector) => {
  const defaultState = {
    nodes: [],
    edges: [],
    nodeInternals: new Map(),
    transform: [0, 0, 1],
    width: 800,
    height: 600,
  };
  return selector ? selector(defaultState) : defaultState;
});

export function useUpdateNodeInternals() {
  return jest.fn();
}

export const useOnSelectionChange = jest.fn();
export const useOnViewportChange = jest.fn();

// Mock path and marker functions
export const getBezierPath = jest.fn(() => 'M0,0 L100,100');
export const getSmoothStepPath = jest.fn(() => 'M0,0 L100,100');
export const getStraightPath = jest.fn(() => 'M0,0 L100,100');
export const getSimpleBezierPath = jest.fn(() => 'M0,0 L100,100');
export const getMarkerEnd = jest.fn(() => 'url(#arrow)');

// Mock screen/flow position utilities
export const screenToFlowPosition = jest.fn((position) => position);

// Mock node/edge utilities
export const getNodesBounds = jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 }));
export const getTransformForBounds = jest.fn(() => ({ x: 0, y: 0, zoom: 1 }));

// Mock selection utilities
export const getConnectedEdges = jest.fn(() => []);
export const getIncomingEdges = jest.fn(() => []);
export const getOutgoers = jest.fn(() => []);

// Re-export types to match the real module
export type Node = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: any;
  [key: string]: any;
};

export type Edge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  [key: string]: any;
};

export type Connection = {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export type ReactFlowInstance = typeof mockReactFlowInstance;
export type NodeTypes = typeof mockNodeTypes;
export type EdgeTypes = typeof mockEdgeTypes;

export type XYPosition = { x: number; y: number };
export type Viewport = { x: number; y: number; zoom: number };

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

// Mock drag and drop
export const useDrag = jest.fn(() => [jest.fn(), jest.fn()]);
export const useDrop = jest.fn(() => [jest.fn(), jest.fn()]);

// Default export
export default ReactFlow;