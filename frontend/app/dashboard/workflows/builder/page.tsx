'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReactFlowProvider } from 'reactflow'
import { toast } from 'sonner'

import WorkflowBuilder from '@/components/workflow-builder/WorkflowBuilder'
import { api } from '@/lib/api'
import { useUserSession } from '@/hooks/use-user-session'

export default function WorkflowBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')
  const mode = searchParams.get('mode') // 'edit', 'view', 'new'
  
  const { user, isAuthenticated } = useUserSession()
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth')
      return
    }

    if (templateId) {
      loadTemplate()
    }
  }, [templateId, isAuthenticated])

  const loadTemplate = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await api.getWorkflowTemplate(templateId)
      if (response.success) {
        setTemplate(response.data)
      } else {
        setError('Failed to load workflow template')
        toast.error('Failed to load workflow template')
      }
    } catch (error: any) {
      console.error('Error loading template:', error)
      setError('Failed to load workflow template')
      toast.error('Failed to load workflow template')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (templateData: any) => {
    try {
      let response
      
      if (templateId && mode === 'edit') {
        // Update existing template
        response = await api.updateWorkflowTemplate(templateId, templateData)
      } else {
        // Create new template
        response = await api.createWorkflowTemplate(templateData)
      }

      if (response.success) {
        toast.success('Workflow saved successfully')
        
        // If it's a new template, redirect to edit mode
        if (!templateId) {
          router.push(`/dashboard/workflows/builder?template=${response.data._id}&mode=edit`)
        }
        
        setTemplate(response.data)
      } else {
        throw new Error(response.message || 'Failed to save workflow')
      }
    } catch (error: any) {
      console.error('Error saving workflow:', error)
      toast.error(error.message || 'Failed to save workflow')
      throw error
    }
  }

  const handleExecute = async (templateData: any, variables: any) => {
    try {
      let templateToExecute = template

      // If template is not saved yet, save it first
      if (!templateId || mode === 'new') {
        const saveResponse = await api.createWorkflowTemplate(templateData)
        if (!saveResponse.success) {
          throw new Error('Failed to save workflow before execution')
        }
        templateToExecute = saveResponse.data
      }

      // Execute the workflow
      const response = await api.executeWorkflowTemplate(templateToExecute._id, {
        variables,
        context: {
          executedBy: user?.email,
          executedAt: new Date().toISOString()
        }
      })

      if (response.success) {
        toast.success('Workflow execution started')
        
        // Redirect to execution monitoring page
        router.push(`/dashboard/workflows/executions/${response.data.executionId}`)
      } else {
        throw new Error(response.message || 'Failed to execute workflow')
      }
    } catch (error: any) {
      console.error('Error executing workflow:', error)
      toast.error(error.message || 'Failed to execute workflow')
      throw error
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access the workflow builder.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow template...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/workflows')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <WorkflowBuilder
        templateId={templateId}
        initialTemplate={template}
        onSave={handleSave}
        onExecute={handleExecute}
        readOnly={mode === 'view'}
      />
    </ReactFlowProvider>
  )
}
