export const api = {
  auth: {
    login: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
  },
  workflows: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // Add other API groups as needed
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