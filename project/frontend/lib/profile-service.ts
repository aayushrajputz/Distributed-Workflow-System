// Profile service for handling user data and avatar uploads
export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  department: string
  bio: string
  location: string
  timezone: string
  avatar: string
  company: string
  website: string
  linkedIn: string
  github: string
  isEmailVerified: boolean
  createdAt: string
  updatedAt: string
}

class ProfileService {
  private readonly STORAGE_KEY = "user_profile"
  private readonly AVATAR_STORAGE_KEY = "user_avatars"
  private profileCache: UserProfile | null = null
  private lastFetchTime: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  private pendingRequest: Promise<UserProfile> | null = null

  // Get current user profile with caching and rate limiting
  async getProfile(): Promise<UserProfile> {
    try {
      // Check if user is authenticated
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) {
        console.warn('No authentication token found in localStorage')
        throw new Error('Not authenticated')
      }

      // Return cached profile if still valid
      const now = Date.now()
      if (this.profileCache && (now - this.lastFetchTime) < this.CACHE_DURATION) {
        console.log('Returning cached profile')
        return this.profileCache
      }

      // If there's already a pending request, return it
      if (this.pendingRequest) {
        console.log('Returning pending profile request')
        return this.pendingRequest
      }

      // Create and cache the API request
      this.pendingRequest = this.fetchProfileFromAPI(token)

      try {
        const profile = await this.pendingRequest
        this.profileCache = profile
        this.lastFetchTime = now
        return profile
      } finally {
        this.pendingRequest = null
      }
    } catch (error) {
      console.error('Error in getProfile:', error)

      // If we have a cached profile and the error is rate limiting, return cached version
      if (this.profileCache && error instanceof Error && error.message.includes('429')) {
        console.log('Rate limited, returning cached profile')
        return this.profileCache
      }

      throw error
    }
  }

  // Separate method for the actual API call
  private async fetchProfileFromAPI(token: string): Promise<UserProfile> {
    console.log('Fetching profile from backend with token:', !!token)
    const response = await fetch('http://localhost:5000/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('Profile API response status:', response.status)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Profile API error:', errorText)

      // Handle rate limiting specifically
      if (response.status === 429) {
        throw new Error(`Rate limited: ${response.status}`)
      }

      throw new Error(`Failed to fetch profile: ${response.status}`)
    }

    const data = await response.json()

    // Transform backend user data to profile format
    const profile: UserProfile = {
      id: data.user?.id || data.id,
      firstName: data.user?.firstName || data.firstName || '',
      lastName: data.user?.lastName || data.lastName || '',
      email: data.user?.email || data.email || '',
      phone: data.user?.phone || '',
      jobTitle: data.user?.jobTitle || '',
      department: data.user?.department || '',
      bio: data.user?.bio || '',
      location: data.user?.location || '',
      timezone: data.user?.timezone || 'America/Los_Angeles',
      avatar: data.user?.avatar || '/diverse-user-avatars.png',
      company: data.user?.company || '',
      website: data.user?.website || '',
      linkedIn: data.user?.linkedIn || '',
      github: data.user?.github || '',
      isEmailVerified: data.user?.isEmailVerified || false,
      createdAt: data.user?.createdAt || data.createdAt || new Date().toISOString(),
      updatedAt: data.user?.updatedAt || data.updatedAt || new Date().toISOString(),
    }

    return profile
  }

  // Clear profile cache (useful after updates or logout)
  clearCache(): void {
    this.profileCache = null
    this.lastFetchTime = 0
    this.pendingRequest = null
    console.log('Profile cache cleared')
  }

  // Update user profile
  async updateProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      // Check if user is authenticated
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      if (!token) {
        throw new Error('Not authenticated')
      }

      // Make API call to update user profile
      const response = await fetch('http://localhost:5000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      const data = await response.json()
      
      // Transform backend user data to profile format
      const profile: UserProfile = {
        id: data.user?.id || data.id,
        firstName: data.user?.firstName || data.firstName || '',
        lastName: data.user?.lastName || data.lastName || '',
        email: data.user?.email || data.email || '',
        phone: data.user?.phone || '',
        jobTitle: data.user?.jobTitle || '',
        department: data.user?.department || '',
        bio: data.user?.bio || '',
        location: data.user?.location || '',
        timezone: data.user?.timezone || 'America/Los_Angeles',
        avatar: data.user?.avatar || '/diverse-user-avatars.png',
        company: data.user?.company || '',
        website: data.user?.website || '',
        linkedIn: data.user?.linkedIn || '',
        github: data.user?.github || '',
        isEmailVerified: data.user?.isEmailVerified || false,
        createdAt: data.user?.createdAt || data.createdAt || new Date().toISOString(),
        updatedAt: data.user?.updatedAt || data.updatedAt || new Date().toISOString(),
      }

      return profile
    } catch (error) {
      console.error("Failed to update profile:", error)
      throw new Error("Failed to update profile")
    }
  }

  // Upload avatar image
  async uploadAvatar(file: File): Promise<string> {
    try {
      // Validate file
      if (!file.type.startsWith("image/")) {
        throw new Error("Please select a valid image file")
      }

      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        throw new Error("Image size must be less than 5MB")
      }

      // Simulate upload delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // In a real app, this would upload to a service like Vercel Blob
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string

          // Store in localStorage for persistence (in real app, would be cloud storage)
          const avatars = JSON.parse(localStorage.getItem(this.AVATAR_STORAGE_KEY) || "{}")
          const avatarId = `avatar_${Date.now()}`
          avatars[avatarId] = result
          localStorage.setItem(this.AVATAR_STORAGE_KEY, JSON.stringify(avatars))

          resolve(result)
        }
        reader.onerror = () => reject(new Error("Failed to process image"))
        reader.readAsDataURL(file)
      })
    } catch (error) {
      console.error("Failed to upload avatar:", error)
      throw error
    }
  }

  // Get avatar URL (for retrieving from storage)
  getAvatarUrl(avatarId: string): string {
    try {
      const avatars = JSON.parse(localStorage.getItem(this.AVATAR_STORAGE_KEY) || "{}")
      return avatars[avatarId] || "/diverse-user-avatars.png"
    } catch {
      return "/diverse-user-avatars.png"
    }
  }

  // Delete avatar
  async deleteAvatar(): Promise<void> {
    try {
      const profile = await this.getProfile()
      await this.updateProfile({ avatar: "/diverse-user-avatars.png" })
    } catch (error) {
      console.error("Failed to delete avatar:", error)
      throw new Error("Failed to delete avatar")
    }
  }
}

export const profileService = new ProfileService()
