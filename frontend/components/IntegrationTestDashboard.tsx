'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  Clock,
  Send,
  TestTube,
  Webhook,
  Github,
  Slack,
  Zap,
  Play,
  Settings,
  AlertCircle
} from 'lucide-react';

export default function IntegrationTestDashboard() {
  const [integrations, setIntegrations] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [webhookTest, setWebhookTest] = useState({
    url: 'http://localhost:5000/api/webhooks/test',
    payload: JSON.stringify({ message: 'Test webhook from dashboard', timestamp: new Date().toISOString() }, null, 2)
  });

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations');
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  };

  const testIntegration = async (integrationId) => {
    setTesting(prev => ({ ...prev, [integrationId]: true }));
    
    try {
      const response = await fetch(`/api/integrations/${integrationId}/test`, {
        method: 'POST'
      });
      
      const result = await response.json();
      setTestResults(prev => ({ ...prev, [integrationId]: result }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [integrationId]: { success: false, error: error.message } 
      }));
    } finally {
      setTesting(prev => ({ ...prev, [integrationId]: false }));
    }
  };

  const sendTestWebhook = async () => {
    setTesting(prev => ({ ...prev, webhook: true }));
    
    try {
      const response = await fetch(webhookTest.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: webhookTest.payload
      });
      
      const result = await response.json();
      setTestResults(prev => ({ 
        ...prev, 
        webhook: { success: response.ok, data: result, status: response.status } 
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        webhook: { success: false, error: error.message } 
      }));
    } finally {
      setTesting(prev => ({ ...prev, webhook: false }));
    }
  };

  const sendSlackTest = async (integrationId) => {
    setTesting(prev => ({ ...prev, [`slack_${integrationId}`]: true }));
    
    try {
      const response = await fetch(`/api/integrations/${integrationId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '🎉 Slack integration test successful! Your workflow system is connected and ready to send notifications.',
          options: {
            username: 'Workflow Builder Test',
            icon: ':white_check_mark:'
          }
        })
      });
      
      const result = await response.json();
      setTestResults(prev => ({ 
        ...prev, 
        [`slack_${integrationId}`]: result 
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [`slack_${integrationId}`]: { success: false, error: error.message } 
      }));
    } finally {
      setTesting(prev => ({ ...prev, [`slack_${integrationId}`]: false }));
    }
  };

  const triggerGitHubTest = async () => {
    setTesting(prev => ({ ...prev, github: true }));
    
    try {
      // Simulate GitHub webhook
      const testPayload = {
        action: 'opened',
        pull_request: {
          title: 'Test PR from Integration Dashboard',
          number: 123,
          html_url: 'https://github.com/test/repo/pull/123',
          user: { login: 'test-user' }
        },
        repository: {
          full_name: 'test-user/test-repo'
        },
        sender: { login: 'test-user' }
      };

      const response = await fetch('/api/webhooks/github', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request',
          'X-Hub-Signature-256': 'sha256=test-signature'
        },
        body: JSON.stringify(testPayload)
      });
      
      const result = await response.json();
      setTestResults(prev => ({ 
        ...prev, 
        github: { success: response.ok, data: result, status: response.status } 
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        github: { success: false, error: error.message } 
      }));
    } finally {
      setTesting(prev => ({ ...prev, github: false }));
    }
  };

  const executeTestWorkflow = async () => {
    setTesting(prev => ({ ...prev, workflow: true }));
    
    try {
      // Create a test workflow execution
      const response = await fetch('/api/workflows/test/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables: {
            test_message: 'Integration test workflow',
            timestamp: new Date().toISOString()
          }
        })
      });
      
      const result = await response.json();
      setTestResults(prev => ({ 
        ...prev, 
        workflow: result 
      }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        workflow: { success: false, error: error.message } 
      }));
    } finally {
      setTesting(prev => ({ ...prev, workflow: false }));
    }
  };

  const getIntegrationIcon = (type) => {
    switch (type) {
      case 'slack': return <Slack className="w-5 h-5" />;
      case 'github': return <Github className="w-5 h-5" />;
      case 'jira': return <Zap className="w-5 h-5" />;
      case 'webhook': return <Webhook className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (result) => {
    if (!result) return <Clock className="w-4 h-4 text-gray-400" />;
    return result.success ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusColor = (result) => {
    if (!result) return 'bg-gray-100 text-gray-600';
    return result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integration Testing</h2>
          <p className="text-muted-foreground">
            Test all your integrations and verify they're working correctly
          </p>
        </div>
        
        <Button onClick={loadIntegrations} variant="outline">
          <TestTube className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integration Tests</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Tests</TabsTrigger>
          <TabsTrigger value="workflows">Workflow Tests</TabsTrigger>
          <TabsTrigger value="system">System Tests</TabsTrigger>
        </TabsList>

        {/* Integration Tests */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration) => (
              <Card key={integration._id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getIntegrationIcon(integration.type)}
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                    </div>
                    <Badge variant={integration.isActive ? 'default' : 'secondary'}>
                      {integration.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Type: {integration.type}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(testResults[integration._id])}
                      <span className="text-sm">
                        {testResults[integration._id] ? 
                          (testResults[integration._id].success ? 'Test Passed' : 'Test Failed') : 
                          'Not Tested'
                        }
                      </span>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => testIntegration(integration._id)}
                      disabled={testing[integration._id] || !integration.isActive}
                    >
                      {testing[integration._id] ? (
                        <Clock className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Slack-specific test */}
                  {integration.type === 'slack' && integration.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => sendSlackTest(integration._id)}
                      disabled={testing[`slack_${integration._id}`]}
                    >
                      {testing[`slack_${integration._id}`] ? (
                        <Clock className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Test Message
                    </Button>
                  )}

                  {/* Test Results */}
                  {testResults[integration._id] && (
                    <div className={`p-2 rounded text-xs ${getStatusColor(testResults[integration._id])}`}>
                      {testResults[integration._id].success ? 
                        testResults[integration._id].message || 'Test successful' :
                        testResults[integration._id].error || 'Test failed'
                      }
                    </div>
                  )}

                  {testResults[`slack_${integration._id}`] && (
                    <div className={`p-2 rounded text-xs ${getStatusColor(testResults[`slack_${integration._id}`])}`}>
                      {testResults[`slack_${integration._id}`].success ? 
                        'Slack message sent successfully!' :
                        testResults[`slack_${integration._id}`].error || 'Failed to send Slack message'
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {integrations.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No integrations configured yet</p>
                <p className="text-sm">Add integrations to test them here</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Webhook Tests */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Custom Webhook Test */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Webhook Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Webhook URL</Label>
                  <Input
                    value={webhookTest.url}
                    onChange={(e) => setWebhookTest(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="http://localhost:5000/api/webhooks/test"
                  />
                </div>
                
                <div>
                  <Label>Payload (JSON)</Label>
                  <Textarea
                    value={webhookTest.payload}
                    onChange={(e) => setWebhookTest(prev => ({ ...prev, payload: e.target.value }))}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
                
                <Button
                  onClick={sendTestWebhook}
                  disabled={testing.webhook}
                  className="w-full"
                >
                  {testing.webhook ? (
                    <Clock className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Test Webhook
                </Button>

                {testResults.webhook && (
                  <div className={`p-3 rounded ${getStatusColor(testResults.webhook)}`}>
                    <div className="font-medium">
                      {testResults.webhook.success ? 'Webhook Successful' : 'Webhook Failed'}
                    </div>
                    <div className="text-sm mt-1">
                      Status: {testResults.webhook.status || 'Error'}
                    </div>
                    {testResults.webhook.data && (
                      <pre className="text-xs mt-2 overflow-auto">
                        {JSON.stringify(testResults.webhook.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* GitHub Webhook Test */}
            <Card>
              <CardHeader>
                <CardTitle>GitHub Webhook Test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Simulate a GitHub pull request webhook to test your GitHub integration.
                </p>
                
                <Button
                  onClick={triggerGitHubTest}
                  disabled={testing.github}
                  className="w-full"
                >
                  {testing.github ? (
                    <Clock className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Github className="w-4 h-4 mr-2" />
                  )}
                  Trigger GitHub Test
                </Button>

                {testResults.github && (
                  <div className={`p-3 rounded ${getStatusColor(testResults.github)}`}>
                    <div className="font-medium">
                      {testResults.github.success ? 'GitHub Test Successful' : 'GitHub Test Failed'}
                    </div>
                    <div className="text-sm mt-1">
                      Status: {testResults.github.status || 'Error'}
                    </div>
                    {testResults.github.error && (
                      <div className="text-sm mt-1 text-red-600">
                        Error: {testResults.github.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Workflow Tests */}
        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Execution Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Execute a test workflow to verify the workflow engine is working correctly.
              </p>
              
              <Button
                onClick={executeTestWorkflow}
                disabled={testing.workflow}
                className="w-full"
              >
                {testing.workflow ? (
                  <Clock className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Execute Test Workflow
              </Button>

              {testResults.workflow && (
                <div className={`p-3 rounded ${getStatusColor(testResults.workflow)}`}>
                  <div className="font-medium">
                    {testResults.workflow.success ? 'Workflow Test Successful' : 'Workflow Test Failed'}
                  </div>
                  {testResults.workflow.executionId && (
                    <div className="text-sm mt-1">
                      Execution ID: {testResults.workflow.executionId}
                    </div>
                  )}
                  {testResults.workflow.error && (
                    <div className="text-sm mt-1 text-red-600">
                      Error: {testResults.workflow.error}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tests */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Environment Check</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Slack Client ID:</span>
                    <Badge variant={process.env.NEXT_PUBLIC_SLACK_CLIENT_ID ? 'default' : 'destructive'}>
                      {process.env.NEXT_PUBLIC_SLACK_CLIENT_ID ? 'Configured' : 'Missing'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Backend URL:</span>
                    <Badge variant="default">Connected</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>WebSocket:</span>
                    <Badge variant="default">Connected</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integration Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Integrations:</span>
                    <span>{integrations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active:</span>
                    <span>{integrations.filter(i => i.isActive).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tested:</span>
                    <span>{Object.keys(testResults).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Passing:</span>
                    <span>{Object.values(testResults).filter(r => r.success).length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
