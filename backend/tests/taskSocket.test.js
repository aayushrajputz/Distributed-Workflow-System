const { Server } = require('socket.io');
const Client = require('socket.io-client');
const TaskSocketHandler = require('../sockets/taskSocket');
const { verifyToken } = require('../config/jwt');
const User = require('../models/User');
const Task = require('../models/Task');
const notificationService = require('../services/notificationService');

// Mock dependencies
jest.mock('../config/jwt');
jest.mock('../models/User');
jest.mock('../models/Task');
jest.mock('../services/notificationService');
jest.mock('../services/prometheusService', () => ({
  getPrometheusService: () => ({
    updateTaskMetrics: jest.fn(),
  }),
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('TaskSocketHandler', () => {
  let io, serverSocket, clientSocket, taskSocketHandler;
  const port = 3001;

  beforeAll((done) => {
    // Create Socket.IO server
    io = new Server(port);
    taskSocketHandler = new TaskSocketHandler(io);
    
    // Start server
    io.listen(port);
    done();
  });

  afterAll(() => {
    io.close();
    if (taskSocketHandler) {
      taskSocketHandler.destroy();
    }
  });

  beforeEach((done) => {
    // Create client socket
    clientSocket = new Client(`http://localhost:${port}`);
    
    // Wait for connection
    io.on('connection', (socket) => {
      serverSocket = socket;
    });
    
    clientSocket.on('connect', done);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Socket Authentication', () => {
    test('should authenticate valid user', (done) => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: ['read', 'write'],
      };

      const mockDecoded = {
        userId: 'user123',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      clientSocket.on('authenticated', (data) => {
        expect(data.userId).toBe('user123');
        expect(data.role).toBe('user');
        expect(data.permissions).toEqual(['read', 'write']);
        expect(data.expiresAt).toBe(mockDecoded.exp * 1000);
        done();
      });

      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should reject invalid token', (done) => {
      verifyToken.mockRejectedValue(new Error('INVALID_TOKEN'));

      clientSocket.on('auth_error', (error) => {
        expect(error.code).toBe('INVALID_TOKEN');
        expect(error.message).toBe('Invalid authentication token');
        done();
      });

      clientSocket.emit('authenticate', { token: 'invalid-token' });
    });

    test('should reject missing token', (done) => {
      clientSocket.on('auth_error', (error) => {
        expect(error.code).toBe('NO_TOKEN');
        expect(error.message).toBe('No authentication token provided');
        done();
      });

      clientSocket.emit('authenticate', {});
    });

    test('should reject deactivated user', (done) => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: false,
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);

      clientSocket.on('auth_error', (error) => {
        expect(error.code).toBe('ACCOUNT_DEACTIVATED');
        expect(error.message).toBe('Account is deactivated');
        done();
      });

      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should handle rate limiting', (done) => {
      // Mock multiple failed attempts
      verifyToken.mockRejectedValue(new Error('INVALID_TOKEN'));

      let attemptCount = 0;
      const maxAttempts = 5;

      const attemptAuth = () => {
        attemptCount++;
        clientSocket.emit('authenticate', { token: 'invalid-token' });
      };

      clientSocket.on('auth_error', (error) => {
        if (attemptCount < maxAttempts) {
          setTimeout(attemptAuth, 10);
        } else if (attemptCount === maxAttempts) {
          // The next attempt should be rate limited
          setTimeout(() => {
            const newClient = new Client(`http://localhost:${port}`);
            newClient.on('auth_error', (rateLimitError) => {
              if (rateLimitError.code === 'TOO_MANY_AUTH_ATTEMPTS') {
                expect(rateLimitError.message).toContain('Too many authentication attempts');
                newClient.disconnect();
                done();
              }
            });
            newClient.emit('authenticate', { token: 'invalid-token' });
          }, 10);
        }
      });

      attemptAuth();
    });
  });

  describe('Task Room Management', () => {
    beforeEach(async () => {
      // Authenticate the socket first
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should allow joining task room with access', (done) => {
      Task.exists.mockResolvedValue(true);

      // Mock server socket to check if room was joined
      const originalJoin = serverSocket.join;
      serverSocket.join = jest.fn((room) => {
        expect(room).toBe('task_task123');
        serverSocket.join = originalJoin;
        done();
      });

      clientSocket.emit('join_task', 'task123');
    });

    test('should deny joining task room without access', (done) => {
      Task.exists.mockResolvedValue(false);

      clientSocket.on('error', (error) => {
        expect(error.code).toBe('FORBIDDEN');
        expect(error.message).toBe('No access to this task');
        done();
      });

      clientSocket.emit('join_task', 'task123');
    });

    test('should allow admin to join any task room', (done) => {
      // Re-authenticate as admin
      const mockAdmin = {
        _id: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'admin123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockAdmin);

      const adminClient = new Client(`http://localhost:${port}`);
      
      adminClient.on('authenticated', () => {
        const originalJoin = serverSocket.join;
        serverSocket.join = jest.fn((room) => {
          expect(room).toBe('task_task123');
          serverSocket.join = originalJoin;
          adminClient.disconnect();
          done();
        });

        adminClient.emit('join_task', 'task123');
      });

      adminClient.emit('authenticate', { token: 'admin-token' });
    });
  });

  describe('Task Updates', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should broadcast task updates to task room', (done) => {
      const updateData = {
        taskId: 'task123',
        changes: { title: 'Updated Title' },
        projectName: 'Test Project',
      };

      // Create another client to receive the broadcast
      const receiverClient = new Client(`http://localhost:${port}`);
      
      receiverClient.on('connect', () => {
        receiverClient.on('task_updated', (data) => {
          expect(data.taskId).toBe('task123');
          expect(data.updatedBy).toBe('user123');
          expect(data.changes).toEqual({ title: 'Updated Title' });
          expect(data.timestamp).toBeDefined();
          receiverClient.disconnect();
          done();
        });

        // Simulate joining the task room
        receiverClient.emit('join', 'task_task123');
        
        // Send update from first client
        clientSocket.emit('task_update', updateData);
      });
    });

    test('should broadcast task status changes with throttling', (done) => {
      const statusData = {
        taskId: 'task123',
        oldStatus: 'pending',
        newStatus: 'in_progress',
        projectName: 'Test Project',
      };

      const receiverClient = new Client(`http://localhost:${port}`);
      
      receiverClient.on('connect', () => {
        receiverClient.on('task_status_changed', (data) => {
          expect(data.taskId).toBe('task123');
          expect(data.oldStatus).toBe('pending');
          expect(data.newStatus).toBe('in_progress');
          expect(data.changedBy).toBe('user123');
          receiverClient.disconnect();
          done();
        });

        receiverClient.emit('join', 'task_task123');
        clientSocket.emit('task_status_change', statusData);
      });
    });
  });

  describe('Typing Indicators', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should broadcast typing start events with throttling', (done) => {
      const receiverClient = new Client(`http://localhost:${port}`);
      
      receiverClient.on('connect', () => {
        receiverClient.on('user_typing', (data) => {
          expect(data.userId).toBe('user123');
          expect(data.taskId).toBe('task123');
          expect(data.typing).toBe(true);
          receiverClient.disconnect();
          done();
        });

        receiverClient.emit('join', 'task_task123');
        clientSocket.emit('typing_start', { taskId: 'task123' });
      });
    });

    test('should broadcast typing stop events', (done) => {
      const receiverClient = new Client(`http://localhost:${port}`);
      
      receiverClient.on('connect', () => {
        receiverClient.on('user_typing', (data) => {
          expect(data.userId).toBe('user123');
          expect(data.taskId).toBe('task123');
          expect(data.typing).toBe(false);
          receiverClient.disconnect();
          done();
        });

        receiverClient.emit('join', 'task_task123');
        clientSocket.emit('typing_stop', { taskId: 'task123' });
      });
    });

    test('should throttle rapid typing start events', (done) => {
      const receiverClient = new Client(`http://localhost:${port}`);
      let eventCount = 0;
      
      receiverClient.on('connect', () => {
        receiverClient.on('user_typing', (data) => {
          eventCount++;
          if (data.typing === true) {
            // Should only receive one typing start event due to throttling
            setTimeout(() => {
              expect(eventCount).toBe(1);
              receiverClient.disconnect();
              done();
            }, 100);
          }
        });

        receiverClient.emit('join', 'task_task123');
        
        // Send multiple rapid typing start events
        clientSocket.emit('typing_start', { taskId: 'task123' });
        clientSocket.emit('typing_start', { taskId: 'task123' });
        clientSocket.emit('typing_start', { taskId: 'task123' });
      });
    });
  });

  describe('Notification Management', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [
          { _id: 'notif1', title: 'Test Notification', read: false },
        ],
        unreadCount: 1,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should send pending notifications on authentication', (done) => {
      clientSocket.on('pending_notifications', (data) => {
        expect(data.notifications).toHaveLength(1);
        expect(data.notifications[0].title).toBe('Test Notification');
        expect(data.unreadCount).toBe(1);
        done();
      });
    });

    test('should mark notifications as read', (done) => {
      notificationService.markAsRead.mockResolvedValue();

      clientSocket.on('notifications_marked_read', (data) => {
        expect(data.notificationIds).toEqual(['notif1', 'notif2']);
        done();
      });

      clientSocket.emit('notification_read', ['notif1', 'notif2']);
    });

    test('should ignore invalid notification read requests', () => {
      notificationService.markAsRead.mockResolvedValue();

      // Should not call markAsRead for invalid data
      clientSocket.emit('notification_read', 'invalid');
      clientSocket.emit('notification_read', []);
      clientSocket.emit('notification_read', null);

      setTimeout(() => {
        expect(notificationService.markAsRead).not.toHaveBeenCalled();
      }, 50);
    });
  });

  describe('Workflow Execution Events', () => {
    beforeEach(async () => {
      // Authenticate the socket
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => resolve());
        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should allow joining workflow execution room with access', (done) => {
      const mockExecution = {
        _id: 'exec123',
        executionId: 'exec_123',
        triggeredBy: 'user123',
        status: 'running',
        progress: { percentage: 50 },
        currentStep: 'step1',
        startTime: new Date(),
        workflowTemplateId: {
          createdBy: 'user123',
          isPublic: false,
          sharedWith: [],
        },
      };

      // Mock the require calls within the socket handler
      jest.doMock('../models/WorkflowExecution', () => ({
        findById: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockExecution),
        }),
      }));

      clientSocket.on('workflow_execution_status', (data) => {
        expect(data.executionId).toBe('exec_123');
        expect(data.status).toBe('running');
        expect(data.progress).toEqual({ percentage: 50 });
        done();
      });

      clientSocket.emit('join_workflow_execution', 'exec123');
    });

    test('should handle workflow approval responses', (done) => {
      const mockExecution = {
        _id: 'exec123',
        steps: [
          {
            nodeId: 'approval1',
            status: 'waiting_approval',
            assignedTo: 'user123',
            approvals: [],
            startTime: new Date(),
          },
        ],
        save: jest.fn().mockResolvedValue(),
      };

      jest.doMock('../models/WorkflowExecution', () => ({
        findById: jest.fn().mockResolvedValue(mockExecution),
      }));

      const receiverClient = new Client(`http://localhost:${port}`);
      
      receiverClient.on('connect', () => {
        receiverClient.on('workflow_approval_response', (data) => {
          expect(data.executionId).toBe('exec123');
          expect(data.nodeId).toBe('approval1');
          expect(data.response).toBe('approved');
          expect(data.approver).toBe('user123');
          receiverClient.disconnect();
          done();
        });

        receiverClient.emit('join', 'workflow_execution_exec123');
        
        clientSocket.emit('workflow_approval_response', {
          executionId: 'exec123',
          nodeId: 'approval1',
          response: 'approved',
          comment: 'Looks good!',
        });
      });
    });
  });

  describe('Connection Management', () => {
    test('should track connected users', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => {
          expect(taskSocketHandler.isUserConnected('user123')).toBe(true);
          expect(taskSocketHandler.getConnectedUsersCount()).toBe(1);
          resolve();
        });

        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });

    test('should clean up on disconnect', (done) => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      clientSocket.on('authenticated', () => {
        expect(taskSocketHandler.isUserConnected('user123')).toBe(true);
        
        clientSocket.disconnect();
        
        setTimeout(() => {
          expect(taskSocketHandler.isUserConnected('user123')).toBe(false);
          expect(taskSocketHandler.getConnectedUsersCount()).toBe(0);
          done();
        }, 100);
      });

      clientSocket.emit('authenticate', { token: 'valid-token' });
    });
  });

  describe('Broadcasting Methods', () => {
    test('should broadcast notifications to specific users', () => {
      const notification = {
        type: 'task_assigned',
        title: 'New Task',
        message: 'You have a new task',
      };

      const result = taskSocketHandler.broadcastNotificationToUser('user123', notification);
      expect(result).toBe(false); // No connected user
    });

    test('should broadcast task assignments', () => {
      const taskData = {
        _id: 'task123',
        title: 'Test Task',
        assignedTo: 'user123',
      };

      const result = taskSocketHandler.broadcastTaskAssignment('user123', taskData);
      expect(result).toBe(false); // No connected user
    });

    test('should broadcast system announcements', () => {
      const announcement = {
        title: 'System Maintenance',
        message: 'System will be down for maintenance',
        type: 'warning',
      };

      // Should not throw
      expect(() => {
        taskSocketHandler.broadcastSystemAnnouncement(announcement);
      }).not.toThrow();
    });

    test('should broadcast workflow execution updates', () => {
      const update = {
        status: 'completed',
        progress: { percentage: 100 },
      };

      // Should not throw
      expect(() => {
        taskSocketHandler.broadcastWorkflowExecutionUpdate('exec123', update);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle authentication errors gracefully', (done) => {
      verifyToken.mockRejectedValue(new Error('Database connection failed'));

      clientSocket.on('auth_error', (error) => {
        expect(error.code).toBe('AUTHENTICATION_FAILED');
        expect(error.message).toBe('Authentication failed');
        done();
      });

      clientSocket.emit('authenticate', { token: 'valid-token' });
    });

    test('should handle task update errors', async () => {
      // Authenticate first
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      const mockDecoded = { userId: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      return new Promise((resolve) => {
        clientSocket.on('authenticated', () => {
          clientSocket.on('error', (error) => {
            expect(error.message).toBe('Failed to update task');
            resolve();
          });

          // Send invalid task update
          clientSocket.emit('task_update', null);
        });

        clientSocket.emit('authenticate', { token: 'valid-token' });
      });
    });
  });

  describe('Session Management', () => {
    test('should warn about token expiry', (done) => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      // Token expires in 4 minutes (less than warning threshold of 5 minutes)
      const mockDecoded = { 
        userId: 'user123', 
        exp: Math.floor(Date.now() / 1000) + 240 
      };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      clientSocket.on('session_warning', (warning) => {
        expect(warning.type).toBe('token_expiry_warning');
        expect(warning.message).toContain('Your session will expire');
        done();
      });

      clientSocket.emit('authenticate', { token: 'expiring-token' });
    });

    test('should disconnect expired sessions', (done) => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        isEmailVerified: true,
        permissions: [],
      };

      // Token already expired
      const mockDecoded = { 
        userId: 'user123', 
        exp: Math.floor(Date.now() / 1000) - 60 
      };

      verifyToken.mockResolvedValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      notificationService.getNotificationsForUser.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
      });

      clientSocket.on('session_expired', (data) => {
        expect(data.message).toBe('Your session has expired. Please log in again.');
        done();
      });

      clientSocket.emit('authenticate', { token: 'expired-token' });
    });
  });
});