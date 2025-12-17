'use client'

import { useMemo } from 'react'
import { TopicTrend } from '@/lib/api'
import { cn } from '@/lib/utils'

interface TopicHeatmapProps {
  data: TopicTrend[]
  className?: string
}

export function TopicHeatmap({ data, className }: TopicHeatmapProps) {
  // Process data into heatmap format
  const { years, topics, heatmapData, maxValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { years: [], topics: [], heatmapData: {}, maxValue: 0 }
    }

    // Get unique years and topics
    const yearsSet = new Set<number>()
    const topicsMap = new Map<number, string>()
    
    data.forEach(d => {
      yearsSet.add(d.year)
      topicsMap.set(d.topic_id, d.label)
    })
    
    const years = Array.from(yearsSet).sort((a, b) => a - b)
    const topics = Array.from(topicsMap.entries()).map(([id, label]) => ({ id, label }))
    
    // Build heatmap data
    const heatmapData: Record<string, number> = {}
    let maxValue = 0
    
    data.forEach(d => {
      const key = `${d.topic_id}-${d.year}`
      heatmapData[key] = d.paper_count
      if (d.paper_count > maxValue) maxValue = d.paper_count
    })
    
    return { years, topics, heatmapData, maxValue }
  }, [data])

  if (years.length === 0 || topics.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full text-neutral-400 text-sm', className)}>
        <p>No trend data available</p>
      </div>
    )
  }

  // Color scale function
  const getColor = (value: number): string => {
    if (value === 0) return 'bg-neutral-50'
    const intensity = Math.min(value / maxValue, 1)
    
    if (intensity < 0.2) return 'bg-primary-100'
    if (intensity < 0.4) return 'bg-primary-200'
    if (intensity < 0.6) return 'bg-primary-400'
    if (intensity < 0.8) return 'bg-primary-500'
    return 'bg-primary-600'
  }

  const getTextColor = (value: number): string => {
    if (value === 0) return 'text-neutral-300'
    const intensity = Math.min(value / maxValue, 1)
    return intensity > 0.5 ? 'text-white' : 'text-primary-900'
  }

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Scrollable container */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          {/* Header row with years */}
          <div className="flex sticky top-0 bg-white z-10">
            <div className="w-28 shrink-0 p-2 text-xs font-medium text-neutral-500 border-b">
              Topic / Year
            </div>
            {years.map(year => (
              <div
                key={year}
                className="w-14 shrink-0 p-2 text-center text-xs font-medium text-neutral-500 border-b"
              >
                {year}
              </div>
            ))}
          </div>
          
          {/* Data rows */}
          {topics.map(topic => (
            <div key={topic.id} className="flex hover:bg-neutral-50/50">
              <div 
                className="w-28 shrink-0 p-2 text-xs font-medium text-neutral-700 truncate border-b"
                title={topic.label}
              >
                {topic.label}
              </div>
              {years.map(year => {
                const key = `${topic.id}-${year}`
                const value = heatmapData[key] || 0
                return (
                  <div
                    key={year}
                    className={cn(
                      'w-14 shrink-0 p-2 text-center text-xs font-medium border-b border-r transition-colors',
                      getColor(value),
                      getTextColor(value)
                    )}
                    title={`${topic.label} (${year}): ${value} papers`}
                  >
                    {value > 0 ? value : '—'}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-3 border-t mt-2">
        <span className="text-xs text-neutral-500">Fewer</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-neutral-50 border" />
          <div className="w-4 h-4 rounded bg-primary-100" />
          <div className="w-4 h-4 rounded bg-primary-200" />
          <div className="w-4 h-4 rounded bg-primary-400" />
          <div className="w-4 h-4 rounded bg-primary-500" />
          <div className="w-4 h-4 rounded bg-primary-600" />
        </div>
        <span className="text-xs text-neutral-500">More papers</span>
      </div>
    </div>
  )
}

