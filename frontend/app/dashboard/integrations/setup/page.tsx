"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { realApiRequest } from "@/lib/api"

export default function IntegrationSetupPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [integrations, setIntegrations] = useState({
    slack: {
      webhookUrl: "https://hooks.slack.com/services/xxx/yyy/zzz",
      channel: "#general"
    },
    github: {
      accessToken: "",
      repository: "",
      webhookSecret: ""
    },
    jira: {
      domain: "",
      email: "",
      apiToken: "",
      projectKey: ""
    },
    zapier: {
      webhookUrl: "",
      events: ["task_created", "task_completed", "workflow_finished"]
    }
  })

  const handleIntegrationChange = (integration: string, field: string, value: string) => {
    setIntegrations(prev => ({
      ...prev,
      [integration]: {
        ...prev[integration as keyof typeof prev],
        [field]: value
      }
    }))
  }

  const setupAllIntegrations = async () => {
    setLoading(true)
    try {
      const response = await realApiRequest('/integrations/setup-all', {
        method: 'POST',
        body: JSON.stringify(integrations)
      })

      if (response.success) {
        toast({
          title: "Integrations Setup Complete",
          description: response.message,
          variant: "default"
        })
        console.log('Integration Results:', response.data)
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      toast({
        title: "Integration Setup Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getIntegrationStatus = async () => {
    try {
      const response = await realApiRequest('/integrations/status')
      if (response.success) {
        console.log('Integration Status:', response.data)
        toast({
          title: "Integration Status",
          description: `Slack: ${response.data.slack.connected ? 'Connected' : 'Disconnected'}, GitHub: ${response.data.github.connected ? 'Connected' : 'Disconnected'}, Jira: ${response.data.jira.connected ? 'Connected' : 'Disconnected'}, Zapier: ${response.data.zapier.connected ? 'Connected' : 'Disconnected'}`
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get integration status",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Integration Setup</h1>
        <div className="space-x-2">
          <Button variant="outline" onClick={getIntegrationStatus}>
            Check Status
          </Button>
          <Button onClick={setupAllIntegrations} disabled={loading}>
            {loading ? "Setting up..." : "Setup All Integrations"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Slack Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💬 Slack Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="slack-webhook">Webhook URL</Label>
              <Input
                id="slack-webhook"
                value={integrations.slack.webhookUrl}
                onChange={(e) => handleIntegrationChange('slack', 'webhookUrl', e.target.value)}
                placeholder="https://hooks.slack.com/services/xxx/yyy/zzz"
              />
            </div>
            <div>
              <Label htmlFor="slack-channel">Channel</Label>
              <Input
                id="slack-channel"
                value={integrations.slack.channel}
                onChange={(e) => handleIntegrationChange('slack', 'channel', e.target.value)}
                placeholder="#general"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time notifications for task creation and completion
            </p>
          </CardContent>
        </Card>

        {/* GitHub Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🐙 GitHub Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="github-token">Personal Access Token</Label>
              <Input
                id="github-token"
                type="password"
                value={integrations.github.accessToken}
                onChange={(e) => handleIntegrationChange('github', 'accessToken', e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div>
              <Label htmlFor="github-repo">Repository</Label>
              <Input
                id="github-repo"
                value={integrations.github.repository}
                onChange={(e) => handleIntegrationChange('github', 'repository', e.target.value)}
                placeholder="owner/repository"
              />
            </div>
            <div>
              <Label htmlFor="github-secret">Webhook Secret</Label>
              <Input
                id="github-secret"
                type="password"
                value={integrations.github.webhookSecret}
                onChange={(e) => handleIntegrationChange('github', 'webhookSecret', e.target.value)}
                placeholder="webhook_secret_key"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Webhook endpoint: /webhook/github
            </p>
          </CardContent>
        </Card>

        {/* Jira Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎯 Jira Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="jira-domain">Atlassian Domain</Label>
              <Input
                id="jira-domain"
                value={integrations.jira.domain}
                onChange={(e) => handleIntegrationChange('jira', 'domain', e.target.value)}
                placeholder="your-domain"
              />
              <p className="text-xs text-muted-foreground">
                Will connect to: https://{integrations.jira.domain}.atlassian.net/rest/api/3/
              </p>
            </div>
            <div>
              <Label htmlFor="jira-email">Email</Label>
              <Input
                id="jira-email"
                type="email"
                value={integrations.jira.email}
                onChange={(e) => handleIntegrationChange('jira', 'email', e.target.value)}
                placeholder="user@company.com"
              />
            </div>
            <div>
              <Label htmlFor="jira-token">API Token</Label>
              <Input
                id="jira-token"
                type="password"
                value={integrations.jira.apiToken}
                onChange={(e) => handleIntegrationChange('jira', 'apiToken', e.target.value)}
                placeholder="API token from Atlassian"
              />
            </div>
            <div>
              <Label htmlFor="jira-project">Project Key</Label>
              <Input
                id="jira-project"
                value={integrations.jira.projectKey}
                onChange={(e) => handleIntegrationChange('jira', 'projectKey', e.target.value)}
                placeholder="PROJ"
              />
            </div>
          </CardContent>
        </Card>

        {/* Zapier Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ Zapier Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="zapier-webhook">Webhook URL (optional)</Label>
              <Input
                id="zapier-webhook"
                value={integrations.zapier.webhookUrl}
                onChange={(e) => handleIntegrationChange('zapier', 'webhookUrl', e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/xxx/yyy"
              />
            </div>
            <div>
              <Label htmlFor="zapier-events">Events (comma-separated)</Label>
              <Textarea
                id="zapier-events"
                value={integrations.zapier.events.join(", ")}
                onChange={(e) => handleIntegrationChange('zapier', 'events', e.target.value)}
                placeholder="task_created, task_completed, workflow_finished"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Webhook endpoint: /webhook/zapier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Integration Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold">Rate Limiting</h4>
              <p>1000 requests per hour</p>
            </div>
            <div>
              <h4 className="font-semibold">Whitelisted Domains</h4>
              <p>*.company.com, localhost</p>
            </div>
            <div>
              <h4 className="font-semibold">Webhook Endpoints</h4>
              <ul className="list-disc list-inside">
                <li>/webhook/github - GitHub events</li>
                <li>/webhook/zapier - Zapier triggers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Real-time Features</h4>
              <ul className="list-disc list-inside">
                <li>Slack notifications on task events</li>
                <li>GitHub webhook processing</li>
                <li>Jira issue synchronization</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
