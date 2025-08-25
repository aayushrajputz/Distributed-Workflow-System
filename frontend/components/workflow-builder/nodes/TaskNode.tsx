import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Zap, User, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function TaskNode({ data, selected }: NodeProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-blue-100 text-blue-800 border-blue-300'
    }
  }

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-white border-2 min-w-[200px] ${
      selected ? 'border-blue-500' : 'border-gray-300'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500"
      />
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Zap className="w-4 h-4 mr-2 text-blue-600" />
            <div className="text-sm font-medium text-gray-800">
              {data.label || 'Task'}
            </div>
          </div>
          {data.priority && (
            <Badge variant="outline" className={`text-xs ${getPriorityColor(data.priority)}`}>
              {data.priority}
            </Badge>
          )}
        </div>
        
        {data.assignee && (
          <div className="flex items-center text-xs text-gray-600">
            <User className="w-3 h-3 mr-1" />
            {data.assignee}
          </div>
        )}
        
        {data.estimatedHours && (
          <div className="flex items-center text-xs text-gray-600">
            <Clock className="w-3 h-3 mr-1" />
            {data.estimatedHours}h
          </div>
        )}
        
        {data.description && (
          <div className="text-xs text-gray-500 max-w-[180px] truncate">
            {data.description}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  )
}
