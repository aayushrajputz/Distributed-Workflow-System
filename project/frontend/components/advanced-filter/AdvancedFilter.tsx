'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Filter, 
  X, 
  Plus, 
  Calendar as CalendarIcon,
  Download,
  Search,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'

interface FilterCondition {
  id: string
  field: string
  operator: string
  value: any
  type: 'string' | 'number' | 'date' | 'boolean' | 'select'
}

interface AdvancedFilterProps {
  fields: Array<{
    key: string
    label: string
    type: 'string' | 'number' | 'date' | 'boolean' | 'select'
    options?: Array<{ value: string; label: string }>
  }>
  onFilterChange: (filters: FilterCondition[]) => void
  onExport?: (format: string, filters: FilterCondition[]) => void
  initialFilters?: FilterCondition[]
  showExport?: boolean
  exportFormats?: string[]
}

const operators = {
  string: [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_equal', label: 'Greater or Equal' },
    { value: 'less_equal', label: 'Less or Equal' },
    { value: 'between', label: 'Between' }
  ],
  date: [
    { value: 'equals', label: 'On Date' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' }
  ],
  boolean: [
    { value: 'is_true', label: 'Is True' },
    { value: 'is_false', label: 'Is False' }
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'in', label: 'In' },
    { value: 'not_in', label: 'Not In' }
  ]
}

