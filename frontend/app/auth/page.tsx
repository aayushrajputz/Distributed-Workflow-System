"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, User, Mail, Lock, UserPlus, LogIn } from 'lucide-react'

export default function AuthPage() {
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })
  
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  })
  
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await api.login(loginData.email, loginData.password)
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      toast.success('Login successful!')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Login error:', error)

      // Handle different types of login errors
      if (error.requiresEmailVerification || (error.message && error.message.includes('verify your email'))) {
        toast.error('Please verify your email address before logging in. Check your email for the verification link.', {
          duration: 6000,
          action: {
            label: 'Resend Email',
            onClick: () => {
              toast.info('Resend verification feature coming soon!')
            }
          }
        })
      } else if (error.message && error.message.includes('Invalid email or password')) {
        toast.error('Invalid email or password. Please check your credentials and try again.')
      } else if (error.message && error.message.includes('Account is locked')) {
        toast.error('Your account has been temporarily locked due to too many failed login attempts. Please try again later.')
      } else if (error.message && error.message.includes('Account is deactivated')) {
        toast.error('Your account has been deactivated. Please contact support for assistance.')
      } else if (error.status === 401) {
        toast.error('Invalid email or password. Please check your credentials and try again.')
      } else if (error.status === 429) {
        toast.error('Too many login attempts. Please wait a few minutes before trying again.')
      } else if (error.status >= 500) {
        toast.error('Server error. Please try again later or contact support if the problem persists.')
      } else {
        // Fallback for any other errors
        const errorMessage = error.message || 'Login failed. Please check your credentials and try again.'
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Signup form submitted with data:', signupData)
    
    if (!signupData.firstName || !signupData.lastName || !signupData.username || 
        !signupData.email || !signupData.password) {
      console.log('Missing required fields')
      toast.error('Please fill in all fields')
      return
    }

    // Username validation
    if (!/^[a-zA-Z0-9_]+$/.test(signupData.username)) {
      console.log('Invalid username format')
      toast.error('Username can only contain letters, numbers, and underscores')
      return
    }

    if (signupData.username.length < 3 || signupData.username.length > 30) {
      console.log('Invalid username length')
      toast.error('Username must be between 3 and 30 characters')
      return
    }

    // Password validation to match backend requirements
    if (signupData.password.length < 8) {
      console.log('Password too short')
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/.test(signupData.password)) {
      console.log('Password does not meet complexity requirements')
      toast.error('Password must contain at least one uppercase letter, lowercase letter, number, and special character (@$!%*?&)')
      return
    }

    console.log('All validations passed, making API call...')
    setLoading(true)

    try {
      console.log('Calling api.register with:', signupData)
      const response = await api.register(signupData)
      console.log('API response:', response)
      
      // Check if email verification is required
      if (response.requiresEmailVerification) {
        toast.success(response.message || 'Account created successfully! Please check your email to verify your account.', {
          duration: 6000
        })
        // Switch to login tab and show message
        setActiveTab('login')
        return
      }

      // Store token and redirect (only if no email verification required - development mode)
      if (response.token) {
        console.log('Storing token and user data:', { token: response.token, user: response.user })
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))

        // Verify token was stored
        const storedToken = localStorage.getItem('token')
        console.log('Token stored successfully:', !!storedToken)

        toast.success('Account created and logged in successfully! (Development mode - email verification skipped)')
        router.push('/dashboard')
      } else {
        // Account created but no token - user needs to log in
        toast.success(response.message || 'Account created successfully! You can now log in.', {
          duration: 4000
        })
        setActiveTab('login')
      }
    } catch (error: any) {
      console.error('Signup error:', error)

      // Handle different types of signup errors
      if (error.message && error.message.includes('User with this email already exists')) {
        toast.error('An account with this email already exists. Please try logging in instead.', {
          duration: 6000,
          action: {
            label: 'Go to Login',
            onClick: () => {
              setActiveTab('login')
              // Pre-fill the email in login form
              setLoginData(prev => ({ ...prev, email: signupData.email }))
            }
          }
        })
      } else if (error.message && error.message.includes('Username already taken')) {
        toast.error('This username is already taken. Please choose a different username.')
      } else if (error.message && error.message.includes('Validation failed')) {
        toast.error('Please check your input. Make sure all fields meet the requirements.')
      } else if (error.status === 400) {
        // Handle validation errors
        const errorMessage = error.message || 'Please check your input and try again.'
        toast.error(errorMessage)
      } else if (error.status === 429) {
        toast.error('Too many signup attempts. Please wait a few minutes before trying again.')
      } else if (error.status >= 500) {
        toast.error('Server error. Please try again later or contact support if the problem persists.')
      } else {
        // Fallback for any other errors
        const errorMessage = error.message || 'Signup failed. Please try again.'
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value,
    })
  }

  const validatePassword = (password: string) => {
    const validation = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    }
    setPasswordValidation(validation)
    return validation
  }

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSignupData({
      ...signupData,
      [name]: value,
    })
    
    // Real-time password validation
    if (name === 'password') {
      validatePassword(value)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Workflow Management System
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your workflow management and API platform
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4 mt-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={loginData.email}
                        onChange={handleLoginChange}
                        placeholder="Enter your email"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={loginData.password}
                        onChange={handleLoginChange}
                        placeholder="Enter your password"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign in
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4 mt-6">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        value={signupData.firstName}
                        onChange={handleSignupChange}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        value={signupData.lastName}
                        onChange={handleSignupChange}
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        required
                        value={signupData.username}
                        onChange={handleSignupChange}
                        placeholder="johndoe"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={signupData.email}
                        onChange={handleSignupChange}
                        placeholder="john@example.com"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={signupData.password}
                        onChange={handleSignupChange}
                        placeholder="Create a strong password"
                        className="pl-10"
                      />
                    </div>
                    
                    {signupData.password && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs space-y-1">
                          <div className={`flex items-center gap-2 ${passwordValidation.length ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordValidation.length ? '✓' : '✗'} At least 8 characters
                          </div>
                          <div className={`flex items-center gap-2 ${passwordValidation.uppercase ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordValidation.uppercase ? '✓' : '✗'} One uppercase letter
                          </div>
                          <div className={`flex items-center gap-2 ${passwordValidation.lowercase ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordValidation.lowercase ? '✓' : '✗'} One lowercase letter
                          </div>
                          <div className={`flex items-center gap-2 ${passwordValidation.number ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordValidation.number ? '✓' : '✗'} One number
                          </div>
                          <div className={`flex items-center gap-2 ${passwordValidation.special ? 'text-green-600' : 'text-red-500'}`}>
                            {passwordValidation.special ? '✓' : '✗'} One special character (@$!%*?&)
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!signupData.password && (
                      <p className="text-xs text-gray-500 mt-1">
                        Must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating account...
                      </>
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
      </div>
    </div>
  )
}
