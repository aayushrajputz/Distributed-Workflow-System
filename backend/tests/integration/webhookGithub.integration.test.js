const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const webhookGithub = require('../../routes/webhook-github');
const workflowEngine = require('../../services/workflowEngine');

describe('GitHub Webhook Integration Tests', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/webhooks/github', webhookGithub);
    
    // Reset all mocks
    jest.clearAllMocks();
    jest.spyOn(workflowEngine, 'executeEventRules').mockImplementation();
  });

  const generateGitHubSignature = (payload) => {
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const signature = hmac.update(Buffer.from(JSON.stringify(payload))).digest('hex');
    return `sha256=${signature}`;
  };

  describe('Signature Verification', () => {
    const validPayload = {
      repository: {
        full_name: 'test/repo'
      },
      sender: {
        login: 'testuser'
      }
    };

    it('should accept requests with valid signatures', async () => {
      const signature = generateGitHubSignature(validPayload);

      const response = await request(app)
        .post('/webhooks/github')
        .set('X-Hub-Signature-256', signature)
        .set('X-GitHub-Event', 'push')
        .set('X-GitHub-Delivery', '123e4567-e89b-12d3-a456-426614174000')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject requests with invalid signatures', async () => {
      const response = await request(app)
        .post('/webhooks/github')
        .set('X-Hub-Signature-256', 'sha256=invalid')
        .set('X-GitHub-Event', 'push')
        .set('X-GitHub-Delivery', '123e4567-e89b-12d3-a456-426614174000')
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject requests with missing signature header', async () => {
      const response = await request(app)
        .post('/webhooks/github')
        .set('X-GitHub-Event', 'push')
        .set('X-GitHub-Delivery', '123e4567-e89b-12d3-a456-426614174000')
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject malformed signature formats', async () => {
      const response = await request(app)
        .post('/webhooks/github')
        .set('X-Hub-Signature-256', 'invalid-format')
        .set('X-GitHub-Event', 'push')
        .set('X-GitHub-Delivery', '123e4567-e89b-12d3-a456-426614174000')
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Payload Processing', () => {
    const generateValidHeaders = (payload, event = 'push') => {
      return {
        'X-Hub-Signature-256': generateGitHubSignature(payload),
        'X-GitHub-Event': event,
        'X-GitHub-Delivery': '123e4567-e89b-12d3-a456-426614174000'
      };
    };

    it('should process push events correctly', async () => {
      const pushPayload = {
        ref: 'refs/heads/main',
        repository: {
          full_name: 'test/repo'
        },
        commits: [
          {
            id: 'abc123',
            message: 'Test commit',
            author: { name: 'Test User' }
          }
        ]
      };

      const response = await request(app)
        .post('/webhooks/github')
        .set(generateValidHeaders(pushPayload, 'push'))
        .send(pushPayload);

      expect(response.status).toBe(200);
      expect(workflowEngine.executeEventRules).toHaveBeenCalledWith(
        'github_push',
        expect.objectContaining({
          repository: 'test/repo',
          branch: 'main',
          commits: expect.any(Array)
        })
      );
    });

    it('should process pull request events correctly', async () => {
      const prPayload = {
        action: 'opened',
        pull_request: {
          number: 123,
          title: 'Test PR',
          user: { login: 'testuser' },
          base: { ref: 'main' },
          head: { ref: 'feature' }
        },
        repository: {
          full_name: 'test/repo'
        }
      };

      const response = await request(app)
        .post('/webhooks/github')
        .set(generateValidHeaders(prPayload, 'pull_request'))
        .send(prPayload);

      expect(response.status).toBe(200);
      expect(workflowEngine.executeEventRules).toHaveBeenCalledWith(
        'github_pull_request',
        expect.objectContaining({
          action: 'opened',
          prNumber: 123,
          repository: 'test/repo'
        })
      );
    });

    it('should process issue events correctly', async () => {
      const issuePayload = {
        action: 'opened',
        issue: {
          number: 456,
          title: 'Test Issue',
          user: { login: 'testuser' }
        },
        repository: {
          full_name: 'test/repo'
        }
      };

      const response = await request(app)
        .post('/webhooks/github')
        .set(generateValidHeaders(issuePayload, 'issues'))
        .send(issuePayload);

      expect(response.status).toBe(200);
      expect(workflowEngine.executeEventRules).toHaveBeenCalledWith(
        'github_issue',
        expect.objectContaining({
          action: 'opened',
          issueNumber: 456,
          repository: 'test/repo'
        })
      );
    });

    it('should handle large payloads correctly', async () => {
      const largePayload = {
        repository: { full_name: 'test/repo' },
        commits: Array(100).fill().map((_, i) => ({
          id: `commit${i}`,
          message: 'Test commit',
          author: { name: 'Test User' }
        }))
      };

      const response = await request(app)
        .post('/webhooks/github')
        .set(generateValidHeaders(largePayload, 'push'))
        .send(largePayload);

      expect(response.status).toBe(200);
      expect(workflowEngine.executeEventRules).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON payloads', async () => {
      const response = await request(app)
        .post('/webhooks/github')
        .set('X-Hub-Signature-256', generateGitHubSignature({}))
        .set('X-GitHub-Event', 'push')
        .set('X-GitHub-Delivery', '123e4567-e89b-12d3-a456-426614174000')
        .set('Content-Type', 'application/json')
        .send('{"invalid json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required headers', async () => {
      const payload = { test: 'data' };
      const response = await request(app)
        .post('/webhooks/github')
        .set('X-Hub-Signature-256', generateGitHubSignature(payload))
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required payload fields', async () => {
      const payload = { random: 'data' };
      
      const response = await request(app)
        .post('/webhooks/github')
        .set(generateValidHeaders(payload, 'push'))
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should process concurrent webhook requests correctly', async () => {
      const payload = {
        repository: { full_name: 'test/repo' },
        sender: { login: 'testuser' }
      };

      const promises = Array(5).fill().map(() => 
        request(app)
          .post('/webhooks/github')
          .set(generateValidHeaders(payload, 'push'))
          .send(payload)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });
  });
});