'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Key, AlertTriangle, CheckCircle, RefreshCw, Eye, EyeOff, Info } from 'lucide-react'
import { useApiKey } from '@/contexts/api-key-context'

interface ApiKeySetupProps {
  onComplete?: () => void
  showTitle?: boolean
  className?: string
}

export function ApiKeySetup({ onComplete, showTitle = true, className }: ApiKeySetupProps) {
  const { apiKey, isValidating, isValid, error, setApiKey, clearApiKey, retryValidation } = useApiKey()
  const [inputKey, setInputKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputKey.trim()) return

    const key = inputKey.trim()

    // Basic validation
    if (!key.startsWith('sk_')) {
      toast.error('Invalid API key format. API keys must start with "sk_"')
      return
    }

    if (key.length < 20) {
      toast.error('API key appears to be too short. Please check your key.')
      return
    }

    await setApiKey(key)
    if (onComplete) {
      onComplete()
    }
  }

  const handleClear = () => {
    clearApiKey()
    setInputKey('')
  }

  const handleRetry = async () => {
    await retryValidation()
  }

  const getStatusBadge = () => {
    if (isValidating) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Validating...
        </Badge>
      )
    }
    
    if (isValid) {
      return (
        <Badge variant="default" className="gap-1 bg-green-500">
          <CheckCircle className="h-3 w-3" />
          Valid
        </Badge>
      )
    }
    
    if (error) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Invalid
        </Badge>
      )
    }
    
    return (
      <Badge variant="outline" className="gap-1">
        <Key className="h-3 w-3" />
        Not Set
      </Badge>
    )
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key Configuration
          </CardTitle>
          <CardDescription>
            Configure your API key to access real-time metrics and live data
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Status</Label>
          {getStatusBadge()}
        </div>

        {/* API Key Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk_your_api_key_here"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="pr-10"
                disabled={isValidating}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              type="submit" 
              disabled={!inputKey.trim() || isValidating}
              className="flex-1"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Set API Key
                </>
              )}
            </Button>
            
            {apiKey && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClear}
                disabled={isValidating}
              >
                Clear
              </Button>
            )}
          </div>
        </form>

        {/* Current API Key Display */}
        {apiKey && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current API Key</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-2 py-1 text-sm">
                {showKey ? apiKey : `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`}
              </code>
              {error && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isValidating}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {error.includes('Invalid') && (
                <div className="mt-2">
                  <p className="text-sm">Please check that your API key:</p>
                  <ul className="mt-1 text-sm list-disc list-inside">
                    <li>Starts with "sk_"</li>
                    <li>Has the correct permissions</li>
                    <li>Is active and not expired</li>
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {isValid && !error && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              API key is valid and ready for use. You can now access real-time metrics and live data.
            </AlertDescription>
          </Alert>
        )}

        {/* Help Section */}
        {!apiKey && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Need an API key?</strong>
              <p className="mt-1">Go to the <a href="/api-keys" className="text-blue-600 hover:underline">API Keys page</a> to create a new API key with the required permissions.</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        <div className="text-sm text-muted-foreground">
          <p>
            Need an API key? Visit the{' '}
            <a href="/dashboard/api-keys" className="text-primary hover:underline">
              API Keys page
            </a>{' '}
            to create one.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
