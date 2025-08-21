import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Play } from 'lucide-react'

export default function StartNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-green-100 border-2 ${
      selected ? 'border-green-500' : 'border-green-300'
    }`}>
      <div className="flex items-center">
        <Play className="w-4 h-4 mr-2 text-green-600" />
        <div className="text-sm font-medium text-green-800">
          {data.label || 'Start'}
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500"
      />
    </div>
  )
}
