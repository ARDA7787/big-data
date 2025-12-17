'use client'

import { ResponsiveScatterPlot } from '@nivo/scatterplot'

interface ScatterPlotChartProps {
  data: {
    work_id: string
    title?: string
    pagerank: number
    citation_count: number
    primary_field?: string
  }[]
}

export function ScatterPlotChart({ data }: ScatterPlotChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No comparison data available
      </div>
    )
  }

  const chartData = [
    {
      id: 'papers',
      data: data.map((d) => ({
        x: d.citation_count,
        y: d.pagerank,
        title: d.title,
        field: d.primary_field,
      })),
    },
  ]

  return (
    <ResponsiveScatterPlot
      data={chartData}
      margin={{ top: 20, right: 20, bottom: 60, left: 70 }}
      xScale={{ type: 'linear', min: 0, max: 'auto' }}
      yScale={{ type: 'linear', min: 0, max: 'auto' }}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'Citation Count',
        legendPosition: 'middle',
        legendOffset: 46,
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'PageRank Score',
        legendPosition: 'middle',
        legendOffset: -56,
        format: (v) => (v as number).toFixed(4),
      }}
      colors={['#5b72f2']}
      nodeSize={8}
      useMesh={true}
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
              fontSize: 12,
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
      }}
      tooltip={({ node }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft max-w-xs">
          <div className="font-medium text-neutral-900 text-sm truncate">
            {(node.data as any).title || 'Unknown'}
          </div>
          {(node.data as any).field && (
            <div className="text-xs text-neutral-500 mt-1">
              {(node.data as any).field}
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-neutral-400">Citations:</span>
              <span className="ml-1 font-medium text-neutral-700">
                {(node.data.x as number).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-neutral-400">PageRank:</span>
              <span className="ml-1 font-medium text-neutral-700">
                {(node.data.y as number).toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      )}
    />
  )
}

