"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Settings,
  Accessibility,
  Globe,
  Clock,
  Volume2,
  Eye,
  Keyboard,
  Smartphone,
  Monitor,
  Save,
  RotateCcw,
  Bell,
} from "lucide-react"
import { NotificationPreferences } from "@/components/notification-preferences"
import { useToast } from "@/hooks/use-toast"

interface UserPreferences {
  // Interface Preferences
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  numberFormat: string

  // Accessibility
  fontSize: number
  highContrast: boolean
  reducedMotion: boolean
  screenReader: boolean
  keyboardNavigation: boolean
  focusIndicators: boolean

  // Behavior
  autoSave: boolean
  confirmActions: boolean
  showTooltips: boolean
  soundEffects: boolean
  desktopNotifications: boolean

  // Dashboard
  defaultView: string
  itemsPerPage: number
  autoRefresh: boolean
  refreshInterval: number

  // Privacy
  shareUsageData: boolean
  personalizedExperience: boolean
  trackingConsent: boolean
}

export default function PreferencesPage() {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const [preferences, setPreferences] = useState<UserPreferences>({
    // Interface
    language: "en",
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    numberFormat: "en-US",

    // Accessibility
    fontSize: 16,
    highContrast: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: true,
    focusIndicators: true,

    // Behavior
    autoSave: true,
    confirmActions: true,
    showTooltips: true,
    soundEffects: true,
    desktopNotifications: true,

    // Dashboard
    defaultView: "grid",
    itemsPerPage: 25,
    autoRefresh: true,
    refreshInterval: 30,

    // Privacy
    shareUsageData: true,
    personalizedExperience: true,
    trackingConsent: false,
  })

  const [originalPreferences] = useState<UserPreferences>(preferences)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      toast({
        title: "Preferences saved",
        description: "Your preferences have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setPreferences(originalPreferences)
    toast({
      title: "Preferences reset",
      description: "All preferences have been reset to their original values.",
    })
  }

  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(originalPreferences)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Preferences</h1>
          <p className="text-muted-foreground">Customize your experience and interface settings</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Interface Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Interface & Localization
          </CardTitle>
          <CardDescription>Configure language, timezone, and display formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={preferences.language}
                onValueChange={(value) => setPreferences({ ...preferences, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => setPreferences({ ...preferences, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select
                value={preferences.dateFormat}
                onValueChange={(value) => setPreferences({ ...preferences, dateFormat: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                  <SelectItem value="DD MMM YYYY">DD MMM YYYY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select
                value={preferences.timeFormat}
                onValueChange={(value) => setPreferences({ ...preferences, timeFormat: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Accessibility className="h-5 w-5" />
            Accessibility
          </CardTitle>
          <CardDescription>Configure accessibility features for better usability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Font Size: {preferences.fontSize}px</Label>
              <Slider
                value={[preferences.fontSize]}
                onValueChange={([value]) => setPreferences({ ...preferences, fontSize: value })}
                min={12}
                max={24}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Small (12px)</span>
                <span>Large (24px)</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  High Contrast Mode
                </Label>
                <p className="text-sm text-muted-foreground">Increase contrast for better visibility</p>
              </div>
              <Switch
                checked={preferences.highContrast}
                onCheckedChange={(checked) => setPreferences({ ...preferences, highContrast: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Reduced Motion</Label>
                <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
              </div>
              <Switch
                checked={preferences.reducedMotion}
                onCheckedChange={(checked) => setPreferences({ ...preferences, reducedMotion: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  Keyboard Navigation
                </Label>
                <p className="text-sm text-muted-foreground">Enhanced keyboard navigation support</p>
              </div>
              <Switch
                checked={preferences.keyboardNavigation}
                onCheckedChange={(checked) => setPreferences({ ...preferences, keyboardNavigation: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Focus Indicators</Label>
                <p className="text-sm text-muted-foreground">Show clear focus indicators</p>
              </div>
              <Switch
                checked={preferences.focusIndicators}
                onCheckedChange={(checked) => setPreferences({ ...preferences, focusIndicators: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Screen Reader Support</Label>
                <p className="text-sm text-muted-foreground">Optimize for screen readers</p>
              </div>
              <Switch
                checked={preferences.screenReader}
                onCheckedChange={(checked) => setPreferences({ ...preferences, screenReader: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Event Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Control email, in-app, and Slack notifications for task events</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferences />
        </CardContent>
      </Card>

      {/* Behavior Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Behavior & Interactions
          </CardTitle>
          <CardDescription>Configure how the application behaves and responds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-save</Label>
                <p className="text-sm text-muted-foreground">Automatically save changes</p>
              </div>
              <Switch
                checked={preferences.autoSave}
                onCheckedChange={(checked) => setPreferences({ ...preferences, autoSave: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Confirm Actions</Label>
                <p className="text-sm text-muted-foreground">Show confirmation dialogs for destructive actions</p>
              </div>
              <Switch
                checked={preferences.confirmActions}
                onCheckedChange={(checked) => setPreferences({ ...preferences, confirmActions: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Tooltips</Label>
                <p className="text-sm text-muted-foreground">Display helpful tooltips on hover</p>
              </div>
              <Switch
                checked={preferences.showTooltips}
                onCheckedChange={(checked) => setPreferences({ ...preferences, showTooltips: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Sound Effects
                </Label>
                <p className="text-sm text-muted-foreground">Play sounds for notifications and actions</p>
              </div>
              <Switch
                checked={preferences.soundEffects}
                onCheckedChange={(checked) => setPreferences({ ...preferences, soundEffects: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Desktop Notifications
                </Label>
                <p className="text-sm text-muted-foreground">Show browser notifications</p>
              </div>
              <Switch
                checked={preferences.desktopNotifications}
                onCheckedChange={(checked) => setPreferences({ ...preferences, desktopNotifications: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Dashboard Settings
          </CardTitle>
          <CardDescription>Customize your dashboard experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default View</Label>
              <Select
                value={preferences.defaultView}
                onValueChange={(value) => setPreferences({ ...preferences, defaultView: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid View</SelectItem>
                  <SelectItem value="list">List View</SelectItem>
                  <SelectItem value="table">Table View</SelectItem>
                  <SelectItem value="kanban">Kanban Board</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Items Per Page</Label>
              <Select
                value={preferences.itemsPerPage.toString()}
                onValueChange={(value) => setPreferences({ ...preferences, itemsPerPage: Number.parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 items</SelectItem>
                  <SelectItem value="25">25 items</SelectItem>
                  <SelectItem value="50">50 items</SelectItem>
                  <SelectItem value="100">100 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Auto-refresh Dashboard
              </Label>
              <p className="text-sm text-muted-foreground">Automatically refresh dashboard data</p>
            </div>
            <Switch
              checked={preferences.autoRefresh}
              onCheckedChange={(checked) => setPreferences({ ...preferences, autoRefresh: checked })}
            />
          </div>

          {preferences.autoRefresh && (
            <div className="space-y-2">
              <Label>Refresh Interval: {preferences.refreshInterval} seconds</Label>
              <Slider
                value={[preferences.refreshInterval]}
                onValueChange={([value]) => setPreferences({ ...preferences, refreshInterval: value })}
                min={10}
                max={300}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>10 seconds</span>
                <span>5 minutes</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Privacy & Data
          </CardTitle>
          <CardDescription>Control how your data is used to improve your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Share Usage Data</Label>
                <p className="text-sm text-muted-foreground">
                  Help improve the product by sharing anonymous usage data
                </p>
              </div>
              <Switch
                checked={preferences.shareUsageData}
                onCheckedChange={(checked) => setPreferences({ ...preferences, shareUsageData: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Personalized Experience</Label>
                <p className="text-sm text-muted-foreground">
                  Use your data to personalize recommendations and content
                </p>
              </div>
              <Switch
                checked={preferences.personalizedExperience}
                onCheckedChange={(checked) => setPreferences({ ...preferences, personalizedExperience: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Tracking Consent</Label>
                <p className="text-sm text-muted-foreground">Allow third-party analytics and tracking</p>
              </div>
              <Switch
                checked={preferences.trackingConsent}
                onCheckedChange={(checked) => setPreferences({ ...preferences, trackingConsent: checked })}
              />
            </div>
          </div>

          <Alert>
            <AlertDescription>
              These settings control how your data is used. You can change these preferences at any time. Essential
              functionality data is always collected for security and service operation.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {hasChanges && (
        <Alert>
          <AlertDescription className="flex items-center justify-between">
            <span>You have unsaved changes to your preferences.</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
