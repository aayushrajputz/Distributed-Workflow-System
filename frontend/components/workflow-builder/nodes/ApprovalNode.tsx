import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { AlertTriangle, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function ApprovalNode({ data, selected }: NodeProps) {
  const getApprovalTypeColor = (type: string) => {
    switch (type) {
      case 'any': return 'bg-green-100 text-green-800'
      case 'all': return 'bg-red-100 text-red-800'
      case 'majority': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-orange-50 border-2 min-w-[180px] ${
      selected ? 'border-orange-500' : 'border-orange-300'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-orange-500"
      />
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 text-orange-600" />
            <div className="text-sm font-medium text-orange-800">
              {data.label || 'Approval'}
            </div>
          </div>
          {data.approvalType && (
            <Badge variant="outline" className={`text-xs ${getApprovalTypeColor(data.approvalType)}`}>
              {data.approvalType}
            </Badge>
          )}
        </div>
        
        {data.approvers && data.approvers.length > 0 && (
          <div className="flex items-center text-xs text-orange-600">
            <Users className="w-3 h-3 mr-1" />
            {data.approvers.length} approver{data.approvers.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      {/* Multiple output handles for approval results */}
      <Handle
        type="source"
        position={Position.Right}
        id="approved"
        className="w-3 h-3 bg-green-500"
        style={{ top: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="rejected"
        className="w-3 h-3 bg-red-500"
        style={{ top: '70%' }}
      />
    </div>
  )
}
