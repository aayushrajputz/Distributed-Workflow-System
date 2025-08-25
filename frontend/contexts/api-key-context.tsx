'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { ApiKeyManager, ApiKeyError } from '@/lib/api'
import { toast } from 'sonner'

interface ApiKeyContextType {
  apiKey: string | null
  isValidating: boolean
  isValid: boolean
  error: string | null
  setApiKey: (key: string) => Promise<void>
  clearApiKey: () => void
  validateApiKey: () => Promise<boolean>
  retryValidation: () => Promise<void>
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined)

interface ApiKeyProviderProps {
  children: ReactNode
}

export function ApiKeyProvider({ children }: ApiKeyProviderProps) {
  const [apiKey, setApiKeyState] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastValidationTime, setLastValidationTime] = useState<number>(0)
  const lastValidationResult = useRef<boolean>(false)
  const validationInProgress = useRef<boolean>(false)
  const apiKeyManager = ApiKeyManager.getInstance()

  // Define validateApiKey function with proper memoization
  const validateApiKey = useCallback(async (): Promise<boolean> => {
    if (!apiKey) {
      setIsValid(false)
      return false
    }

    // Prevent validation spam - only validate once every 5 seconds
    const now = Date.now()
    if (now - lastValidationTime < 5000) {
      console.log('🔑 Skipping API key validation - too recent')
      return lastValidationResult.current
    }

    // Prevent concurrent validations
    if (validationInProgress.current) {
      console.log('🔑 Validation already in progress, skipping')
      return lastValidationResult.current
    }

    try {
      validationInProgress.current = true
      setIsValidating(true)
      setError(null)
      setLastValidationTime(now)

      const valid = await apiKeyManager.validateApiKey()
      setIsValid(valid)
      lastValidationResult.current = valid

      if (valid) {
        toast.success('API key validated successfully')
      } else {
        const errorMessage = 'API key validation failed. Please check that your key is correct and active.'
        setError(errorMessage)
        toast.error(errorMessage, {
          description: 'Make sure your API key starts with "sk_" and has the required permissions.'
        })
      }

      return valid
    } catch (err) {
      const errorMessage = err instanceof ApiKeyError ? err.message : 'Failed to validate API key'
      setError(errorMessage)
      setIsValid(false)
      lastValidationResult.current = false
      return false
    } finally {
      setIsValidating(false)
      validationInProgress.current = false
    }
  }, [apiKey, apiKeyManager, lastValidationTime])

  // Initialize API key from storage on mount
  useEffect(() => {
    const storedKey = apiKeyManager.getApiKey()
    if (storedKey) {
      setApiKeyState(storedKey)
    }
  }, [apiKeyManager])

  // Validate API key when it changes (debounced)
  useEffect(() => {
    if (apiKey) {
      const timeoutId = setTimeout(() => {
        validateApiKey()
      }, 1000) // Debounce validation by 1 second

      return () => clearTimeout(timeoutId)
    } else {
      setIsValid(false)
      setError(null)
    }
  }, [apiKey, validateApiKey])

  const setApiKey = async (key: string): Promise<void> => {
    try {
      setError(null)

      // Set the key first
      apiKeyManager.setApiKey(key)
      setApiKeyState(key)

      // Validation will be triggered by the useEffect

    } catch (err) {
      const errorMessage = err instanceof ApiKeyError ? err.message : 'Failed to set API key'
      setError(errorMessage)
      setIsValid(false)
      toast.error(errorMessage)
    }
  }

  const clearApiKey = (): void => {
    apiKeyManager.clearApiKey()
    setApiKeyState(null)
    setIsValid(false)
    setError(null)
    lastValidationResult.current = false
    toast.info('API key cleared')
  }

  const retryValidation = useCallback(async (): Promise<void> => {
    // Reset validation time to force re-validation
    setLastValidationTime(0)
    await validateApiKey()
  }, [validateApiKey])

  const value: ApiKeyContextType = {
    apiKey,
    isValidating,
    isValid,
    error,
    setApiKey,
    clearApiKey,
    validateApiKey,
    retryValidation,
  }

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey(): ApiKeyContextType {
  const context = useContext(ApiKeyContext)
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider')
  }
  return context
}

// Hook for components that require a valid API key
export function useRequireApiKey(): ApiKeyContextType & { isReady: boolean } {
  const context = useApiKey()
  
  const isReady = context.apiKey !== null && context.isValid && !context.isValidating
  
  return {
    ...context,
    isReady,
  }
}
