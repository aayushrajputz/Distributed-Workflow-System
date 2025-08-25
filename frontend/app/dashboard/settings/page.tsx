"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Database,
  Trash2,
  Save,
  RefreshCw,
  Server,
  Shield,
  Bell,
  Palette,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  Globe,
  Zap,
  FileText,
  Settings2,
  HardDrive,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cache } from "@/lib/cache"

export default function SettingsPage() {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // API Configuration State
  const [apiSettings, setApiSettings] = useState({
    baseUrl: "https://api.workflow-system.com",
    timeout: "30000",
    retryAttempts: "3",
    retryDelay: "1000",
    apiKey: "wf_live_sk_1234567890abcdef",
  })

  // Cache Settings State
  const [cacheSettings, setCacheSettings] = useState({
    enabled: true,
    ttl: "3600",
    maxSize: "100",
    autoRefresh: true,
    refreshInterval: "300",
  })

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    workflowFailures: true,
    taskCompletions: false,
    systemAlerts: true,
    weeklyReports: true,
    pushNotifications: true,
    soundEnabled: true,
    desktopNotifications: true,
    slackIntegration: false,
    teamsIntegration: false,
  })

  // Theme Settings State
  const [themeSettings, setThemeSettings] = useState({
    theme: "system",
    compactMode: false,
    showAnimations: true,
    autoRefreshDashboard: true,
    refreshInterval: "5",
    fontSize: "medium",
    sidebarCollapsed: false,
    showTooltips: true,
    highContrast: false,
  })

  const [privacySettings, setPrivacySettings] = useState({
    dataCollection: true,
    analyticsTracking: true,
    crashReporting: true,
    usageStatistics: false,
    shareAnonymousData: true,
    cookieConsent: true,
    sessionTimeout: "60",
    twoFactorRequired: false,
  })

  const [integrationSettings, setIntegrationSettings] = useState({
    githubConnected: true,
    slackConnected: false,
    jiraConnected: true,
    zapierConnected: false,
    webhooksEnabled: true,
    apiRateLimit: "1000",
    allowedDomains: "*.company.com, localhost",
  })

  const [performanceSettings, setPerformanceSettings] = useState({
    lazyLoading: true,
    imageOptimization: true,
    prefetchData: true,
    compressionEnabled: true,
    maxConcurrentRequests: "10",
    requestTimeout: "30",
    enableServiceWorker: true,
  })

  const [accessibilitySettings, setAccessibilitySettings] = useState({
    screenReaderSupport: true,
    keyboardNavigation: true,
    focusIndicators: true,
    reducedMotion: false,
    highContrastMode: false,
    largeText: false,
    colorBlindSupport: false,
    voiceCommands: false,
  })

  const [cacheStats, setCacheStats] = useState(() => {
    const stats = cache.getStats()
    return {
      totalEntries: stats.totalEntries,
      usedSpace: stats.usedSpace,
      hitRate: "94.2%", // This would come from analytics
      lastCleared: "2024-01-14T10:30:00Z",
    }
  })

  const handleSaveApiSettings = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
    toast({
      title: "Settings saved",
      description: "API configuration has been updated successfully.",
    })
  }

  const handleClearCache = async () => {
    setIsClearing(true)
    cache.clear()

    // Update stats
    const newStats = cache.getStats()
    setCacheStats({
      ...cacheStats,
      totalEntries: newStats.totalEntries,
      usedSpace: newStats.usedSpace,
      lastCleared: new Date().toISOString(),
    })

    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsClearing(false)
    toast({
      title: "Cache cleared",
      description: "Local cache has been cleared successfully.",
    })
  }

  const handleTestConnection = async () => {
    toast({
      title: "Testing connection...",
      description: "Attempting to connect to the API endpoint.",
    })
    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 2000))
    toast({
      title: "Connection successful",
      description: "API endpoint is responding correctly.",
    })
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      // Simulate data export
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Create and download a mock export file
      const exportData = {
        workflows: [],
        tasks: [],
        settings: { apiSettings, notificationSettings, themeSettings },
        exportDate: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `workflow-data-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Export completed",
        description: "Your data has been exported successfully.",
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const importData = JSON.parse(text)

      // Simulate import process
      await new Promise((resolve) => setTimeout(resolve, 2000))

      toast({
        title: "Import completed",
        description: "Your data has been imported successfully.",
      })
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import data. Please check the file format.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
      // Reset file input
      event.target.value = ""
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your workflow management system</p>
      </div>

      <Tabs defaultValue="api" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                API Endpoint Configuration
              </CardTitle>
              <CardDescription>Configure the backend API connection settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="base-url">Base URL</Label>
                  <Input
                    id="base-url"
                    value={apiSettings.baseUrl}
                    onChange={(e) => setApiSettings({ ...apiSettings, baseUrl: e.target.value })}
                    placeholder="https://api.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={apiSettings.timeout}
                    onChange={(e) => setApiSettings({ ...apiSettings, timeout: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="retry-attempts">Retry Attempts</Label>
                  <Input
                    id="retry-attempts"
                    type="number"
                    value={apiSettings.retryAttempts}
                    onChange={(e) => setApiSettings({ ...apiSettings, retryAttempts: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retry-delay">Retry Delay (ms)</Label>
                  <Input
                    id="retry-delay"
                    type="number"
                    value={apiSettings.retryDelay}
                    onChange={(e) => setApiSettings({ ...apiSettings, retryDelay: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiSettings.apiKey}
                  onChange={(e) => setApiSettings({ ...apiSettings, apiKey: e.target.value })}
                  placeholder="Enter your API key"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={handleSaveApiSettings} disabled={isSaving}>
                  {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Button>
                <Button variant="outline" onClick={handleTestConnection}>
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cache Configuration
                </CardTitle>
                <CardDescription>Configure local cache behavior and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Caching</Label>
                    <p className="text-sm text-muted-foreground">Store API responses locally for faster access</p>
                  </div>
                  <Switch
                    checked={cacheSettings.enabled}
                    onCheckedChange={(checked) => setCacheSettings({ ...cacheSettings, enabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache-ttl">Cache TTL (seconds)</Label>
                  <Input
                    id="cache-ttl"
                    type="number"
                    value={cacheSettings.ttl}
                    onChange={(e) => setCacheSettings({ ...cacheSettings, ttl: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-size">Max Cache Size (MB)</Label>
                  <Input
                    id="max-size"
                    type="number"
                    value={cacheSettings.maxSize}
                    onChange={(e) => setCacheSettings({ ...cacheSettings, maxSize: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Refresh</Label>
                    <p className="text-sm text-muted-foreground">Automatically refresh cached data</p>
                  </div>
                  <Switch
                    checked={cacheSettings.autoRefresh}
                    onCheckedChange={(checked) => setCacheSettings({ ...cacheSettings, autoRefresh: checked })}
                  />
                </div>

                {cacheSettings.autoRefresh && (
                  <div className="space-y-2">
                    <Label htmlFor="refresh-interval">Refresh Interval (seconds)</Label>
                    <Input
                      id="refresh-interval"
                      type="number"
                      value={cacheSettings.refreshInterval}
                      onChange={(e) => setCacheSettings({ ...cacheSettings, refreshInterval: e.target.value })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Statistics</CardTitle>
                <CardDescription>Current cache usage and performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Entries</span>
                    <Badge variant="secondary">{cacheStats.totalEntries}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Used Space</span>
                    <Badge variant="secondary">{cacheStats.usedSpace}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Hit Rate</span>
                    <Badge variant="secondary">{cacheStats.hitRate}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Cleared</span>
                    <span className="text-sm">{formatDate(cacheStats.lastCleared)}</span>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Clearing cache will remove all stored data and may temporarily slow down the application.
                  </AlertDescription>
                </Alert>

                <Button variant="destructive" onClick={handleClearCache} disabled={isClearing} className="w-full">
                  {isClearing ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {isClearing ? "Clearing Cache..." : "Clear Local Cache"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Email & Push Notifications
                </CardTitle>
                <CardDescription>Configure when and how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive browser push notifications</p>
                  </div>
                  <Switch
                    checked={notificationSettings.pushNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, pushNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Desktop Notifications</Label>
                    <p className="text-sm text-muted-foreground">Show desktop notifications</p>
                  </div>
                  <Switch
                    checked={notificationSettings.desktopNotifications}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, desktopNotifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sound Notifications</Label>
                    <p className="text-sm text-muted-foreground">Play sound for notifications</p>
                  </div>
                  <Switch
                    checked={notificationSettings.soundEnabled}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, soundEnabled: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
                <CardDescription>Choose which events trigger notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Workflow Failures</Label>
                    <p className="text-sm text-muted-foreground">Get notified when workflows fail</p>
                  </div>
                  <Switch
                    checked={notificationSettings.workflowFailures}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, workflowFailures: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Task Completions</Label>
                    <p className="text-sm text-muted-foreground">Get notified when tasks complete successfully</p>
                  </div>
                  <Switch
                    checked={notificationSettings.taskCompletions}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, taskCompletions: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>System Alerts</Label>
                    <p className="text-sm text-muted-foreground">Receive critical system alerts</p>
                  </div>
                  <Switch
                    checked={notificationSettings.systemAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, systemAlerts: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">Receive weekly performance reports</p>
                  </div>
                  <Switch
                    checked={notificationSettings.weeklyReports}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, weeklyReports: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Theme & Layout
                </CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={themeSettings.theme}
                    onValueChange={(value) => setThemeSettings({ ...themeSettings, theme: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select
                    value={themeSettings.fontSize}
                    onValueChange={(value) => setThemeSettings({ ...themeSettings, fontSize: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="extra-large">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Use a more compact layout to fit more content</p>
                  </div>
                  <Switch
                    checked={themeSettings.compactMode}
                    onCheckedChange={(checked) => setThemeSettings({ ...themeSettings, compactMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Contrast</Label>
                    <p className="text-sm text-muted-foreground">Increase contrast for better visibility</p>
                  </div>
                  <Switch
                    checked={themeSettings.highContrast}
                    onCheckedChange={(checked) => setThemeSettings({ ...themeSettings, highContrast: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interface Preferences</CardTitle>
                <CardDescription>Customize interface behavior and interactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Animations</Label>
                    <p className="text-sm text-muted-foreground">Enable smooth transitions and animations</p>
                  </div>
                  <Switch
                    checked={themeSettings.showAnimations}
                    onCheckedChange={(checked) => setThemeSettings({ ...themeSettings, showAnimations: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Tooltips</Label>
                    <p className="text-sm text-muted-foreground">Display helpful tooltips on hover</p>
                  </div>
                  <Switch
                    checked={themeSettings.showTooltips}
                    onCheckedChange={(checked) => setThemeSettings({ ...themeSettings, showTooltips: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Refresh Dashboard</Label>
                    <p className="text-sm text-muted-foreground">Automatically refresh dashboard data</p>
                  </div>
                  <Switch
                    checked={themeSettings.autoRefreshDashboard}
                    onCheckedChange={(checked) => setThemeSettings({ ...themeSettings, autoRefreshDashboard: checked })}
                  />
                </div>

                {themeSettings.autoRefreshDashboard && (
                  <div className="space-y-2">
                    <Label htmlFor="dashboard-refresh">Dashboard Refresh Interval (seconds)</Label>
                    <Input
                      id="dashboard-refresh"
                      type="number"
                      value={themeSettings.refreshInterval}
                      onChange={(e) => setThemeSettings({ ...themeSettings, refreshInterval: e.target.value })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Data Privacy
                </CardTitle>
                <CardDescription>Control how your data is collected and used</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Data Collection</Label>
                    <p className="text-sm text-muted-foreground">Allow collection of usage data for improvements</p>
                  </div>
                  <Switch
                    checked={privacySettings.dataCollection}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, dataCollection: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Analytics Tracking</Label>
                    <p className="text-sm text-muted-foreground">Enable analytics to help improve the service</p>
                  </div>
                  <Switch
                    checked={privacySettings.analyticsTracking}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, analyticsTracking: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Crash Reporting</Label>
                    <p className="text-sm text-muted-foreground">Send crash reports to help fix issues</p>
                  </div>
                  <Switch
                    checked={privacySettings.crashReporting}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, crashReporting: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Share Anonymous Data</Label>
                    <p className="text-sm text-muted-foreground">Share anonymized usage statistics</p>
                  </div>
                  <Switch
                    checked={privacySettings.shareAnonymousData}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, shareAnonymousData: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Configure security and session preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    value={privacySettings.sessionTimeout}
                    onChange={(e) => setPrivacySettings({ ...privacySettings, sessionTimeout: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Cookie Consent</Label>
                    <p className="text-sm text-muted-foreground">Allow cookies for enhanced functionality</p>
                  </div>
                  <Switch
                    checked={privacySettings.cookieConsent}
                    onCheckedChange={(checked) => setPrivacySettings({ ...privacySettings, cookieConsent: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Two-Factor Auth</Label>
                    <p className="text-sm text-muted-foreground">Require 2FA for all sensitive operations</p>
                  </div>
                  <Switch
                    checked={privacySettings.twoFactorRequired}
                    onCheckedChange={(checked) =>
                      setPrivacySettings({ ...privacySettings, twoFactorRequired: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Connected Services
                </CardTitle>
                <CardDescription>Manage your third-party integrations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">GH</span>
                    </div>
                    <div>
                      <Label>GitHub</Label>
                      <p className="text-sm text-muted-foreground">Repository integration</p>
                    </div>
                  </div>
                  <Switch
                    checked={integrationSettings.githubConnected}
                    onCheckedChange={(checked) =>
                      setIntegrationSettings({ ...integrationSettings, githubConnected: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">S</span>
                    </div>
                    <div>
                      <Label>Slack</Label>
                      <p className="text-sm text-muted-foreground">Team communication</p>
                    </div>
                  </div>
                  <Switch
                    checked={integrationSettings.slackConnected}
                    onCheckedChange={(checked) =>
                      setIntegrationSettings({ ...integrationSettings, slackConnected: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">J</span>
                    </div>
                    <div>
                      <Label>Jira</Label>
                      <p className="text-sm text-muted-foreground">Issue tracking</p>
                    </div>
                  </div>
                  <Switch
                    checked={integrationSettings.jiraConnected}
                    onCheckedChange={(checked) =>
                      setIntegrationSettings({ ...integrationSettings, jiraConnected: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">Z</span>
                    </div>
                    <div>
                      <Label>Zapier</Label>
                      <p className="text-sm text-muted-foreground">Workflow automation</p>
                    </div>
                  </div>
                  <Switch
                    checked={integrationSettings.zapierConnected}
                    onCheckedChange={(checked) =>
                      setIntegrationSettings({ ...integrationSettings, zapierConnected: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API & Webhooks</CardTitle>
                <CardDescription>Configure API access and webhook settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Webhooks</Label>
                    <p className="text-sm text-muted-foreground">Allow external services to receive notifications</p>
                  </div>
                  <Switch
                    checked={integrationSettings.webhooksEnabled}
                    onCheckedChange={(checked) =>
                      setIntegrationSettings({ ...integrationSettings, webhooksEnabled: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate-limit">API Rate Limit (requests/hour)</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    value={integrationSettings.apiRateLimit}
                    onChange={(e) => setIntegrationSettings({ ...integrationSettings, apiRateLimit: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowed-domains">Allowed Domains</Label>
                  <Textarea
                    id="allowed-domains"
                    value={integrationSettings.allowedDomains}
                    onChange={(e) => setIntegrationSettings({ ...integrationSettings, allowedDomains: e.target.value })}
                    placeholder="Enter allowed domains, separated by commas"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Performance Optimization
                </CardTitle>
                <CardDescription>Configure performance and loading settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Lazy Loading</Label>
                    <p className="text-sm text-muted-foreground">Load content as needed to improve performance</p>
                  </div>
                  <Switch
                    checked={performanceSettings.lazyLoading}
                    onCheckedChange={(checked) =>
                      setPerformanceSettings({ ...performanceSettings, lazyLoading: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Image Optimization</Label>
                    <p className="text-sm text-muted-foreground">Automatically optimize images for faster loading</p>
                  </div>
                  <Switch
                    checked={performanceSettings.imageOptimization}
                    onCheckedChange={(checked) =>
                      setPerformanceSettings({ ...performanceSettings, imageOptimization: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Prefetch Data</Label>
                    <p className="text-sm text-muted-foreground">Preload data for faster navigation</p>
                  </div>
                  <Switch
                    checked={performanceSettings.prefetchData}
                    onCheckedChange={(checked) =>
                      setPerformanceSettings({ ...performanceSettings, prefetchData: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Service Worker</Label>
                    <p className="text-sm text-muted-foreground">Enable offline functionality and caching</p>
                  </div>
                  <Switch
                    checked={performanceSettings.enableServiceWorker}
                    onCheckedChange={(checked) =>
                      setPerformanceSettings({ ...performanceSettings, enableServiceWorker: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Settings</CardTitle>
                <CardDescription>Configure network and request settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="max-requests">Max Concurrent Requests</Label>
                  <Input
                    id="max-requests"
                    type="number"
                    value={performanceSettings.maxConcurrentRequests}
                    onChange={(e) =>
                      setPerformanceSettings({ ...performanceSettings, maxConcurrentRequests: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-timeout">Request Timeout (seconds)</Label>
                  <Input
                    id="request-timeout"
                    type="number"
                    value={performanceSettings.requestTimeout}
                    onChange={(e) => setPerformanceSettings({ ...performanceSettings, requestTimeout: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compression Enabled</Label>
                    <p className="text-sm text-muted-foreground">Compress data transfers to save bandwidth</p>
                  </div>
                  <Switch
                    checked={performanceSettings.compressionEnabled}
                    onCheckedChange={(checked) =>
                      setPerformanceSettings({ ...performanceSettings, compressionEnabled: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  System Information
                </CardTitle>
                <CardDescription>System details and maintenance options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Application Version</span>
                    <Badge variant="outline">v2.1.4</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Build Date</span>
                    <span className="text-sm">January 15, 2024</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Environment</span>
                    <Badge>Production</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">API Status</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Connected</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Maintenance Actions</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Check for Updates
                    </Button>
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <Database className="mr-2 h-4 w-4" />
                      Export System Logs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Data Management
                </CardTitle>
                <CardDescription>Export and import your workflow data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Export includes workflows, tasks, and settings. Import will overwrite existing data.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Button
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="w-full bg-transparent"
                    variant="outline"
                  >
                    {isExporting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isExporting ? "Exporting..." : "Export Data"}
                  </Button>

                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isImporting}
                    />
                    <Button disabled={isImporting} className="w-full bg-transparent" variant="outline">
                      {isImporting ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {isImporting ? "Importing..." : "Import Data"}
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Storage Usage</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Workflows</span>
                      <span>2.4 MB</span>
                    </div>
                    <Progress value={24} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span>Cache</span>
                      <span>8.7 MB</span>
                    </div>
                    <Progress value={87} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
