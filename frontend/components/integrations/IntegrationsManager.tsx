'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

import {
  MessageSquare,
  Github,
  Zap,
  Trello,
  Salesforce,
  Mail,
  Webhook,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink
} from 'lucide-react'

import { api } from '@/lib/api'

const integrationTypes = [
  {
    type: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    color: 'bg-purple-100 text-purple-600',
    description: 'Send notifications to Slack channels'
  },
  {
    type: 'github',
    name: 'GitHub',
    icon: Github,
    color: 'bg-gray-100 text-gray-600',
    description: 'Trigger workflows from GitHub events'
  },
  {
    type: 'jira',
    name: 'Jira',
    icon: Zap,
    color: 'bg-blue-100 text-blue-600',
    description: 'Sync tasks with Jira issues'
  },
  {
    type: 'asana',
    name: 'Asana',
    icon: Trello,
    color: 'bg-orange-100 text-orange-600',
    description: 'Sync projects with Asana'
  },
  {
    type: 'salesforce',
    name: 'Salesforce',
    icon: Salesforce,
    color: 'bg-cyan-100 text-cyan-600',
    description: 'Integrate with Salesforce CRM'
  },
  {
    type: 'email',
    name: 'Email',
    icon: Mail,
    color: 'bg-green-100 text-green-600',
    description: 'Send email notifications'
  },
  {
    type: 'webhook',
    name: 'Webhook',
    icon: Webhook,
    color: 'bg-indigo-100 text-indigo-600',
    description: 'Custom webhook integrations'
  }
]

