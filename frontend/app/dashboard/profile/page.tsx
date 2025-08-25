"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Save, X, Clock, MapPin, Briefcase, Loader2, Trash2, CheckCircle, AlertCircle } from "lucide-react"
import { useProfile } from "@/hooks/use-profile"
import { type UserProfile } from "@/lib/profile-service"

interface ValidationErrors {
  [key: string]: string
}

export default function ProfilePage() {
  const { profile, isLoading, isUpdating, isUploadingAvatar, updateProfile, uploadAvatar, deleteAvatar } = useProfile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [formData, setFormData] = useState<Partial<UserProfile>>({})

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData(profile)
    }
  }, [profile])

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.firstName?.trim()) {
      newErrors.firstName = "First name is required"
    }
    if (!formData.lastName?.trim()) {
      newErrors.lastName = "Last name is required"
    }
    // Phone number is optional, but if provided, should be valid
    if (formData.phone && formData.phone.trim() && !/^\+?[\d\s\-()]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number"
    }
    if (formData.website && formData.website.trim() && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = "Please enter a valid URL (starting with http:// or https://)"
    }
    if (formData.linkedIn && formData.linkedIn.trim() && !/^https?:\/\/(www\.)?linkedin\.com\/.+/.test(formData.linkedIn)) {
      newErrors.linkedIn = "Please enter a valid LinkedIn URL"
    }
    if (formData.github && formData.github.trim() && !/^https?:\/\/(www\.)?github\.com\/.+/.test(formData.github)) {
      newErrors.github = "Please enter a valid GitHub URL"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    try {
      await updateProfile(formData)
      setIsEditing(false)
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const handleCancel = () => {
    setFormData(profile || {})
    setErrors({})
    setIsEditing(false)
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        await uploadAvatar(file)
      } catch (error) {
        // Error handling is done in the hook
      }
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDeleteAvatar = async () => {
    try {
      await deleteAvatar()
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  const hasChanges = () => {
    if (!profile) return false
    return JSON.stringify(formData) !== JSON.stringify(profile)
  }

  const formatMemberSince = (createdAt: string | undefined): string => {
    if (!createdAt) return 'Unknown'
    
    try {
      const createdDate = new Date(createdAt)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - createdDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) return 'Today'
      if (diffDays === 2) return 'Yesterday'
      if (diffDays < 30) return `${diffDays} days`
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`
      return `${Math.floor(diffDays / 365)} years`
    } catch (error) {
      console.error('Error formatting date:', error)
      return 'Unknown'
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load profile data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profile Details</h1>
          <p className="text-muted-foreground">Manage your personal information and profile settings</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isUpdating || !hasChanges()}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={isUpdating}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your basic profile information and contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar || "/placeholder.svg"} alt="Profile" />
                <AvatarFallback className="text-lg">
                  {(profile.firstName?.[0] || '') + (profile.lastName?.[0] || '')}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <div className="absolute -bottom-2 -right-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 rounded-full p-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                  {profile.avatar && profile.avatar !== "/diverse-user-avatars.png" && profile.avatar !== "/placeholder.svg" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 w-8 rounded-full p-0"
                      onClick={handleDeleteAvatar}
                      disabled={isUpdating}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">
                {`${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'No name set'}
              </h3>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Briefcase className="h-4 w-4" />
                <span>{profile.jobTitle || 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" />
                <span>{profile.location || 'Not specified'}</span>
              </div>
              <Badge variant="secondary" className="mt-2">
                {profile.department || 'Not specified'}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                disabled={!isEditing}
                className={errors.firstName ? "border-destructive" : ""}
              />
              {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                disabled={!isEditing}
                className={errors.lastName ? "border-destructive" : ""}
              />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={profile.email || ""} disabled={true} className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email changes require verification</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={!isEditing}
                className={errors.phone ? "border-destructive" : ""}
                placeholder="+1 (555) 123-4567"
              />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={formData.jobTitle || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, jobTitle: e.target.value }))}
                disabled={!isEditing}
                placeholder="Software Engineer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, department: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Product">Product</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="HR">Human Resources</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                disabled={!isEditing}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                disabled={!isEditing}
                placeholder="San Francisco, CA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone || ""}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, timezone: value }))}
                disabled={!isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                  <SelectItem value="Asia/Shanghai">China Standard Time (CST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
              disabled={!isEditing}
              rows={4}
              placeholder="Tell us about yourself..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional Links</CardTitle>
          <CardDescription>Your professional and social media profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="website">Personal Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                disabled={!isEditing}
                placeholder="https://yourwebsite.com"
                className={errors.website ? "border-destructive" : ""}
              />
              {errors.website && <p className="text-sm text-destructive">{errors.website}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedIn">LinkedIn Profile</Label>
              <Input
                id="linkedIn"
                type="url"
                value={formData.linkedIn || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, linkedIn: e.target.value }))}
                disabled={!isEditing}
                placeholder="https://linkedin.com/in/username"
                className={errors.linkedIn ? "border-destructive" : ""}
              />
              {errors.linkedIn && <p className="text-sm text-destructive">{errors.linkedIn}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="github">GitHub Profile</Label>
              <Input
                id="github"
                type="url"
                value={formData.github || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, github: e.target.value }))}
                disabled={!isEditing}
                placeholder="https://github.com/username"
                className={errors.github ? "border-destructive" : ""}
              />
              {errors.github && <p className="text-sm text-destructive">{errors.github}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account status and membership details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className={`text-2xl font-bold flex items-center justify-center gap-2 ${profile.isEmailVerified ? 'text-green-600' : 'text-red-600'}`}>
                {profile.isEmailVerified ? (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Verified
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5" />
                    Unverified
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground">Email Status</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {formatMemberSince(profile.createdAt)}
              </div>
              <div className="text-sm text-muted-foreground">Member Since</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">User</div>
              <div className="text-sm text-muted-foreground">Role</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                <Clock className="h-5 w-5" />
                Online
              </div>
              <div className="text-sm text-muted-foreground">Status</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}