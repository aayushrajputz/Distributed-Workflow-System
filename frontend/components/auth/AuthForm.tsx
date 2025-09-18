'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'

interface AuthFormProps {
  onAuthSuccess?: () => void
  redirectTo?: string
}

export default function AuthForm({ onAuthSuccess, redirectTo }: AuthFormProps) {
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  })
  
  const [signupData, setSignupData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!loginData.email || !loginData.password) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const response = await api.login(loginData.email, loginData.password)
      
      // Store the token in localStorage
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      
      toast.success('Login successful!')
      
      if (onAuthSuccess) {
        onAuthSuccess()
      }
      
      // Redirect if specified
      if (redirectTo) {
        window.location.href = redirectTo
      } else {
        // Refresh the page to update authentication state
        window.location.reload()
      }
    } catch (error: any) {
      console.error('Login error:', error)
      
      // Check if error is due to email verification requirement
      if (error.message && error.message.includes('verify your email')) {
        toast.warning(error.message)
      } else {
        toast.error(error.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Signup form submitted:', signupData)
    
    if (!signupData.username || !signupData.email || !signupData.password || 
        !signupData.firstName || !signupData.lastName) {
      toast.error('Please fill in all fields')
      return
    }

    // Username validation - only letters, numbers, and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(signupData.username)) {
      toast.error('Username can only contain letters, numbers, and underscores')
      return
    }

    if (signupData.username.length < 3 || signupData.username.length > 30) {
      toast.error('Username must be between 3 and 30 characters')
      return
    }

    // Password validation - must contain uppercase, lowercase, number, and special character
    if (signupData.password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(signupData.password)) {
      toast.error('Password must contain at least one uppercase letter, lowercase letter, number, and special character (@$!%*?&)')
      return
    }

    // Name validation
    if (signupData.firstName.length > 50 || signupData.lastName.length > 50) {
      toast.error('First name and last name cannot exceed 50 characters')
      return
    }

    setLoading(true)
    try {
      console.log('Making signup API call...')
      const response = await api.register(signupData)
      console.log('Signup API response:', response)
      
      // Check if email verification is required
      const signupResponse = response as { token?: string; user?: any; requiresEmailVerification?: boolean; message?: string }
      
      if (signupResponse.requiresEmailVerification) {
        toast.success(signupResponse.message || 'Account created successfully! Please check your email to verify your account.')
        // Don't store token or redirect - user needs to verify email first
        return
      }
      
      // Store the token in localStorage (normal flow or when email verification is disabled)
      if (response.token) {
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
        console.log('Token and user data stored in localStorage:', {
          token: response.token,
          user: response.user
        })
      }
      
      toast.success('Account created successfully!')
      
      if (onAuthSuccess) {
        onAuthSuccess()
      }
      
      // Redirect if specified
      if (redirectTo) {
        window.location.href = redirectTo
      } else {
        // Refresh the page to update authentication state
        window.location.reload()
      }
    } catch (error: any) {
      console.error('Signup error:', error)
      
      // Handle validation errors from backend
      if (error.status === 400 && error.message === 'Validation failed') {
        toast.error('Please check your input and try again. Make sure all requirements are met.')
      } else if (error.message.includes('already exists') || error.message.includes('already taken')) {
        toast.error(error.message)
      } else {
        toast.error(error.message || 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLoginInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    })
  }

  const handleSignupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSignupData({
      ...signupData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Authentication Required
        </CardTitle>
        <CardDescription>
          Please log in or create an account to access this feature
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  value={loginData.email}
                  onChange={handleLoginInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={handleLoginInputChange}
                    placeholder="Enter your password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Logging in...
                  </div>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Login
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>Demo credentials:</p>
              <p className="font-mono bg-gray-100 p-2 rounded mt-1">
                Email: demo@example.com<br />
                Password: Demo123!@#
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-firstName">First Name</Label>
                  <Input
                    id="signup-firstName"
                    name="firstName"
                    value={signupData.firstName}
                    onChange={handleSignupInputChange}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-lastName">Last Name</Label>
                  <Input
                    id="signup-lastName"
                    name="lastName"
                    value={signupData.lastName}
                    onChange={handleSignupInputChange}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  name="username"
                  value={signupData.username}
                  onChange={handleSignupInputChange}
                  placeholder="johndoe123"
                  required
                />
                <p className="text-xs text-gray-500">
                  3-30 characters, letters, numbers, and underscores only
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  value={signupData.email}
                  onChange={handleSignupInputChange}
                  placeholder="john@example.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={signupData.password}
                    onChange={handleSignupInputChange}
                    placeholder="Create a strong password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Must be 8+ characters with uppercase, lowercase, number, and special character (@$!%*?&)
                </p>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating account...
                  </div>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
