/// <reference types="jest" />
import '@testing-library/jest-dom';
import 'jest-canvas-mock';
import 'resize-observer-polyfill';

// Mock window.ResizeObserver
global.ResizeObserver = require('resize-observer-polyfill');

// Mock API
jest.mock('lib/api', () => ({
  api: {
    // Auth methods
    login: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    
    // Workflow methods (flat structure)
    getWorkflows: jest.fn(),
    getWorkflow: jest.fn(),
    createWorkflow: jest.fn(), 
    updateWorkflow: jest.fn(),
    deleteWorkflow: jest.fn(),
    executeWorkflow: jest.fn(),
    getWorkflowTasks: jest.fn(),
    
    // Task methods
    getTasks: jest.fn(),
    getTask: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    
    // Project methods
    getProjects: jest.fn(),
    getProject: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
    
    // User methods
    getUsers: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
    
    // Notification methods
    getNotifications: jest.fn(),
    markNotificationRead: jest.fn(),
    
    // File methods
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  },
  ApiError: jest.fn().mockImplementation((status, message) => {
    const error = new Error(message);
    error.name = 'ApiError';
    (error as any).status = status;
    return error;
  }),
  ApiKeyError: jest.fn().mockImplementation((code, message, status = 401) => {
    const error = new Error(message);
    error.name = 'ApiKeyError';
    (error as any).code = code;
    (error as any).status = status;
    return error;
  }),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    forEach: jest.fn(),
    entries: jest.fn(),
    keys: jest.fn(),
    values: jest.fn(),
    toString: jest.fn(),
  }),
  usePathname: () => '/current/path',
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage({ src, alt, ...props }: { src: string; alt: string; [key: string]: any }) {
    const image = {
      type: 'img',
      props: {
        src,
        alt,
        ...props,
      },
    };
    return image;
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress console.error and console.warn in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) return;
    originalError.call(console, ...args);
  };
  console.warn = (...args: any[]) => {
    if (args[0]?.includes?.('webpack')) return;
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});