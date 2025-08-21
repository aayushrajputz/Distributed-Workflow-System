"use client"

import { toast as sonnerToast } from 'sonner'
import { useToast as useRadixToast } from '@/hooks/use-toast'

// Unified toast hook that provides both Sonner and Radix UI toast
export function useUnifiedToast() {
  const { toast: radixToast } = useRadixToast()

  return {
    // Sonner toast (for simple notifications)
    toast: sonnerToast,
    success: (message: string, description?: string) => {
      sonnerToast.success(message, { description })
    },
    error: (message: string, description?: string) => {
      sonnerToast.error(message, { description })
    },
    info: (message: string, description?: string) => {
      sonnerToast.info(message, { description })
    },
    warning: (message: string, description?: string) => {
      sonnerToast.warning(message, { description })
    },
    
    // Radix toast (for complex notifications with actions)
    radixToast,
    
    // Convenience methods
    showSuccess: (title: string, description?: string) => {
      radixToast({
        title,
        description,
        variant: "default",
      })
    },
    showError: (title: string, description?: string) => {
      radixToast({
        title,
        description,
        variant: "destructive",
      })
    }
  }
}

// Export individual functions for convenience
export const toast = sonnerToast
export const showToast = sonnerToast
export const showSuccess = (message: string, description?: string) => {
  sonnerToast.success(message, { description })
}
export const showError = (message: string, description?: string) => {
  sonnerToast.error(message, { description })
}
export const showInfo = (message: string, description?: string) => {
  sonnerToast.info(message, { description })
}
export const showWarning = (message: string, description?: string) => {
  sonnerToast.warning(message, { description })
}
