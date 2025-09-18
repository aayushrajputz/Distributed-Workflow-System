# E2E Testing with Playwright

This directory contains comprehensive end-to-end tests for the Distributed Workflow Management System using Playwright.

## 📁 Directory Structure

```
e2e/
├── auth/                           # Authentication tests
│   ├── login.spec.ts              # Login flow tests
│   └── signup.spec.ts             # Registration flow tests
├── tasks/                          # Task management tests
│   └── task-lifecycle.spec.ts     # Complete task lifecycle tests
├── workflows/                      # Workflow builder tests
│   └── workflow-creation.spec.ts  # Workflow creation and execution tests
├── collaboration/                  # Real-time collaboration tests
│   └── real-time-collaboration.spec.ts # Multi-user collaboration tests
├── helpers/                        # Test helper utilities
│   ├─��� auth.ts                    # Authentication helpers
│   ├── database.ts                # Database management helpers
│   └── socket.ts                  # Socket.IO testing helpers
├── page-objects/                   # Page Object Model classes
│   ├── AuthPage.ts                # Authentication page object
│   ├── TasksPage.ts               # Tasks page object
│   └── WorkflowBuilderPage.ts     # Workflow builder page object
├── fixtures/                       # Test data and fixtures
│   └── test-data.ts               # Test data factories and fixtures
├── auth-states/                    # Saved authentication states
├── global-setup.ts                # Global test setup
├── global-teardown.ts             # Global test cleanup
└── README.md                      # This file
```

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Docker** and **Docker Compose** (for backend services)
3. **Playwright** browsers installed

### Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Install Playwright browsers:
```bash
npm run e2e:install
```

3. Start the backend services:
```bash
cd ../
docker-compose up -d
```

4. Start the frontend development server:
```bash
cd frontend
npm run dev
```

## 🧪 Running Tests

### Quick Start

Run all E2E tests:
```bash
npm run e2e
```

Run tests in headed mode (with browser UI):
```bash
npm run e2e:headed
```

Run tests with debug mode:
```bash
npm run e2e:debug
```

### Test Categories

Run specific test categories:

```bash
# Authentication tests
npx playwright test auth/

# Task management tests
npx playwright test tasks/

# Workflow tests
npx playwright test workflows/

# Real-time collaboration tests
npx playwright test collaboration/
```

### Browser-Specific Tests

```bash
# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Parallel Execution

```bash
# Run tests in parallel (default)
npx playwright test --workers=4

# Run tests serially
npx playwright test --workers=1
```

## 📊 Test Reports

### HTML Report

Generate and view HTML report:
```bash
npm run e2e:report
```

### Real-time UI

Run tests with Playwright UI:
```bash
npm run e2e:ui
```

### CI/CD Integration

For continuous integration, use:
```bash
npm run test:e2e:full
```

This command includes:
- Environment setup
- Test execution
- Report generation
- Cleanup

## 🏗️ Test Architecture

### Page Object Model

Tests use the Page Object Model pattern for maintainability:

```typescript
// Example usage
const authPage = new AuthPage(page);
await authPage.navigateToAuth();
await authPage.login('user@test.com', 'password');
```

### Helper Functions

Reusable helper functions for common operations:

```typescript
// Authentication helpers
await setupAuthenticatedUser(page, 'admin');

// Database helpers
await seedTestDatabase();
await cleanupTestData();

// Socket helpers
await connectSocket(page);
await waitForSocketEvent(page, 'task_created');
```

### Test Data Management

Centralized test data and factories:

```typescript
// Using test data factories
const userData = createUserData('admin', { email: 'custom@test.com' });
const taskData = createTaskData({ priority: 'high' });
```

## 🔧 Configuration

### Playwright Configuration

Key configuration options in `playwright.config.ts`:

- **Browsers**: Chromium, Firefox, WebKit
- **Parallel Workers**: 4 (configurable)
- **Timeouts**: 60s global, 10s expect
- **Retries**: 2 on CI, 0 locally
- **Screenshots**: On failure
- **Videos**: On first retry

### Environment Variables

Set these environment variables for customization:

```bash
# Test environment
NODE_ENV=test

# Service URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# Database
TEST_DB_URL=mongodb://localhost:27017/workflow_test

# Test behavior
HEADLESS=true
SLOW_MO=0
STOP_SERVICES_ON_TEARDOWN=false
```

## 🧩 Test Patterns

### Authentication Tests

```typescript
test('should login with valid credentials', async ({ page }) => {
  const authPage = new AuthPage(page);
  await authPage.navigateToAuth();
  await authPage.login('user@test.com', 'password');
  expect(page.url()).toContain('/dashboard');
});
```

### Multi-User Collaboration Tests

```typescript
test('should sync task updates across users', async ({ browser }) => {
  const contexts = [await browser.newContext(), await browser.newContext()];
  const collaboration = await setupCollaborationTest(contexts, ['admin', 'user']);
  
  // Test real-time updates between users
  await adminTasksPage.createTask(taskData);
  await waitForTaskUpdate(userPage, taskData.id);
});
```

### Workflow Builder Tests

```typescript
test('should create and execute workflow', async ({ page }) => {
  const workflowPage = new WorkflowBuilderPage(page);
  await workflowPage.createSimpleWorkflow('Test Workflow');
  await workflowPage.startExecution();
  await workflowPage.waitForExecutionComplete();
});
```

## ��� Debugging

### Debug Mode

Run tests in debug mode:
```bash
npm run e2e:debug
```

This enables:
- Slow motion execution
- Browser developer tools
- Step-by-step debugging

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots at failure point
- Video recordings (on retry)
- Browser console logs
- Network requests

### Trace Viewer

Generate and view execution traces:
```bash
npx playwright show-trace test-results/trace.zip
```

## 🔍 Test Data and Fixtures

### Test Users

Pre-configured test users:

```typescript
const testUsers = {
  admin: { email: 'admin@test.com', password: 'AdminPass123!', role: 'admin' },
  manager: { email: 'manager@test.com', password: 'ManagerPass123!', role: 'manager' },
  user: { email: 'user@test.com', password: 'UserPass123!', role: 'user' }
};
```

### Test Data Factories

Generate dynamic test data:

```typescript
// Create unique user data
const userData = createUserData('user', {
  email: `test${Date.now()}@example.com`
});

