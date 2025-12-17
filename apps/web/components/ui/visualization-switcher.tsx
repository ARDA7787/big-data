'use client'

import { LucideIcon, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface VizOption<T extends string> {
  id: T
  name: string
  icon: LucideIcon
  description?: string
  available?: boolean
}

interface VisualizationSwitcherProps<T extends string> {
  options: VizOption<T>[]
  value: T
  onChange: (value: T) => void
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function VisualizationSwitcher<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: VisualizationSwitcherProps<T>) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-sm',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className="text-sm text-neutral-500">{label}</span>
      )}
      <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
        {options.map((option) => {
          const isAvailable = option.available !== false
          const isActive = value === option.id
          
          return (
            <button
              key={option.id}
              onClick={() => isAvailable && onChange(option.id)}
              disabled={!isAvailable}
              className={cn(
                'flex items-center gap-1.5 rounded-md font-medium transition-all relative',
                sizeClasses[size],
                !isAvailable && 'cursor-not-allowed opacity-50',
                isAvailable && isActive
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : isAvailable
                    ? 'text-neutral-500 hover:text-neutral-700'
                    : 'text-neutral-400'
              )}
              title={option.description || option.name}
            >
              <option.icon className={iconSizes[size]} />
              <span>{option.name}</span>
              {!isAvailable && (
                <Lock className="h-3 w-3 text-neutral-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Pre-configured visualization switchers for common use cases

export interface ChartVizType {
  id: 'line' | 'bar' | 'area' | 'stackedArea' | 'table'
  name: string
  icon: LucideIcon
  available?: boolean
}

export interface GraphVizType {
  id: 'force' | 'list' | 'radial' | 'tree'
  name: string
  icon: LucideIcon
  available?: boolean
}

export interface RankingVizType {
  id: 'list' | 'grid' | 'cards'
  name: string
  icon: LucideIcon
  available?: boolean
}