export default function AdvancedFilter({
  fields,
  onFilterChange,
  onExport,
  initialFilters = [],
  showExport = true,
  exportFormats = ['csv', 'excel', 'json']
}: AdvancedFilterProps) {
  const [filters, setFilters] = useState<FilterCondition[]>(initialFilters)
  const [isExpanded, setIsExpanded] = useState(false)
  const [quickSearch, setQuickSearch] = useState('')

  useEffect(() => {
    onFilterChange(filters)
  }, [filters, onFilterChange])

  const addFilter = () => {
    const newFilter: FilterCondition = {
      id: `filter_${Date.now()}`,
      field: fields[0]?.key || '',
      operator: 'contains',
      value: '',
      type: fields[0]?.type || 'string'
    }
    setFilters([...filters, newFilter])
  }

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(filters.map(filter => 
      filter.id === id ? { ...filter, ...updates } : filter
    ))
  }

  const removeFilter = (id: string) => {
    setFilters(filters.filter(filter => filter.id !== id))
  }

  const clearAllFilters = () => {
    setFilters([])
    setQuickSearch('')
  }

  const getFieldType = (fieldKey: string) => {
    return fields.find(f => f.key === fieldKey)?.type || 'string'
  }

  const getFieldOptions = (fieldKey: string) => {
    return fields.find(f => f.key === fieldKey)?.options || []
  }

  const renderValueInput = (filter: FilterCondition) => {
    const field = fields.find(f => f.key === filter.field)
    
    if (!field) return null

    // No value input needed for these operators
    if (['is_empty', 'is_not_empty', 'is_true', 'is_false', 'last_7_days', 'last_30_days', 'this_month', 'last_month'].includes(filter.operator)) {
      return null
    }

    switch (field.type) {
      case 'string':
        return (
          <Input
            placeholder="Enter value..."
            value={filter.value || ''}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-48"
          />
        )

      case 'number':
        if (filter.operator === 'between') {
          return (
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                placeholder="Min"
                value={filter.value?.min || ''}
                onChange={(e) => updateFilter(filter.id, { 
                  value: { ...filter.value, min: e.target.value }
                })}
                className="w-24"
              />
              <span>to</span>
              <Input
                type="number"
                placeholder="Max"
                value={filter.value?.max || ''}
                onChange={(e) => updateFilter(filter.id, { 
                  value: { ...filter.value, max: e.target.value }
                })}
                className="w-24"
              />
            </div>
          )
        }
        return (
          <Input
            type="number"
            placeholder="Enter number..."
            value={filter.value || ''}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-32"
          />
        )

      case 'date':
        if (filter.operator === 'between') {
          return (
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-32">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filter.value?.start ? format(new Date(filter.value.start), 'MMM dd') : 'Start'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filter.value?.start ? new Date(filter.value.start) : undefined}
                    onSelect={(date) => updateFilter(filter.id, { 
                      value: { ...filter.value, start: date?.toISOString() }
                    })}
                  />
                </PopoverContent>
              </Popover>
              <span>to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-32">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filter.value?.end ? format(new Date(filter.value.end), 'MMM dd') : 'End'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filter.value?.end ? new Date(filter.value.end) : undefined}
                    onSelect={(date) => updateFilter(filter.id, { 
                      value: { ...filter.value, end: date?.toISOString() }
                    })}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )
        }
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-48">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filter.value ? format(new Date(filter.value), 'PPP') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filter.value ? new Date(filter.value) : undefined}
                onSelect={(date) => updateFilter(filter.id, { value: date?.toISOString() })}
              />
            </PopoverContent>
          </Popover>
        )

      case 'select':
        if (['in', 'not_in'].includes(filter.operator)) {
          return (
            <div className="w-48">
              <div className="flex flex-wrap gap-1 mb-2">
                {(filter.value || []).map((val: string) => (
                  <Badge key={val} variant="secondary" className="text-xs">
                    {field.options?.find(opt => opt.value === val)?.label || val}
                    <X 
                      className="ml-1 h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        const newValues = (filter.value || []).filter((v: string) => v !== val)
                        updateFilter(filter.id, { value: newValues })
                      }}
                    />
                  </Badge>
                ))}
              </div>
              <Select
                onValueChange={(value) => {
                  const currentValues = filter.value || []
                  if (!currentValues.includes(value)) {
                    updateFilter(filter.id, { value: [...currentValues, value] })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select options..." />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }
        return (
          <Select
            value={filter.value || ''}
            onValueChange={(value) => updateFilter(filter.id, { value })}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select option..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      default:
        return null
    }
  }

  const activeFiltersCount = filters.length + (quickSearch ? 1 : 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Advanced Filters</CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount} active</Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {showExport && onExport && (
              <div className="flex items-center space-x-1">
                {exportFormats.map(format => (
                  <Button
                    key={format}
                    variant="outline"
                    size="sm"
                    onClick={() => onExport(format, filters)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {format.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Simple' : 'Advanced'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quick Search */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Quick search..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {(activeFiltersCount > 0) && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        {isExpanded && (
          <>
            <Separator />
            <div className="space-y-3">
              {filters.map((filter, index) => (
                <div key={filter.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  {index > 0 && (
                    <Badge variant="outline" className="text-xs">AND</Badge>
                  )}
                  
                  {/* Field Selection */}
                  <Select
                    value={filter.field}
                    onValueChange={(value) => {
                      const fieldType = getFieldType(value)
                      updateFilter(filter.id, { 
                        field: value, 
                        type: fieldType,
                        operator: operators[fieldType][0].value,
                        value: ''
                      })
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map(field => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator Selection */}
                  <Select
                    value={filter.operator}
                    onValueChange={(value) => updateFilter(filter.id, { operator: value, value: '' })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators[filter.type].map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value Input */}
                  {renderValueInput(filter)}

                  {/* Remove Filter */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(filter.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Add Filter Button */}
              <Button variant="outline" onClick={addFilter} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </div>
          </>
        )}

        {/* Active Filters Summary */}
        {filters.length > 0 && !isExpanded && (
          <div className="flex flex-wrap gap-2">
            {filters.map(filter => {
              const field = fields.find(f => f.key === filter.field)
              const operator = operators[filter.type].find(op => op.value === filter.operator)
              
              return (
                <Badge key={filter.id} variant="secondary" className="text-xs">
                  {field?.label} {operator?.label} {filter.value}
                  <X 
                    className="ml-1 h-3 w-3 cursor-pointer" 
                    onClick={() => removeFilter(filter.id)}
                  />
                </Badge>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
