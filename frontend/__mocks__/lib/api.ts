const mockFn = () => {
  const fn = jest.fn();
  fn.mockResolvedValue = (value: any) => fn.mockImplementation(() => Promise.resolve(value));
  fn.mockRejectedValue = (value: any) => fn.mockImplementation(() => Promise.reject(value));
  fn.mockResolvedValueOnce = (value: any) => fn.mockImplementationOnce(() => Promise.resolve(value));
  fn.mockRejectedValueOnce = (value: any) => fn.mockImplementationOnce(() => Promise.reject(value));
  return fn;
};

export const api = {
  login: mockFn(),
  register: mockFn(),
  getWorkflows: mockFn(),
  getWorkflow: mockFn(),
  createWorkflow: mockFn(),
  updateWorkflow: mockFn(),
  deleteWorkflow: mockFn(),
  getWorkflowTasks: mockFn(),
  getTasks: mockFn(),
  getTask: mockFn(),
  retryTask: mockFn(),
  cancelTask: mockFn(),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiKeyError extends Error {
  constructor(public code: string, message: string, public status: number = 401) {
    super(message);
    this.name = "ApiKeyError";
  }
}

// Helper to reset all mocks
export const resetApiMocks = () => {
  Object.values(api).forEach((mock) => {
    mock.mockReset();
  });
};

// Helper to set mock responses
export const setApiMockResponse = (
  method: keyof typeof api,
  response: any,
  error = false
) => {
  const mock = api[method];
  if (error) {
    mock.mockRejectedValue(response);
  } else {
    mock.mockResolvedValue(response);
  }
};