export default function IntegrationsManager() {
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIntegration, setSelectedIntegration] = useState(null)
  const [isConfiguring, setIsConfiguring] = useState(false)

  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      const response = await api.getIntegrations()
      if (response.success) {
        setIntegrations(response.data)
      }
    } catch (error) {
      console.error('Error loading integrations:', error)
      toast.error('Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigureIntegration = (type) => {
    const existing = integrations.find(i => i.type === type)
    setSelectedIntegration({ type, ...existing })
    setIsConfiguring(true)
  }

  const handleSaveIntegration = async (integrationData) => {
    try {
      let response
      
      switch (integrationData.type) {
        case 'slack':
          response = await api.setupSlackIntegration(integrationData)
          break
        case 'github':
          response = await api.setupGitHubIntegration(integrationData)
          break
        case 'jira':
          response = await api.setupJiraIntegration(integrationData)
          break
        default:
          throw new Error('Integration type not supported yet')
      }

      if (response.success) {
        toast.success('Integration configured successfully')
        setIsConfiguring(false)
        setSelectedIntegration(null)
        loadIntegrations()
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      console.error('Error saving integration:', error)
      toast.error(error.message || 'Failed to save integration')
    }
  }

  const handleDeleteIntegration = async (integrationId) => {
    try {
      const response = await api.deleteIntegration(integrationId)
      if (response.success) {
        toast.success('Integration deleted successfully')
        loadIntegrations()
      }
    } catch (error) {
      console.error('Error deleting integration:', error)
      toast.error('Failed to delete integration')
    }
  }

  const getIntegrationStatus = (integration) => {
    if (!integration.isActive) {
      return { status: 'inactive', color: 'bg-gray-100 text-gray-600', icon: XCircle }
    }
    
    const successRate = integration.successRate || 0
    if (successRate >= 95) {
      return { status: 'healthy', color: 'bg-green-100 text-green-600', icon: CheckCircle }
    } else if (successRate >= 80) {
      return { status: 'warning', color: 'bg-yellow-100 text-yellow-600', icon: AlertTriangle }
    } else {
      return { status: 'error', color: 'bg-red-100 text-red-600', icon: XCircle }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Integrations</h2>
          <p className="text-gray-600">Connect your workflow with external services</p>
        </div>
      </div>

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="configured">Configured ({integrations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrationTypes.map((integrationType) => {
              const IconComponent = integrationType.icon
              const existing = integrations.find(i => i.type === integrationType.type)
              
              return (
                <Card key={integrationType.type} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${integrationType.color}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{integrationType.name}</CardTitle>
                          {existing && (
                            <Badge variant="secondary" className="text-xs">
                              Configured
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                      {integrationType.description}
                    </p>
                    <Button
                      onClick={() => handleConfigureIntegration(integrationType.type)}
                      className="w-full"
                      variant={existing ? "outline" : "default"}
                    >
                      {existing ? (
                        <>
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Integration
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="configured" className="space-y-4">
          {integrations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">No integrations configured yet.</p>
                <p className="text-sm text-gray-400 mt-2">
                  Add your first integration from the Available tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {integrations.map((integration) => {
                const integrationType = integrationTypes.find(t => t.type === integration.type)
                const IconComponent = integrationType?.icon || Settings
                const status = getIntegrationStatus(integration)
                const StatusIcon = status.icon

                return (
                  <Card key={integration._id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-lg ${integrationType?.color || 'bg-gray-100 text-gray-600'}`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{integration.name}</h3>
                            <p className="text-sm text-gray-600">{integrationType?.name || integration.type}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <StatusIcon className={`h-4 w-4 ${status.color.split(' ')[1]}`} />
                            <span className={`text-sm font-medium ${status.color.split(' ')[1]}`}>
                              {status.status}
                            </span>
                          </div>
                          
                          {integration.stats && (
                            <div className="text-sm text-gray-500">
                              {integration.stats.successfulSyncs}/{integration.stats.totalSyncs} syncs
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConfigureIntegration(integration.type)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteIntegration(integration._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {integration.lastSyncAt && (
                        <div className="mt-4 text-xs text-gray-500">
                          Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={isConfiguring} onOpenChange={setIsConfiguring}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Configure {integrationTypes.find(t => t.type === selectedIntegration?.type)?.name} Integration
            </DialogTitle>
          </DialogHeader>
          
          {selectedIntegration && (
            <IntegrationConfigForm
              integration={selectedIntegration}
              onSave={handleSaveIntegration}
              onCancel={() => setIsConfiguring(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Integration Configuration Form Component
function IntegrationConfigForm({ integration, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    type: integration.type,
    ...integration
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const renderConfigFields = () => {
    switch (integration.type) {
      case 'slack':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                value={formData.webhookUrl || ''}
                onChange={(e) => updateFormData('webhookUrl', e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Default Channel</Label>
              <Input
                id="channel"
                value={formData.channel || ''}
                onChange={(e) => updateFormData('channel', e.target.value)}
                placeholder="#general"
              />
            </div>
          </>
        )

      case 'github':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Personal Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                value={formData.accessToken || ''}
                onChange={(e) => updateFormData('accessToken', e.target.value)}
                placeholder="ghp_..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repository">Repository</Label>
              <Input
                id="repository"
                value={formData.repository || ''}
                onChange={(e) => updateFormData('repository', e.target.value)}
                placeholder="owner/repo-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Webhook Secret</Label>
              <Input
                id="webhookSecret"
                type="password"
                value={formData.webhookSecret || ''}
                onChange={(e) => updateFormData('webhookSecret', e.target.value)}
                placeholder="Optional webhook secret"
              />
            </div>
          </>
        )

      case 'jira':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="domain">Jira Domain</Label>
              <Input
                id="domain"
                value={formData.domain || ''}
                onChange={(e) => updateFormData('domain', e.target.value)}
                placeholder="your-domain (without .atlassian.net)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateFormData('email', e.target.value)}
                placeholder="your-email@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <Input
                id="apiToken"
                type="password"
                value={formData.apiToken || ''}
                onChange={(e) => updateFormData('apiToken', e.target.value)}
                placeholder="Your Jira API token"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectKey">Project Key</Label>
              <Input
                id="projectKey"
                value={formData.projectKey || ''}
                onChange={(e) => updateFormData('projectKey', e.target.value)}
                placeholder="PROJ"
              />
            </div>
          </>
        )

      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-500">Configuration for {integration.type} coming soon!</p>
          </div>
        )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {renderConfigFields()}
      
      <div className="flex items-center justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Integration
        </Button>
      </div>
    </form>
  )
}
