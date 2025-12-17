'use client'

import { ResponsiveStream } from '@nivo/stream'
import { TopicTrend } from '@/lib/api'

interface TopicStreamProps {
  data: TopicTrend[]
}

const topicColors = [
  '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', 
  '#f97316', '#f59e0b', '#ef4444', '#5b72f2',
]

// Clean topic labels - remove generic/nonsensical terms
function cleanTopicLabel(label: string): string {
  const genericTerms = [
    'identified', 'using', 'based', 'proposed', 'novel', 'method', 'methods',
    'approach', 'approaches', 'study', 'studies', 'analysis', 'results',
    'show', 'demonstrate', 'present', 'work', 'paper', 'research'
  ]
  
  // If the label is a single generic term, try to extract something meaningful
  const lowerLabel = label.toLowerCase().trim()
  if (genericTerms.includes(lowerLabel)) {
    return `Topic ${Math.random().toString(36).substring(7).toUpperCase()}`
  }
  
  // Capitalize first letter
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function TopicStream({ data }: TopicStreamProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No trend data available
      </div>
    )
  }

  // Get unique years and sort them numerically (ascending)
  const years = [...new Set(data.map((d) => Number(d.year)))]
    .filter(y => !isNaN(y) && y > 0)
    .sort((a, b) => a - b)

  if (years.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No valid year data available
      </div>
    )
  }

  // Get top 8 topic IDs by total paper count
  const topicTotals: Record<number, { id: number; label: string; total: number }> = {}
  data.forEach((d) => {
    if (!topicTotals[d.topic_id]) {
      topicTotals[d.topic_id] = { id: d.topic_id, label: cleanTopicLabel(d.label), total: 0 }
    }
    topicTotals[d.topic_id].total += d.paper_count || 0
  })
  
  const sortedTopics = Object.values(topicTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
  
  const topicIds = sortedTopics.map(t => t.id)

  // Create topic label map
  const topicLabels: Record<number, string> = {}
  sortedTopics.forEach((t) => {
    topicLabels[t.id] = t.label
  })

  // Transform data for stream chart: array of {topic1: value, topic2: value, ...}
  // IMPORTANT: Nivo stream expects data array in order, uses index for x-axis
  const streamData = years.map((year) => {
    const yearData: Record<string, number> = {}
    topicIds.forEach((tid) => {
      const item = data.find((d) => Number(d.year) === year && d.topic_id === tid)
      // Ensure non-negative values
      yearData[topicLabels[tid] || `Topic ${tid}`] = Math.max(0, item?.paper_count || 0)
    })
    return yearData
  })

  const keys = topicIds.map((tid) => topicLabels[tid] || `Topic ${tid}`)

  return (
    <ResponsiveStream
      data={streamData}
      keys={keys}
      margin={{ top: 20, right: 120, bottom: 50, left: 60 }}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        tickRotation: 0,
        legend: 'Year',
        legendOffset: 40,
        legendPosition: 'middle',
        // Map indices back to actual years
        format: (value) => {
          const idx = Math.round(value as number)
          return idx >= 0 && idx < years.length ? String(years[idx]) : ''
        },
        // Show a tick for each year
        tickValues: years.map((_, i) => i),
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'Papers',
        legendOffset: -50,
        legendPosition: 'middle',
      }}
      // CHANGED: Use "none" instead of "silhouette" to avoid negative y-values
      // "none" = stacked from baseline 0
      // "silhouette" = centered around 0 (causes negative values)
      // "expand" = 100% stacked (normalized to 0-1)
      offsetType="none"
      order="ascending"
      colors={topicColors}
      fillOpacity={0.85}
      borderWidth={0}
      enableGridX={false}
      enableGridY={true}
      legends={[
        {
          anchor: 'bottom-right',
          direction: 'column',
          translateX: 100,
          itemWidth: 80,
          itemHeight: 16,
          itemOpacity: 0.85,
          symbolSize: 10,
          symbolShape: 'circle',
        },
      ]}
      theme={{
        axis: {
          legend: { text: { fill: '#78716c', fontSize: 11 } },
          ticks: { text: { fill: '#78716c', fontSize: 11 } },
        },
        grid: { line: { stroke: '#f5f5f4', strokeDasharray: '4 4' } },
        legends: { text: { fontSize: 10 } },
      }}
      tooltip={({ layer }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: layer.color }}
            />
            <span className="font-medium text-neutral-900">{layer.id}</span>
          </div>
        </div>
      )}
    />
  )
}
