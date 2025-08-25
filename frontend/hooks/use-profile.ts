"use client"

import { useState, useEffect } from "react"
import { profileService, type UserProfile } from "@/lib/profile-service"
import { useToast } from "@/hooks/use-toast"

export function useProfile() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Load profile on mount
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const profileData = await profileService.getProfile()
      setProfile(profileData)
    } catch (error) {
      // Only show toast for non-rate-limiting errors
      if (!(error instanceof Error && error.message.includes('429'))) {
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return

    try {
      setIsUpdating(true)
      const updatedProfile = await profileService.updateProfile(updates)
      setProfile(updatedProfile)

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      })

      return updatedProfile
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      })
      throw error
    } finally {
      setIsUpdating(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      setIsUploadingAvatar(true)

      toast({
        title: "Uploading...",
        description: "Your profile picture is being uploaded.",
      })

      const avatarUrl = await profileService.uploadAvatar(file)
      const updatedProfile = await profileService.updateProfile({ avatar: avatarUrl })
      setProfile(updatedProfile)

      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been successfully updated.",
      })

      return avatarUrl
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload avatar",
        variant: "destructive",
      })
      throw error
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const deleteAvatar = async () => {
    try {
      setIsUpdating(true)
      await profileService.deleteAvatar()
      const updatedProfile = await profileService.getProfile()
      setProfile(updatedProfile)

      toast({
        title: "Avatar Removed",
        description: "Your profile picture has been removed.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove avatar",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return {
    profile,
    isLoading,
    isUpdating,
    isUploadingAvatar,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    refreshProfile: loadProfile,
  }
}
