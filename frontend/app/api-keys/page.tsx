'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, RefreshCw, Plus, Key, Copy, Eye, EyeOff, Calendar, Activity } from 'lucide-react'
import { api, ApiKey } from '@/lib/api'
import { toast } from 'sonner'
import AuthForm from '@/components/auth/AuthForm'

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: ['read'],
    environment: 'development'
  })
  const [createdKey, setCreatedKey] = useState<{ apiKey: ApiKey; key: string } | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  // Helper function to check if user is authenticated
  const isAuthenticated = () => {
    // Check if we're on client-side (avoid SSR issues)
    if (typeof window === 'undefined') return false
    
    const token = localStorage.getItem('token')
    if (!token) return false
    
    // Check for obviously invalid tokens
    if (token.length < 50 || !token.includes('.')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return false
    }
    
    try {
      // Basic JWT validation - check if it has 3 parts
      const parts = token.split('.')
      if (parts.length !== 3) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        return false
      }
      
      // Try to decode the payload to check expiration
      const payload = JSON.parse(atob(parts[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      
      // Check if token has required fields
      if (!payload.userId) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        return false
      }
      
      // Check if token is expired
      if (payload.exp && payload.exp < currentTime) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        return false
      }
      
      return true
    } catch (error) {
      // Invalid token format
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return false
    }
  }

  useEffect(() => {
    // Force clear all storage on first load to prevent token issues
    if (typeof window !== 'undefined') {
      const hasCleared = sessionStorage.getItem('storage_cleared')
      if (!hasCleared) {
        localStorage.clear()
        sessionStorage.setItem('storage_cleared', 'true')
        console.log('Cleared localStorage to prevent token issues')
      }
    }
    
    // Check if user is authenticated before fetching API keys
    if (!isAuthenticated()) {
      setAuthError(true)
      setLoading(false)
    } else {
      fetchApiKeys()
    }
  }, [])

  const fetchApiKeys = async () => {
    // Double-check authentication before making API call
    if (!isAuthenticated()) {
      setAuthError(true)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setAuthError(false)
      const response = await api.getApiKeys()
      // Backend returns: { success: true, data: { apiKeys: [...], total: number } }
      setApiKeys(response.data?.apiKeys || response.apiKeys || [])
    } catch (error: any) {
      console.error('Error fetching API keys:', error)
      setApiKeys([]) // Ensure apiKeys is always an array
      if (error.status === 401) {
        setAuthError(true)
      } else {
        toast.error('Failed to fetch API keys')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async () => {
    try {
      const response = await api.createApiKey(newKeyData)
      // Backend returns nested structure: { data: { apiKey: {...}, key: "actual-key" } }
      setCreatedKey({
        apiKey: response.data.apiKey,
        key: response.data.key
      })
      setShowCreateDialog(false)
      setNewKeyData({ name: '', permissions: ['read'], environment: 'development' })
      fetchApiKeys()
      toast.success('API key created successfully!')
    } catch (error) {
      toast.error('Failed to create API key')
      console.error('Error creating API key:', error)
    }
  }

  const handleRegenerateKey = async (id: string) => {
    if (!confirm('Are you sure you want to regenerate this API key? The old key will stop working immediately.')) {
      return
    }

    try {
      const response = await api.regenerateApiKey(id)
      setCreatedKey(response)
      fetchApiKeys()
      toast.success('API key regenerated successfully!')
    } catch (error) {
      toast.error('Failed to regenerate API key')
      console.error('Error regenerating API key:', error)
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }

    try {
      await api.deleteApiKey(id)
      fetchApiKeys()
      toast.success('API key deleted successfully!')
    } catch (error) {
      toast.error('Failed to delete API key')
      console.error('Error deleting API key:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys)
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId)
    } else {
      newVisible.add(keyId)
    }
    setVisibleKeys(newVisible)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-100 text-red-800'
      case 'staging': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">API Keys</h1>
          <p className="text-gray-600 mb-8">
            Authentication required to manage API keys
          </p>
        </div>
        <AuthForm onAuthSuccess={() => {
          setAuthError(false)
          fetchApiKeys()
        }} />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-gray-600 mt-2">
            Manage your API keys to access the platform programmatically.
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to access your account programmatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newKeyData.name}
                  onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                  placeholder="e.g., Production API, Mobile App"
                />
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="space-y-2 mt-2">
                  {['read', 'write', 'admin'].map((permission) => (
                    <div key={permission} className="flex items-center space-x-2">
                      <Checkbox
                        id={permission}
                        checked={newKeyData.permissions.includes(permission)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewKeyData({
                              ...newKeyData,
                              permissions: [...newKeyData.permissions, permission]
                            })
                          } else {
                            setNewKeyData({
                              ...newKeyData,
                              permissions: newKeyData.permissions.filter(p => p !== permission)
                            })
                          }
                        }}
                      />
                      <Label htmlFor={permission} className="capitalize">
                        {permission}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="environment">Environment</Label>
                <Select
                  value={newKeyData.environment}
                  onValueChange={(value) => setNewKeyData({ ...newKeyData, environment: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey} disabled={!newKeyData.name}>
                  Create Key
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Created Key Modal */}
      {createdKey && (
        <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API Key Created Successfully!</DialogTitle>
              <DialogDescription>
                This is the only time you'll see the full API key. Please copy it and store it securely.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>Important:</strong> Store this key securely. You won't be able to see it again.
                </p>
                <div className="bg-white border rounded p-3 font-mono text-sm break-all">
                  {createdKey.key}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copyToClipboard(createdKey.key)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
              <Button onClick={() => setCreatedKey(null)} className="w-full">
                I've Saved the Key
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* API Keys List */}
      {(!apiKeys || apiKeys.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No API keys</h3>
            <p className="text-gray-500 text-center mb-6">
              Get started by creating your first API key to access the platform programmatically.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey._id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Key className="h-5 w-5 text-gray-400" />
                    <div>
                      <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-4 mt-1">
                        <span>{apiKey.keyPrefix}...</span>
                        <Badge className={getEnvironmentColor(apiKey.metadata.environment)}>
                          {apiKey.metadata.environment}
                        </Badge>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Created {formatDate(apiKey.createdAt)}
                        </span>
                        {apiKey.lastUsedAt && (
                          <span className="flex items-center">
                            <Activity className="h-3 w-3 mr-1" />
                            Last used {formatDate(apiKey.lastUsedAt)}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateKey(apiKey._id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteKey(apiKey._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {apiKey.stats?.totalRequests || 0}
                    </div>
                    <div className="text-sm text-gray-500">Total Requests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {apiKey.stats?.successRate || 0}%
                    </div>
                    <div className="text-sm text-gray-500">Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {Math.round(apiKey.stats?.avgResponseTime || 0)}ms
                    </div>
                    <div className="text-sm text-gray-500">Avg Response</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {apiKey.rateLimit.requestsPerHour}
                    </div>
                    <div className="text-sm text-gray-500">Rate Limit/hr</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {apiKey.permissions.map((permission) => (
                    <Badge key={permission} variant="secondary">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
