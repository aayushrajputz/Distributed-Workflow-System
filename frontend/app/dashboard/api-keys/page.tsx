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

  const handleDeleteKey = async (id: string) => {
    try {
      await api.deleteApiKey(id)
      fetchApiKeys()
      toast.success('API key deleted successfully')
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
    })
  }

  const getPermissionBadgeColor = (permission: string) => {
    switch (permission) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'write': return 'bg-yellow-100 text-yellow-800'
      case 'read': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (authError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage your API keys to access the platform programmatically.</p>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Authentication Required
            </h3>
            <p className="text-gray-500 text-center mb-6">
              Authentication required to manage API keys
            </p>
            <AuthForm onAuthSuccess={() => {
              setAuthError(false)
              fetchApiKeys()
            }} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage your API keys to access the platform programmatically.</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage your API keys to access the platform programmatically.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key to access the platform programmatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">API Key Name</Label>
              <Input
                id="name"
                placeholder="My API Key"
                value={newKeyData.name}
                onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
              />
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
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateKey} disabled={!newKeyData.name.trim()}>
                Create API Key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
        <div className="grid gap-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                    <CardDescription>
                      Created {formatDate(apiKey.createdAt)} • Last used {apiKey.lastUsed ? formatDate(apiKey.lastUsed) : 'Never'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                      {apiKey.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {apiKey.metadata?.environment || 'development'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">API Key</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className="flex-1 font-mono text-sm bg-gray-50 p-2 rounded border">
                        {visibleKeys.has(apiKey.id) 
                          ? `${apiKey.keyPrefix}${'*'.repeat(32)}`
                          : `${apiKey.keyPrefix}${'*'.repeat(32)}`
                        }
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                      >
                        {visibleKeys.has(apiKey.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`${apiKey.keyPrefix}${'*'.repeat(32)}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Permissions</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {apiKey.permissions.map((permission) => (
                        <Badge
                          key={permission}
                          variant="outline"
                          className={`text-xs ${getPermissionBadgeColor(permission)}`}
                        >
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {apiKey.stats && (
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{apiKey.stats.totalRequests || 0}</div>
                        <div className="text-xs text-gray-500">Total Requests</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{apiKey.stats.successRate || 0}%</div>
                        <div className="text-xs text-gray-500">Success Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{apiKey.stats.requestsToday || 0}</div>
                        <div className="text-xs text-gray-500">Today</div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-2 border-t">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteKey(apiKey.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
