export const testUsers = {
  admin: {
    firstName: 'Admin',
    lastName: 'User',
    username: 'testadmin',
    email: 'admin@test.com',
    password: 'AdminPass123!',
    role: 'admin' as const
  },
  manager: {
    firstName: 'Manager',
    lastName: 'User',
    username: 'testmanager',
    email: 'manager@test.com',
    password: 'ManagerPass123!',
    role: 'manager' as const
  },
  user: {
    firstName: 'Regular',
    lastName: 'User',
    username: 'testuser',
    email: 'user@test.com',
    password: 'UserPass123!',
    role: 'user' as const
  }
};

export const testTasks = [
  {
    title: 'Setup Development Environment',
    description: 'Install and configure development tools and dependencies',
    status: 'pending',
    priority: 'high',
    assignedTo: 'user@test.com',
    assignedBy: 'admin@test.com',
    project: 'E2E Testing Project',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedHours: 8,
    tags: ['setup', 'development', 'e2e-test']
  },
  {
    title: 'Write Unit Tests',
    description: 'Create comprehensive unit tests for core functionality',
    status: 'in_progress',
    priority: 'medium',
    assignedTo: 'user@test.com',
    assignedBy: 'manager@test.com',
    project: 'E2E Testing Project',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedHours: 16,
    actualHours: 8,
    progress: 50,
    tags: ['testing', 'unit-tests', 'e2e-test']
  },
  {
    title: 'Code Review',
    description: 'Review pull requests and provide feedback',
    status: 'completed',
    priority: 'medium',
    assignedTo: 'manager@test.com',
    assignedBy: 'admin@test.com',
    project: 'E2E Testing Project',
    dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedHours: 4,
    actualHours: 3,
    progress: 100,
    completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['review', 'quality-assurance', 'e2e-test']
  }
];

export const testWorkflows = [
  {
    name: 'Simple Task Workflow',
    category: 'Development',
    description: 'A basic workflow for task management',
    nodes: [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 100, y: 100 },
        data: { label: 'Start' }
      },
      {
        id: 'task-1',
        type: 'task',
        position: { x: 300, y: 100 },
        data: {
          label: 'Development Task',
          taskType: 'manual',
          assignee: 'user@test.com',
          priority: 'medium',
          description: 'Complete development work'
        }
      },
      {
        id: 'end-1',
        type: 'end',
        position: { x: 500, y: 100 },
        data: { label: 'End' }
      }
    ],
    edges: [
      {
        id: 'e1-1',
        source: 'start-1',
        target: 'task-1',
        label: 'Begin'
      },
      {
        id: 'e1-2',
        source: 'task-1',
        target: 'end-1',
        label: 'Complete'
      }
    ]
  }
];

export function createUserData(role: 'admin' | 'manager' | 'user', overrides: any = {}): any {
  const timestamp = Date.now();
  const baseUser = {
    firstName: `Test${role.charAt(0).toUpperCase() + role.slice(1)}`,
    lastName: `User${timestamp}`,
    username: `test${role}${timestamp}`,
    email: `test${role}${timestamp}@example.com`,
    password: `${role.charAt(0).toUpperCase() + role.slice(1)}Pass123!`,
    role
  };

  return { ...baseUser, ...overrides };
}

export function createTaskData(overrides: any = {}): any {
  const timestamp = Date.now();
  const statuses = ['pending', 'in_progress', 'completed', 'blocked'];
  const priorities = ['low', 'medium', 'high', 'critical'];

  const baseTask = {
    title: `Test Task ${timestamp}`,
    description: `This is a test task created at ${new Date().toISOString()}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    assignedTo: testUsers.user.email,
    assignedBy: testUsers.admin.email,
    project: 'E2E Test Project',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedHours: Math.floor(Math.random() * 40) + 1,
    tags: ['test', 'e2e', 'generated']
  };

  return { ...baseTask, ...overrides };
}

export function getUserCredentials(userType: keyof typeof testUsers): { email: string; password: string } {
  const user = testUsers[userType];
  return {
    email: user.email,
    password: user.password
  };
}