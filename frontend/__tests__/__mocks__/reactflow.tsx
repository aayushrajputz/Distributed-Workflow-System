const mockReactFlow = {
  // Basic React Flow Components
  ReactFlow: ({ children, ...props }: any) => <div data-testid="react-flow">{children}</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  
  // Node Types
  Handle: ({ type, position, ...props }: any) => (
    <div data-testid={`handle-${type}-${position}`} {...props} />
  ),

  // Hooks
  useReactFlow: () => ({
    getNodes: jest.fn().mockReturnValue([]),
    getEdges: jest.fn().mockReturnValue([]),
    setNodes: jest.fn(),
    setEdges: jest.fn(),
    addNodes: jest.fn(),
    addEdges: jest.fn(),
    project: jest.fn(point => point),
    getIntersectingNodes: jest.fn().mockReturnValue([]),
  }),
  useNodesState: jest.fn().mockReturnValue([[], jest.fn()]),
  useEdgesState: jest.fn().mockReturnValue([[], jest.fn()]),

  // Node/Edge Utils
  Position: {
    Left: 'left',
    Right: 'right',
    Top: 'top',
    Bottom: 'bottom',
  },
  MarkerType: {
    Arrow: 'arrow',
    ArrowClosed: 'arrowclosed',
  },

  // Others
  Panel: ({ children, ...props }: any) => <div data-testid="panel">{children}</div>,
  getIncomers: jest.fn().mockReturnValue([]),
  getOutgoers: jest.fn().mockReturnValue([]),
  getConnectedEdges: jest.fn().mockReturnValue([]),
  isNode: jest.fn().mockReturnValue(true),
  isEdge: jest.fn().mockReturnValue(true),
};

export default mockReactFlow;