'use client'

import { ResponsiveLine } from '@nivo/line'
import { TopicTrend } from '@/lib/api'

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
      <div className="flex h-full items-center justify-center text-neutral-400">
        No trend data available
      </div>
    )
  }

  // Group by topic
  const groupedByTopic = data.reduce((acc, item) => {
    if (!acc[item.topic_id]) {
      acc[item.topic_id] = {
        id: item.label,
        topic_id: item.topic_id,
        color: topicColors[item.topic_id % topicColors.length],
        data: [],
      }
    }
    acc[item.topic_id].data.push({
      x: item.year,
      y: item.topic_share,
    })
    return acc
  }, {} as Record<number, any>)

  let chartData = Object.values(groupedByTopic)

  // Filter to selected topic if specified
  if (selectedTopic !== null) {
    chartData = chartData.filter((series) => series.topic_id === selectedTopic)
  } else {
    // Limit to top 5 topics by average share
    chartData = chartData
      .map((series) => ({
        ...series,
        avgShare: series.data.reduce((sum: number, d: any) => sum + d.y, 0) / series.data.length,
      }))
      .sort((a, b) => b.avgShare - a.avgShare)
      .slice(0, 5)
  }

  return (
    <ResponsiveLine
      data={chartData}
      margin={{ top: 20, right: 120, bottom: 50, left: 60 }}
      xScale={{ type: 'point' }}
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
            {point.data.xFormatted}: {((point.data.y as number) * 100).toFixed(1)}%
          </div>
        </div>
      )}
    />
  )
}

