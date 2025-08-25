"use client"

import { useState, useEffect } from "react"
import { realApiRequest } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mail, CheckCircle, AlertCircle, Clock, Send, Shield, Bell, Trash2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface EmailAddress {
  id: string
  email: string
  isPrimary: boolean
  isVerified: boolean
  addedDate: string
}

interface EmailPreferences {
  frequency: string
  format: string
  language: string
  timezone: string
  unsubscribeAll: boolean
  categories: {
    security: boolean
    workflows: boolean
    tasks: boolean
    reports: boolean
    marketing: boolean
    updates: boolean
  }
}

export default function EmailSettingsPage() {
  const { toast } = useToast()
  const [isAddingEmail, setIsAddingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [isSendingVerification, setIsSendingVerification] = useState<string | null>(null)

  const [emailAddresses, setEmailAddresses] = useState<EmailAddress[]>([])

  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>({
    frequency: "immediate",
    format: "html",
    language: "en",
    timezone: "America/Los_Angeles",
    unsubscribeAll: false,
    categories: {
      security: true,
      workflows: true,
      tasks: false,
      reports: true,
      marketing: false,
      updates: true,
    },
  })

  // Load user's email addresses and preferences on mount
  useEffect(() => {
    loadUserEmails()
    loadEmailPreferences()
  }, [])

  const loadUserEmails = async () => {
    try {
      const response = await realApiRequest('/users/emails')
      if (response.success && response.data) {
        setEmailAddresses(response.data.emails || [])
      }
    } catch (error) {
      console.error('Failed to load email addresses:', error)
      // Start with user's primary email from profile
      loadUserProfile()
    }
  }

  const loadUserProfile = async () => {
    try {
      const response = await realApiRequest('/auth/me')
      if (response.success && response.data) {
        const primaryEmail = {
          id: "primary",
          email: response.data.email,
          isPrimary: true,
          isVerified: response.data.verified || true,
          addedDate: response.data.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]
        }
        setEmailAddresses([primaryEmail])
      }
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const loadEmailPreferences = async () => {
    try {
      const response = await realApiRequest('/users/email-preferences')
      if (response.success && response.data) {
        setEmailPreferences(response.data.preferences)
      }
    } catch (error) {
      console.error('Failed to load email preferences:', error)
    }
  }

  const handleAddEmail = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      })
      return
    }

    if (emailAddresses.some((addr) => addr.email === newEmail)) {
      toast({
        title: "Email already exists",
        description: "This email address is already associated with your account.",
        variant: "destructive",
      })
      return
    }

    setIsAddingEmail(true)
    try {
      const response = await realApiRequest('/users/emails', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail })
      })

      if (response.success) {
        await loadUserEmails() // Reload emails from backend
        setNewEmail("")

        toast({
          title: "Email added",
          description: "Verification email sent. Please check your inbox.",
        })
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add email address. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAddingEmail(false)
    }
  }

  const handleSendVerification = async (emailId: string) => {
    setIsSendingVerification(emailId)
    try {
      const response = await realApiRequest(`/users/emails/${emailId}/verify`, {
        method: 'POST'
      })

      if (response.success) {
        toast({
          title: "Verification sent",
          description: "Please check your inbox for the verification email.",
        })
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification email.",
        variant: "destructive",
      })
    } finally {
      setIsSendingVerification(null)
    }
  }

  const handleSetPrimary = async (emailId: string) => {
    const email = emailAddresses.find((addr) => addr.id === emailId)
    if (!email?.isVerified) {
      toast({
        title: "Email not verified",
        description: "Please verify this email address before setting it as primary.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await realApiRequest(`/users/emails/${emailId}/primary`, {
        method: 'PUT'
      })

      if (response.success) {
        await loadUserEmails() // Reload emails from backend
        toast({
          title: "Primary email updated",
          description: "Your primary email address has been changed.",
        })
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update primary email. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveEmail = async (emailId: string) => {
    const email = emailAddresses.find((addr) => addr.id === emailId)
    if (email?.isPrimary) {
      toast({
        title: "Cannot remove primary email",
        description: "Please set another email as primary before removing this one.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await realApiRequest(`/users/emails/${emailId}`, {
        method: 'DELETE'
      })

      if (response.success) {
        await loadUserEmails()
        toast({
          title: "Email removed",
          description: "Email address has been removed from your account.",
        })
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove email address. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSavePreferences = async () => {
    try {
      const response = await realApiRequest('/users/email-preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences: emailPreferences })
      })

      if (response.success) {
        toast({
          title: "Preferences saved",
          description: "Your email preferences have been updated.",
        })
      } else {
        throw new Error(response.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Email Settings</h1>
        <p className="text-muted-foreground">Manage your email addresses and notification preferences</p>
      </div>

      {/* Email Addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Addresses
          </CardTitle>
          {/* Removed placeholder helper text */}
        </CardHeader>
        <CardContent className="space-y-4">
          {emailAddresses.map((address) => (
            <div key={address.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{address.email}</span>
                    {address.isPrimary && <Badge variant="default">Primary</Badge>}
                    {address.isVerified ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-orange-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Unverified</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Added {new Date(address.addedDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!address.isVerified && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendVerification(address.id)}
                    disabled={isSendingVerification === address.id}
                  >
                    {isSendingVerification === address.id ? (
                      <Clock className="h-4 w-4 mr-1" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    {isSendingVerification === address.id ? "Sending..." : "Verify"}
                  </Button>
                )}

                {!address.isPrimary && address.isVerified && (
                  <Button variant="outline" size="sm" onClick={() => handleSetPrimary(address.id)}>
                    Set Primary
                  </Button>
                )}

                {!address.isPrimary && (
                  <Button variant="outline" size="sm" onClick={() => handleRemoveEmail(address.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Separator />

          <div className="flex gap-2">
            <Input
              placeholder="Add new email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddEmail()}
            />
            <Button onClick={handleAddEmail} disabled={isAddingEmail}>
              {isAddingEmail ? <Clock className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {isAddingEmail ? "Adding..." : "Add Email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Preferences
          </CardTitle>
          <CardDescription>Configure how and when you receive email notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email Frequency</Label>
              <Select
                value={emailPreferences.frequency}
                onValueChange={(value) => setEmailPreferences({ ...emailPreferences, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="hourly">Hourly Digest</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Digest</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email Format</Label>
              <Select
                value={emailPreferences.format}
                onValueChange={(value) => setEmailPreferences({ ...emailPreferences, format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML (Rich)</SelectItem>
                  <SelectItem value="text">Plain Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={emailPreferences.language}
                onValueChange={(value) => setEmailPreferences({ ...emailPreferences, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={emailPreferences.timezone}
                onValueChange={(value) => setEmailPreferences({ ...emailPreferences, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="Europe/London">GMT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Email Categories</h4>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">Login attempts, password changes</p>
                </div>
                <Switch
                  checked={emailPreferences.categories.security}
                  onCheckedChange={(checked) =>
                    setEmailPreferences({
                      ...emailPreferences,
                      categories: { ...emailPreferences.categories, security: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Workflow Notifications</Label>
                  <p className="text-sm text-muted-foreground">Workflow status updates</p>
                </div>
                <Switch
                  checked={emailPreferences.categories.workflows}
                  onCheckedChange={(checked) =>
                    setEmailPreferences({
                      ...emailPreferences,
                      categories: { ...emailPreferences.categories, workflows: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Task Updates</Label>
                  <p className="text-sm text-muted-foreground">Task completions and failures</p>
                </div>
                <Switch
                  checked={emailPreferences.categories.tasks}
                  onCheckedChange={(checked) =>
                    setEmailPreferences({
                      ...emailPreferences,
                      categories: { ...emailPreferences.categories, tasks: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reports</Label>
                  <p className="text-sm text-muted-foreground">Weekly and monthly reports</p>
                </div>
                <Switch
                  checked={emailPreferences.categories.reports}
                  onCheckedChange={(checked) =>
                    setEmailPreferences({
                      ...emailPreferences,
                      categories: { ...emailPreferences.categories, reports: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Product Updates</Label>
                  <p className="text-sm text-muted-foreground">New features and improvements</p>
                </div>
                <Switch
                  checked={emailPreferences.categories.updates}
                  onCheckedChange={(checked) =>
                    setEmailPreferences({
                      ...emailPreferences,
                      categories: { ...emailPreferences.categories, updates: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Marketing</Label>
                  <p className="text-sm text-muted-foreground">Tips, tutorials, and promotions</p>
                </div>
                <Switch
                  checked={emailPreferences.categories.marketing}
                  onCheckedChange={(checked) =>
                    setEmailPreferences({
                      ...emailPreferences,
                      categories: { ...emailPreferences.categories, marketing: checked },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Security alerts cannot be disabled for account safety. You will always receive notifications about login
              attempts and security changes.
            </AlertDescription>
          </Alert>

          <Button onClick={handleSavePreferences} className="w-full">
            Save Email Preferences
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
