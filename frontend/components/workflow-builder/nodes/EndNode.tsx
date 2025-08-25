import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { CheckCircle } from 'lucide-react'

export default function EndNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-red-100 border-2 ${
      selected ? 'border-red-500' : 'border-red-300'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-red-500"
      />
      
      <div className="flex items-center">
        <CheckCircle className="w-4 h-4 mr-2 text-red-600" />
        <div className="text-sm font-medium text-red-800">
          {data.label || 'End'}
        </div>
      </div>
    </div>
  )
}
