'use client'

import { ResponsiveLine } from '@nivo/line'
import { YearlyStats } from '@/lib/api'
import { ChartIllustration } from '@/components/icons/illustrations'

interface YearlyChartProps {
  data: YearlyStats[]
}

export function YearlyChart({ data }: YearlyChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-neutral-400">
        <ChartIllustration className="h-20 w-20 opacity-60" />
        <p className="mt-2 text-sm">No data available</p>
      </div>
    )
  }

  // Sort by year ascending and ensure numeric comparison
  const sortedData = [...data]
    .filter((d) => d.year != null)
    .sort((a, b) => Number(a.year) - Number(b.year))

  const chartData = [
    {
      id: 'publications',
      color: 'hsl(233, 85%, 65%)',
      data: sortedData.map((d) => ({
        x: Number(d.year),
        y: d.paper_count,
      })),
    },
  ]

  return (
    <ResponsiveLine
      data={chartData}
      margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
      xScale={{ type: 'point' }}
      yScale={{
        type: 'linear',
        min: 'auto',
        max: 'auto',
        stacked: false,
        reverse: false,
      }}
      curve="monotoneX"
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        tickRotation: 0,
        format: (value) => String(value),
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 10,
        tickRotation: 0,
        format: (value) =>
          value >= 1000 ? `${(value / 1000).toFixed(0)}K` : String(value),
      }}
      colors={['#5b72f2']}
      lineWidth={3}
      pointSize={0}
      pointColor={{ from: 'color', modifiers: [] }}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      enableArea={true}
      areaBaselineValue={0}
      areaOpacity={0.1}
      useMesh={true}
      enableGridX={false}
      enableGridY={true}
      gridYValues={5}
      theme={{
        axis: {
          domain: {
            line: {
              stroke: '#e7e5e4',
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
        crosshair: {
          line: {
            stroke: '#a8a29e',
            strokeWidth: 1,
            strokeOpacity: 0.5,
          },
        },
      }}
      tooltip={({ point }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft">
          <div className="text-xs text-neutral-500">{point.data.xFormatted}</div>
          <div className="font-semibold text-neutral-900">
            {(point.data.y as number).toLocaleString()} papers
          </div>
        </div>
      )}
    />
  )
}

