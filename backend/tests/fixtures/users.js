const mongoose = require('mongoose');

/**
 * User permission helper methods
 */
const userPermissionMethods = {
  canViewAllTasks() {
    return ['admin', 'manager'].includes(this.role);
  },
  canAssignTasks() {
    return ['admin', 'manager'].includes(this.role);
  },
  hasPermission(permission) {
    const permissionMap = {
      admin: ['*'],
      manager: ['view_all', 'assign_tasks', 'create_workflow', 'manage_integrations'],
      user: ['view_own', 'create_task', 'comment'],
    };
    return permissionMap[this.role]?.includes('*') || permissionMap[this.role]?.includes(permission);
  },
};

/**
 * User factory function
 */
const createUser = (role = 'user', overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  email: `${role}@example.com`,
  password: '$2a$10$testPasswordHash',
  firstName: role.charAt(0).toUpperCase() + role.slice(1),
  lastName: 'User',
  role,
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date('2025-09-18T10:00:00Z'),
  ...userPermissionMethods,
  ...overrides,
});

/**
 * Predefined user fixtures
 */
const adminUser = createUser('admin', {
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
});

const managerUser = createUser('manager', {
  email: 'manager@example.com',
  firstName: 'Manager',
  lastName: 'User',
});

const regularUser = createUser('user', {
  email: 'user@example.com',
  firstName: 'Regular',
  lastName: 'User',
});

const inactiveUser = createUser('user', {
  email: 'inactive@example.com',
  firstName: 'Inactive',
  lastName: 'User',
  isActive: false,
});

const unverifiedUser = createUser('user', {
  email: 'unverified@example.com',
  firstName: 'Unverified',
  lastName: 'User',
  isEmailVerified: false,
});

module.exports = {
  createUser,
  adminUser,
  managerUser,
  regularUser,
  inactiveUser,
  unverifiedUser,
  userPermissionMethods,
};