// Create task with specific properties
const taskData = createTaskData({
  priority: 'high',
  assignee: 'user@test.com'
});
```

### Database Seeding

Automated test data setup:

```typescript
// Seed database with test data
await seedTestDatabase();

// Create specific test scenarios
await createTestTasks(5, { status: 'pending' });
await createTestWorkflows(3, { category: 'Development' });
```

## 🚦 CI/CD Integration

### GitHub Actions

Example workflow configuration:

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Run E2E tests
        run: npm run test:e2e:full
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Docker Integration

Tests can run in Docker containers:

```bash
# Build test image
docker build -t workflow-e2e -f Dockerfile.e2e .

# Run tests in container
docker run --network host workflow-e2e npm run e2e
```

## 📈 Performance Testing

### Load Testing

Test application under load:

```typescript
test('should handle concurrent users', async ({ browser }) => {
  const contexts = await Promise.all(
    Array(10).fill(0).map(() => browser.newContext())
  );
  
  // Simulate 10 concurrent users
  await Promise.all(
    contexts.map(context => simulateUserWorkflow(context))
  );
});
```

### Memory and Resource Monitoring

Monitor resource usage during tests:

```typescript
test('should not leak memory', async ({ page }) => {
  const initialMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
  
  // Perform operations
  await performHeavyOperations(page);
  
  const finalMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
  expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024); // 50MB
});
```

## 🛠️ Maintenance

### Updating Test Data

Regularly update test data:

```bash
# Regenerate test fixtures
npm run test:fixtures:update

# Update test user credentials
npm run test:users:refresh
```

### Browser Updates

Keep browsers updated:

```bash
# Update Playwright browsers
npx playwright install

# Check for updates
npx playwright --version
```

### Test Health Monitoring

Monitor test stability:

```bash
# Run tests multiple times to check flakiness
npm run e2e -- --repeat-each=5

# Generate stability report
npm run test:stability
```

## 🤝 Contributing

### Adding New Tests

1. **Choose appropriate directory** (`auth/`, `tasks/`, `workflows/`, `collaboration/`)
2. **Follow naming convention**: `feature-name.spec.ts`
3. **Use Page Object Model** for UI interactions
4. **Add test data** to fixtures if needed
5. **Include proper assertions** and error handling

### Test Guidelines

- **Descriptive test names**: Clearly describe what is being tested
- **Independent tests**: Each test should be able to run independently
- **Proper cleanup**: Clean up test data after each test
- **Meaningful assertions**: Assert on business logic, not implementation details
- **Error scenarios**: Test both happy path and error conditions

### Code Review Checklist

- [ ] Tests are independent and can run in any order
- [ ] Test data is properly managed and cleaned up
- [ ] Page objects are used for UI interactions
- [ ] Assertions are meaningful and specific
- [ ] Error scenarios are covered
- [ ] Tests are properly categorized and named
- [ ] Documentation is updated if needed

## 📚 Resources

### Playwright Documentation

- [Playwright Official Docs](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)

### Testing Patterns

- [Page Object Model](https://playwright.dev/docs/pom)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Parallelization](https://playwright.dev/docs/test-parallel)

### Troubleshooting

- [Common Issues](https://playwright.dev/docs/troubleshooting)
- [Debug Guide](https://playwright.dev/docs/debug)
- [CI/CD Setup](https://playwright.dev/docs/ci)

## 📞 Support

For questions or issues with E2E tests:

1. **Check existing issues** in the project repository
2. **Review test logs** and error messages
3. **Run tests locally** to reproduce issues
4. **Create detailed bug reports** with steps to reproduce

## 🔄 Changelog

### v1.0.0 (Current)

- ✅ Complete E2E testing infrastructure
- ✅ Authentication flow tests
- ✅ Task lifecycle tests
- ✅ Workflow builder tests
- ✅ Real-time collaboration tests
- ✅ Page Object Model implementation
- ✅ Test data management system
- ✅ CI/CD integration support
- ✅ Comprehensive documentation

### Future Enhancements

- 🔄 Visual regression testing
- 🔄 API testing integration
- 🔄 Performance benchmarking
- 🔄 Mobile responsive testing
- 🔄 Accessibility testing
- 🔄 Cross-browser compatibility matrix
- 🔄 Test result analytics dashboard