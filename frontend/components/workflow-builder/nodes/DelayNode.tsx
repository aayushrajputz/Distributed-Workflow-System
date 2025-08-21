import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Clock } from 'lucide-react'

export default function DelayNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-lime-50 border-2 min-w-[160px] ${
      selected ? 'border-lime-500' : 'border-lime-300'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-lime-500"
      />
      
      <div className="space-y-2">
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-2 text-lime-600" />
          <div className="text-sm font-medium text-lime-800">
            {data.label || 'Delay'}
          </div>
        </div>
        
        {data.delayAmount && data.delayUnit && (
          <div className="text-xs text-lime-600 text-center">
            {data.delayAmount} {data.delayUnit}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-lime-500"
      />
    </div>
  )
}
