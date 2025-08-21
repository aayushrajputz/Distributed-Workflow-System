"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  Eye,
  EyeOff,
  Check,
  X,
  AlertTriangle,
  Clock,
  Smartphone,
  Monitor,
  Key,
  Lock,
  Mail,
  Trash2,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface PasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface PasswordStrength {
  score: number
  feedback: string[]
  isValid: boolean
}

interface SecurityActivity {
  id: string
  action: string
  device: string
  location: string
  timestamp: string
  status: "success" | "failed" | "warning"
}

interface EmailChangeData {
  newEmail: string
  password: string
  verificationSent: boolean
}

interface DeleteAccountData {
  password: string
  confirmation: string
}

export default function SecurityPage() {
  const { toast } = useToast()
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const [emailChangeData, setEmailChangeData] = useState<EmailChangeData>({
    newEmail: "",
    password: "",
    verificationSent: false,
  })
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [emailErrors, setEmailErrors] = useState<{ [key: string]: string }>({})

  const [deleteAccountData, setDeleteAccountData] = useState<DeleteAccountData>({
    password: "",
    confirmation: "",
  })
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState<{ [key: string]: string }>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Mock security activity data
  const securityActivity: SecurityActivity[] = [
    {
      id: "1",
      action: "Password changed",
      device: "Chrome on Windows",
      location: "San Francisco, CA",
      timestamp: "2024-01-15 14:30",
      status: "success",
    },
    {
      id: "2",
      action: "Login attempt",
      device: "Safari on iPhone",
      location: "San Francisco, CA",
      timestamp: "2024-01-15 09:15",
      status: "success",
    },
    {
      id: "3",
      action: "Failed login attempt",
      device: "Unknown device",
      location: "New York, NY",
      timestamp: "2024-01-14 22:45",
      status: "failed",
    },
    {
      id: "4",
      action: "Two-factor authentication enabled",
      device: "Chrome on MacOS",
      location: "San Francisco, CA",
      timestamp: "2024-01-10 16:20",
      status: "success",
    },
  ]

  // Password strength calculation
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    const feedback: string[] = []
    let score = 0

    if (password.length >= 8) {
      score += 20
    } else {
      feedback.push("At least 8 characters")
    }

    if (/[a-z]/.test(password)) {
      score += 20
    } else {
      feedback.push("At least one lowercase letter")
    }

    if (/[A-Z]/.test(password)) {
      score += 20
    } else {
      feedback.push("At least one uppercase letter")
    }

    if (/\d/.test(password)) {
      score += 20
    } else {
      feedback.push("At least one number")
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 20
    } else {
      feedback.push("At least one special character")
    }

    return {
      score,
      feedback,
      isValid: score >= 80,
    }
  }

  const passwordStrength = calculatePasswordStrength(passwordData.newPassword)

  const getStrengthColor = (score: number) => {
    if (score < 40) return "bg-red-500"
    if (score < 60) return "bg-orange-500"
    if (score < 80) return "bg-yellow-500"
    return "bg-green-500"
  }

  const getStrengthText = (score: number) => {
    if (score < 40) return "Weak"
    if (score < 60) return "Fair"
    if (score < 80) return "Good"
    return "Strong"
  }

  const validatePasswordForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = "Current password is required"
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = "New password is required"
    } else if (!passwordStrength.isValid) {
      newErrors.newPassword = "Password does not meet security requirements"
    }

    if (!passwordData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password"
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      newErrors.newPassword = "New password must be different from current password"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePasswordChange = async () => {
    if (!validatePasswordForm()) {
      return
    }

    setIsChangingPassword(true)
    try {
      // TODO: Implement API call to change password
      await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate API call

      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      })

      // Reset form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setErrors({})
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  const validateEmailForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!emailChangeData.newEmail) {
      newErrors.newEmail = "New email address is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailChangeData.newEmail)) {
      newErrors.newEmail = "Please enter a valid email address"
    } else if (emailChangeData.newEmail === "john.doe@example.com") {
      newErrors.newEmail = "New email must be different from current email"
    }

    if (!emailChangeData.password) {
      newErrors.password = "Password is required to change email"
    }

    setEmailErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleEmailChange = async () => {
    if (!validateEmailForm()) {
      return
    }

    setIsChangingEmail(true)
    try {
      // TODO: Implement API call to change email
      await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate API call

      setEmailChangeData((prev) => ({ ...prev, verificationSent: true }))
      toast({
        title: "Verification Email Sent",
        description: `A verification link has been sent to ${emailChangeData.newEmail}. Please check your inbox.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsChangingEmail(false)
    }
  }

  const validateDeleteForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!deleteAccountData.password) {
      newErrors.password = "Password is required to delete account"
    }

    if (deleteAccountData.confirmation !== "DELETE") {
      newErrors.confirmation = 'Please type "DELETE" to confirm'
    }

    setDeleteErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleDeleteAccount = async () => {
    if (!validateDeleteForm()) {
      return
    }

    setIsDeleting(true)
    try {
      // TODO: Implement API call to delete account
      await new Promise((resolve) => setTimeout(resolve, 3000)) // Simulate API call

      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      })

      // Redirect to login or home page
      // window.location.href = "/login"
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground">Manage your account security and authentication</p>
      </div>

      {/* Password Change Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure. Choose a strong password you haven't used before.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              For your security, you'll be logged out of all other devices when you change your password.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  className={errors.currentPassword ? "border-destructive pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility("current")}
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                  className={errors.newPassword ? "border-destructive pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility("new")}
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}

              {/* Password Strength Indicator */}
              {passwordData.newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Password strength:</span>
                    <span
                      className={`text-sm font-medium ${
                        passwordStrength.score < 40
                          ? "text-red-500"
                          : passwordStrength.score < 60
                            ? "text-orange-500"
                            : passwordStrength.score < 80
                              ? "text-yellow-500"
                              : "text-green-500"
                      }`}
                    >
                      {getStrengthText(passwordStrength.score)}
                    </span>
                  </div>
                  <Progress value={passwordStrength.score} className="h-2" />
                  {passwordStrength.feedback.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Requirements:</p>
                      <ul className="space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <X className="h-3 w-3 text-red-500" />
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className={errors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => togglePasswordVisibility("confirm")}
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              {passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-3 w-3" />
                  <span>Passwords match</span>
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={isChangingPassword || !passwordStrength.isValid}
            className="w-full"
          >
            {isChangingPassword ? "Changing Password..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Change Email Address
          </CardTitle>
          <CardDescription>
            Update your email address. You'll need to verify the new email before the change takes effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your current email address is: <strong>john.doe@example.com</strong>
            </AlertDescription>
          </Alert>

          {!emailChangeData.verificationSent ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail">New Email Address</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={emailChangeData.newEmail}
                  onChange={(e) => setEmailChangeData((prev) => ({ ...prev, newEmail: e.target.value }))}
                  placeholder="Enter your new email address"
                  className={emailErrors.newEmail ? "border-destructive" : ""}
                />
                {emailErrors.newEmail && <p className="text-sm text-destructive">{emailErrors.newEmail}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailPassword">Current Password</Label>
                <Input
                  id="emailPassword"
                  type="password"
                  value={emailChangeData.password}
                  onChange={(e) => setEmailChangeData((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter your current password"
                  className={emailErrors.password ? "border-destructive" : ""}
                />
                {emailErrors.password && <p className="text-sm text-destructive">{emailErrors.password}</p>}
              </div>

              <Button onClick={handleEmailChange} disabled={isChangingEmail} className="w-full">
                {isChangingEmail ? "Sending Verification..." : "Send Verification Email"}
              </Button>
            </div>
          ) : (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Verification email sent to <strong>{emailChangeData.newEmail}</strong>. Please check your inbox and
                click the verification link to complete the email change.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account with two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Authenticator App</p>
              <p className="text-sm text-muted-foreground">Use an authenticator app to generate verification codes</p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Enabled
            </Badge>
          </div>
          <Separator className="my-4" />
          <div className="flex gap-2">
            <Button variant="outline">Disable 2FA</Button>
            <Button variant="outline">Backup Codes</Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Security Activity
          </CardTitle>
          <CardDescription>Monitor recent security events on your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {securityActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      activity.status === "success"
                        ? "bg-green-100 text-green-600"
                        : activity.status === "failed"
                          ? "bg-red-100 text-red-600"
                          : "bg-yellow-100 text-yellow-600"
                    }`}
                  >
                    {activity.status === "success" ? (
                      <Check className="h-4 w-4" />
                    ) : activity.status === "failed" ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{activity.action}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {activity.device}
                      </span>
                      <span>{activity.location}</span>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{activity.timestamp}</div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4 bg-transparent">
            View All Activity
          </Button>
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Security Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Strong password enabled</p>
                <p className="text-sm text-green-600">Your password meets all security requirements</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Two-factor authentication active</p>
                <p className="text-sm text-green-600">Your account has an extra layer of security</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">Regular password updates</p>
                <p className="text-sm text-blue-600">Consider changing your password every 90 days</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Account deletion is permanent and cannot be undone. All your data, workflows,
              and settings will be permanently deleted.
            </AlertDescription>
          </Alert>

          <div className="mt-6">
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Delete Account
                  </DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete your account and remove all your data
                    from our servers.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deletePassword">Current Password</Label>
                    <Input
                      id="deletePassword"
                      type="password"
                      value={deleteAccountData.password}
                      onChange={(e) => setDeleteAccountData((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      className={deleteErrors.password ? "border-destructive" : ""}
                    />
                    {deleteErrors.password && <p className="text-sm text-destructive">{deleteErrors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deleteConfirmation">
                      Type <strong>DELETE</strong> to confirm
                    </Label>
                    <Input
                      id="deleteConfirmation"
                      value={deleteAccountData.confirmation}
                      onChange={(e) => setDeleteAccountData((prev) => ({ ...prev, confirmation: e.target.value }))}
                      placeholder="DELETE"
                      className={deleteErrors.confirmation ? "border-destructive" : ""}
                    />
                    {deleteErrors.confirmation && (
                      <p className="text-sm text-destructive">{deleteErrors.confirmation}</p>
                    )}
                  </div>
                </div>

                <DialogFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteAccountData.confirmation !== "DELETE"}
                  >
                    {isDeleting ? "Deleting Account..." : "Delete Account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
