import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Mail, Users } from 'lucide-react'

export default function EmailNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-cyan-50 border-2 min-w-[180px] ${
      selected ? 'border-cyan-500' : 'border-cyan-300'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-cyan-500"
      />
      
      <div className="space-y-2">
        <div className="flex items-center">
          <Mail className="w-4 h-4 mr-2 text-cyan-600" />
          <div className="text-sm font-medium text-cyan-800">
            {data.label || 'Email'}
          </div>
        </div>
        
        {data.subject && (
          <div className="text-xs text-cyan-600 max-w-[160px] truncate">
            Subject: {data.subject}
          </div>
        )}
        
        {data.recipients && data.recipients.length > 0 && (
          <div className="flex items-center text-xs text-cyan-600">
            <Users className="w-3 h-3 mr-1" />
            {data.recipients.length} recipient{data.recipients.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-cyan-500"
      />
    </div>
  )
}
