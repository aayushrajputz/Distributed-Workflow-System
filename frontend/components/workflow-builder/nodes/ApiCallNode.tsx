import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Code, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function ApiCallNode({ data, selected }: NodeProps) {
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-800'
      case 'POST': return 'bg-blue-100 text-blue-800'
      case 'PUT': return 'bg-orange-100 text-orange-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-purple-50 border-2 min-w-[200px] ${
      selected ? 'border-purple-500' : 'border-purple-300'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500"
      />
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Code className="w-4 h-4 mr-2 text-purple-600" />
            <div className="text-sm font-medium text-purple-800">
              {data.label || 'API Call'}
            </div>
          </div>
          {data.httpMethod && (
            <Badge variant="outline" className={`text-xs ${getMethodColor(data.httpMethod)}`}>
              {data.httpMethod}
            </Badge>
          )}
        </div>
        
        {data.apiEndpoint && (
          <div className="flex items-center text-xs text-purple-600">
            <Globe className="w-3 h-3 mr-1" />
            <span className="max-w-[160px] truncate">
              {data.apiEndpoint}
            </span>
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500"
      />
    </div>
  )
}
