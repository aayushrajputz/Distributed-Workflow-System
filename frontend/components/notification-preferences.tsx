"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Mail, Bell, MessageSquare, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react'

interface NotificationPreferences {
  email: {
    task_assigned: boolean
    task_completed: boolean
    task_overdue: boolean
    task_escalated: boolean
    task_updated: boolean
    task_comment: boolean
    workflow_completed: boolean
    daily_digest: boolean
    system_alert: boolean
  }
  inApp: {
    task_assigned: boolean
    task_completed: boolean
    task_overdue: boolean
    task_escalated: boolean
    task_updated: boolean
    task_comment: boolean
    workflow_completed: boolean
    daily_digest: boolean
    system_alert: boolean
  }
  slack: {
    enabled: boolean
    webhookUrl: string
    channel: string
    task_assigned: boolean
    task_completed: boolean
    task_overdue: boolean
    task_escalated: boolean
  }
}

const notificationTypes = [
  { key: 'task_assigned', label: 'Task Assigned', description: 'When a task is assigned to you', icon: '📋' },
  { key: 'task_completed', label: 'Task Completed', description: 'When someone completes a task you assigned', icon: '✅' },
  { key: 'task_overdue', label: 'Task Overdue', description: 'When a task becomes overdue', icon: '⏰' },
  { key: 'task_escalated', label: 'Task Escalated', description: 'When a task is escalated', icon: '🚨' },
  { key: 'task_updated', label: 'Task Updated', description: 'When task details are modified', icon: '📝' },
  { key: 'task_comment', label: 'Task Comments', description: 'When someone comments on your tasks', icon: '💬' },
  { key: 'workflow_completed', label: 'Workflow Completed', description: 'When a workflow is completed', icon: '🎉' },
  { key: 'daily_digest', label: 'Daily Digest', description: 'Daily summary of your tasks', icon: '📊' },
  { key: 'system_alert', label: 'System Alerts', description: 'Important system notifications', icon: '⚠️' }
]

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingSlack, setTestingSlack] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setPreferences(data.data)
      } else {
        toast.error('Failed to load notification preferences')
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast.error('Failed to load notification preferences')
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    if (!preferences) return

    try {
      setSaving(true)
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      })

      if (response.ok) {
        toast.success('Notification preferences saved successfully!')
      } else {
        toast.error('Failed to save notification preferences')
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error('Failed to save notification preferences')
    } finally {
      setSaving(false)
    }
  }

  const testEmailNotification = async () => {
    try {
      setTestingEmail(true)
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/notifications/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'task_completed',
          title: 'Test Email Notification',
          message: 'This is a test email notification to verify your email settings are working correctly.'
        })
      })

      if (response.ok) {
        toast.success('Test email sent! Check your inbox.')
      } else {
        toast.error('Failed to send test email')
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error('Failed to send test email')
    } finally {
      setTestingEmail(false)
    }
  }

  const testSlackNotification = async () => {
    if (!preferences?.slack.webhookUrl) {
      toast.error('Please enter a Slack webhook URL first')
      return
    }

    try {
      setTestingSlack(true)
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/notifications/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'task_completed',
          title: 'Test Slack Notification',
          message: 'This is a test Slack notification to verify your Slack integration is working correctly.'
        })
      })

      if (response.ok) {
        toast.success('Test Slack message sent!')
      } else {
        toast.error('Failed to send test Slack message')
      }
    } catch (error) {
      console.error('Error sending test Slack message:', error)
      toast.error('Failed to send test Slack message')
    } finally {
      setTestingSlack(false)
    }
  }

  const updatePreference = (channel: 'email' | 'inApp' | 'slack', key: string, value: boolean | string) => {
    if (!preferences) return

    setPreferences(prev => ({
      ...prev!,
      [channel]: {
        ...prev![channel],
        [key]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load notification preferences</p>
        <Button onClick={loadPreferences} className="mt-4">Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notification Preferences</h2>
        <p className="text-gray-600">Manage how and when you receive notifications</p>
      </div>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
            <Badge variant="secondary">REAL</Badge>
          </CardTitle>
          <CardDescription>
            Receive notifications via email. Make sure to configure SMTP settings in your environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationTypes.map((type) => (
            <div key={type.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{type.icon}</span>
                <div>
                  <Label className="font-medium">{type.label}</Label>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </div>
              <Switch
                checked={preferences.email[type.key as keyof typeof preferences.email]}
                onCheckedChange={(checked) => updatePreference('email', type.key, checked)}
              />
            </div>
          ))}
          <Separator />
          <div className="flex gap-2">
            <Button 
              onClick={testEmailNotification} 
              disabled={testingEmail}
              variant="outline"
              size="sm"
            >
              {testingEmail ? 'Sending...' : 'Test Email'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            In-App Notifications
            <Badge variant="secondary">REAL</Badge>
          </CardTitle>
          <CardDescription>
            Receive notifications within the application interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationTypes.map((type) => (
            <div key={type.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{type.icon}</span>
                <div>
                  <Label className="font-medium">{type.label}</Label>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </div>
              <Switch
                checked={preferences.inApp[type.key as keyof typeof preferences.inApp]}
                onCheckedChange={(checked) => updatePreference('inApp', type.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Slack Integration
            <Badge variant="secondary">REAL</Badge>
          </CardTitle>
          <CardDescription>
            Send notifications to your Slack workspace using webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="font-medium">Enable Slack Notifications</Label>
            <Switch
              checked={preferences.slack.enabled}
              onCheckedChange={(checked) => updatePreference('slack', 'enabled', checked)}
            />
          </div>
          
          {preferences.slack.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Slack Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  placeholder="https://hooks.slack.com/services/..."
                  value={preferences.slack.webhookUrl}
                  onChange={(e) => updatePreference('slack', 'webhookUrl', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <Input
                  id="channel"
                  placeholder="#general"
                  value={preferences.slack.channel}
                  onChange={(e) => updatePreference('slack', 'channel', e.target.value)}
                />
              </div>

              <Separator />

              {notificationTypes.slice(0, 4).map((type) => (
                <div key={type.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{type.icon}</span>
                    <Label className="font-medium">{type.label}</Label>
                  </div>
                  <Switch
                    checked={preferences.slack[type.key as keyof typeof preferences.slack] as boolean}
                    onCheckedChange={(checked) => updatePreference('slack', type.key, checked)}
                  />
                </div>
              ))}

              <div className="flex gap-2">
                <Button 
                  onClick={testSlackNotification} 
                  disabled={testingSlack || !preferences.slack.webhookUrl}
                  variant="outline"
                  size="sm"
                >
                  {testingSlack ? 'Sending...' : 'Test Slack'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  )
}
