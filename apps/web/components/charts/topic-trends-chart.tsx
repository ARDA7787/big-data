'use client'

import { ResponsiveLine } from '@nivo/line'
import { TopicTrend } from '@/lib/api'
import { TopicsIllustration } from '@/components/icons/illustrations'

interface TopicTrendsChartProps {
  data: TopicTrend[]
  selectedTopic: number | null
}

const topicColors = [
  '#5b72f2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]

export function TopicTrendsChart({ data, selectedTopic }: TopicTrendsChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-neutral-400">
        <TopicsIllustration className="h-20 w-20 opacity-60" />
        <p className="mt-2 text-sm">No trend data available</p>
      </div>
    )
  }

  // Extract all unique years and sort them numerically
  const allYears = [...new Set(data.map(d => Number(d.year)))].filter(y => !isNaN(y)).sort((a, b) => a - b)
  
  // Validate year ordering (log warning if data was out of order)
  const originalYears = data.map(d => Number(d.year)).filter(y => !isNaN(y))
  const wasMonotonic = originalYears.every((y, i) => i === 0 || y >= originalYears[i-1])
  if (!wasMonotonic) {
    console.warn('[TopicTrendsChart] Data years were not monotonically sorted - applying sort')
  }

  // Group by topic, ensuring each series has data sorted by year
  const groupedByTopic: Record<number, { 
    id: string; 
    topic_id: number; 
    color: string; 
    data: Array<{ x: number; y: number }> 
  }> = {}

  data.forEach((item) => {
    const year = Number(item.year)
    if (isNaN(year)) return

    if (!groupedByTopic[item.topic_id]) {
      groupedByTopic[item.topic_id] = {
        id: item.label,
        topic_id: item.topic_id,
        color: topicColors[item.topic_id % topicColors.length],
        data: [],
      }
    }
    groupedByTopic[item.topic_id].data.push({
      x: year,
      y: item.topic_share,
    })
  })

  // Sort each series' data by year (x) to ensure chronological order
  Object.values(groupedByTopic).forEach(series => {
    series.data.sort((a, b) => a.x - b.x)
  })

  let chartData = Object.values(groupedByTopic)

  // Filter to selected topic if specified
  if (selectedTopic !== null) {
    chartData = chartData.filter((series) => series.topic_id === selectedTopic)
  } else {
    // Limit to top 5 topics by average share
    chartData = chartData
      .map((series) => ({
        ...series,
        avgShare: series.data.reduce((sum, d) => sum + d.y, 0) / series.data.length,
      }))
      .sort((a, b) => b.avgShare - a.avgShare)
      .slice(0, 5)
  }

  // Ensure all series have the same x-axis values by sorting chartData by first year
  // This helps Nivo render x-axis in correct order
  chartData.sort((a, b) => {
    const aFirstYear = a.data[0]?.x ?? 0
    const bFirstYear = b.data[0]?.x ?? 0
    return aFirstYear - bFirstYear
  })

  return (
    <ResponsiveLine
      data={chartData}
      margin={{ top: 20, right: 120, bottom: 50, left: 60 }}
      xScale={{ 
        type: 'linear',  // Use linear scale for numeric years
        min: Math.min(...allYears),
        max: Math.max(...allYears),
      }}
      yScale={{
        type: 'linear',
        min: 0,
        max: 'auto',
        stacked: false,
      }}
      curve="monotoneX"
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        tickRotation: 0,
        legend: 'Year',
        legendOffset: 40,
        legendPosition: 'middle',
        tickValues: allYears, // Explicitly set tick values to sorted years
        format: (value) => String(Math.round(value as number)), // Display as integer
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 10,
        tickRotation: 0,
        format: (value) => `${(value * 100).toFixed(0)}%`,
        legend: 'Topic Share',
        legendOffset: -50,
        legendPosition: 'middle',
      }}
      colors={chartData.map((d) => d.color)}
      lineWidth={2}
      pointSize={6}
      pointColor={{ from: 'color' }}
      pointBorderWidth={2}
      pointBorderColor="#fff"
      enableArea={selectedTopic !== null}
      areaOpacity={0.1}
      useMesh={true}
      enableGridX={false}
      legends={[
        {
          anchor: 'bottom-right',
          direction: 'column',
          justify: false,
          translateX: 100,
          translateY: 0,
          itemsSpacing: 4,
          itemDirection: 'left-to-right',
          itemWidth: 80,
          itemHeight: 18,
          itemOpacity: 0.75,
          symbolSize: 10,
          symbolShape: 'circle',
          symbolBorderColor: 'rgba(0, 0, 0, .5)',
        },
      ]}
      theme={{
        axis: {
          domain: {
            line: {
              stroke: '#e7e5e4',
            },
          },
          legend: {
            text: {
              fill: '#78716c',
              fontSize: 11,
            },
          },
          ticks: {
            text: {
              fill: '#78716c',
              fontSize: 11,
            },
          },
        },
        grid: {
          line: {
            stroke: '#f5f5f4',
            strokeDasharray: '4 4',
          },
        },
        legends: {
          text: {
            fontSize: 11,
          },
        },
      }}
      tooltip={({ point }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: point.serieColor }}
            />
            <span className="font-medium text-neutral-900">{point.serieId}</span>
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            Year {point.data.x}: {((point.data.y as number) * 100).toFixed(1)}%
          </div>
        </div>
      )}
    />
  )
}
