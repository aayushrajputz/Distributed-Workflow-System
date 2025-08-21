"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    if (token) {
      verifyEmail(token)
    }
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    setIsVerifying(true)
    try {
      const response = await fetch(`/api/auth/verify-email/${verificationToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        setVerificationStatus('success')
        setMessage(data.message || 'Email verified successfully!')
        
        // Store the token and user data
        if (data.token) {
          localStorage.setItem('token', data.token)
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user))
        }

        toast.success('Email verified successfully! Redirecting to dashboard...')
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setVerificationStatus('error')
        setMessage(data.message || 'Failed to verify email')
        toast.error(data.message || 'Failed to verify email')
      }
    } catch (error) {
      setVerificationStatus('error')
      setMessage('Network error occurred. Please try again.')
      toast.error('Network error occurred. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!resendEmail.trim()) {
      toast.error('Please enter your email address')
      return
    }

    setIsResending(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resendEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Verification email sent successfully!')
        setResendEmail('')
      } else {
        toast.error(data.message || 'Failed to send verification email')
      }
    } catch (error) {
      toast.error('Network error occurred. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  const renderVerificationStatus = () => {
    if (isVerifying) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <h2 className="text-xl font-semibold mb-2">Verifying your email...</h2>
          <p className="text-muted-foreground">Please wait while we verify your email address.</p>
        </div>
      )
    }

    if (verificationStatus === 'success') {
      return (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
          <h2 className="text-xl font-semibold mb-2 text-green-700">Email Verified Successfully!</h2>
          <p className="text-muted-foreground mb-4">{message}</p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Redirecting to dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      )
    }

    if (verificationStatus === 'error') {
      return (
        <div className="text-center py-8">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
          <h2 className="text-xl font-semibold mb-2 text-red-700">Verification Failed</h2>
          <p className="text-muted-foreground mb-6">{message}</p>
          
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium mb-4">Resend Verification Email</h3>
            <form onSubmit={handleResendVerification} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </div>
              <Button type="submit" disabled={isResending} className="w-full">
                {isResending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      )
    }

    return null
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Email Verification</CardTitle>
            <CardDescription>
              No verification token provided
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <p className="text-muted-foreground mb-4">
                Invalid verification link. Please check your email for the correct verification link.
              </p>
              <Button onClick={() => router.push('/auth')} variant="outline">
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Email Verification</CardTitle>
          <CardDescription>
            Verify your email address to complete your registration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderVerificationStatus()}
        </CardContent>
      </Card>
    </div>
  )
}
