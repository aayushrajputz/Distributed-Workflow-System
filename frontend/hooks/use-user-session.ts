'use client'

import { useState, useEffect } from 'react'
import { profileService, UserProfile } from '@/lib/profile-service'

interface UserSessionState {
  user: UserProfile | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
}

export function useUserSession() {
  const [state, setState] = useState<UserSessionState>({
    user: null,
    isLoading: true,
    error: null,
    isAuthenticated: false
  })

  useEffect(() => {
    loadUserProfile()
  }, [])

  const loadUserProfile = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const userProfile = await profileService.getProfile()

      setState({
        user: userProfile,
        isLoading: false,
        error: null,
        isAuthenticated: true
      })
    } catch (error) {
      // Only log non-rate-limiting errors to reduce console noise
      if (!(error instanceof Error && error.message.includes('429'))) {
        console.error('Failed to load user profile:', error)
      }

      setState({
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load user profile',
        isAuthenticated: false
      })
    }
  }

  const refreshProfile = () => {
    loadUserProfile()
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
    }
    setState({
      user: null,
      isLoading: false,
      error: null,
      isAuthenticated: false
    })
  }

  return {
    ...state,
    refreshProfile,
    logout
  }
}
