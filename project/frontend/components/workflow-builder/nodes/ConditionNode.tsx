import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { GitBranch } from 'lucide-react'

export default function ConditionNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-yellow-50 border-2 min-w-[160px] ${
      selected ? 'border-yellow-500' : 'border-yellow-300'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-yellow-500"
      />
      
      <div className="flex items-center justify-center">
        <GitBranch className="w-4 h-4 mr-2 text-yellow-600" />
        <div className="text-sm font-medium text-yellow-800">
          {data.label || 'Condition'}
        </div>
      </div>
      
      {data.conditionType && (
        <div className="text-xs text-yellow-600 text-center mt-1">
          {data.conditionType.replace('_', ' ')}
        </div>
      )}
      
      {/* Multiple output handles for different conditions */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="w-3 h-3 bg-green-500"
        style={{ top: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="w-3 h-3 bg-red-500"
        style={{ top: '70%' }}
      />
    </div>
  )
}
