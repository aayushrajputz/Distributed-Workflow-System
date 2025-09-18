# Integration Testing Documentation

## Overview

This directory contains integration tests for the Distributed Workflow System's backend services, testing cross-service interactions and end-to-end workflows.

## Test Structure

- `webhookGithub.integration.test.js`: Tests GitHub webhook processing with signature verification and event handling
- `webhookZapier.integration.test.js`: Tests Zapier webhook integration with API key auth and workflow triggers
- `workflowEngine.integration.test.js`: Tests task assignment, completion, and notification workflows
- `integrationService.integration.test.js`: Tests external service integrations (Slack, Jira, GitHub)
- `taskSocket.integration.test.js`: Tests real-time socket functionality and multi-client scenarios
- `endToEnd.integration.test.js`: Tests complete cross-service workflows

## Setup and Configuration

The integration tests use:
- `supertest` for HTTP endpoint testing
- `socket.io-client` for WebSocket testing
- `nock` for external service mocking
- MongoDB Memory Server for database testing

### Environment Variables

Required environment variables for integration testing:
```
GITHUB_WEBHOOK_SECRET=test-github-webhook-secret
ZAPIER_WHITELIST=localhost,.company.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/test-webhook
JIRA_DOMAIN=test-domain.atlassian.net
```

## Running Tests

Run all integration tests:
```bash
npm run test:integration
```

Run with watch mode:
```bash
npm run test:integration:watch
```

Run with coverage:
```bash
npm run test:integration:coverage
```

Run end-to-end tests only:
```bash
npm run test:e2e
```

## Test Utilities

### Socket Testing Helpers

```javascript
// Create a test socket server
const server = await global.createTestSocketServer(handler);

// Create an authenticated socket client
const client = await global.createTestSocketClient(url, token);

// Wait for socket events
await global.waitForSocketEvent(socket, 'eventName');
```

### HTTP Mocking

```javascript
// Mock external service endpoints
const slackMock = nock('https://hooks.slack.com')
  .post('/test-webhook')
  .reply(200, 'ok');

const jiraMock = nock('https://test-domain.atlassian.net')
  .get('/rest/api/3/myself')
  .reply(200, { accountId: 'test' });
```

## Writing Integration Tests

1. Tests should be isolated and clean up after themselves
2. Use the provided test utilities for socket and HTTP testing
3. Follow the existing patterns for test organization and naming
4. Include both happy path and error scenarios
5. Test concurrent operations and edge cases

## Coverage Requirements

- Services: 70% statements, 60% branches
- Routes: 80% statements, 70% branches
- Sockets: 75% statements, 65% branches

## Best Practices

1. Use `beforeEach` to reset state and clean up mocks
2. Avoid sharing state between tests
3. Mock external services consistently
4. Test realistic scenarios and workflows
5. Include appropriate timeouts for async operations
6. Clean up resources in `afterEach` hooks

## Debugging

1. Use `test:debug` script for debugging with Node inspector
2. Check nock pending mocks after each test
3. Review socket connection errors in test output
4. Monitor memory usage with large datasets
5. Verify database cleanup between tests

## Known Issues

1. Socket tests require proper cleanup to avoid port conflicts
2. Long-running integration tests may hit default timeouts
3. HTTP mocks must be exact to avoid unmatched requests
4. Memory leaks possible with improper socket cleanup

## Contributing

1. Follow existing test patterns and organization
2. Add new test files in appropriate categories
3. Update documentation for new test utilities
4. Maintain coverage requirements
5. Test both success and failure scenarios