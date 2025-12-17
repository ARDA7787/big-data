'use client'

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  loading?: boolean
  trend?: {
    value: number
    label: string
  }
  className?: string
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  loading,
  trend,
  className,
}: StatsCardProps) {
  const isPositiveTrend = trend && trend.value > 0

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-100 bg-white p-5 shadow-soft transition-all hover:shadow-soft-lg',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-500">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
          <Icon className="h-4 w-4 text-primary-600" />
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-neutral-100" />
        ) : (
          <span className="text-2xl font-bold text-neutral-900">
            {formatNumber(value)}
          </span>
        )}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1.5">
          {isPositiveTrend ? (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-error" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              isPositiveTrend ? 'text-success' : 'text-error'
            )}
          >
            {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-neutral-400">{trend.label}</span>
        </div>
      )}
    </div>
  )
}

