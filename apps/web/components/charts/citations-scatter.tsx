'use client'

import { ResponsiveScatterPlot } from '@nivo/scatterplot'
import { RankedPaper } from '@/lib/api'

interface CitationsScatterProps {
  data: RankedPaper[]
}

const sourceColors: Record<string, string> = {
  arxiv: '#ef4444',
  pubmed: '#3b82f6',
  openalex: '#f97316',
}

export function CitationsScatter({ data }: CitationsScatterProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No data available
      </div>
    )
  }

  // Group by source for different colors
  const sources = ['arxiv', 'pubmed', 'openalex']
  const chartData = sources.map((source) => ({
    id: source,
    data: data
      .filter((d) => d.primary_field?.toLowerCase().includes(source.toLowerCase()) || 
                    (d as any).source === source)
      .map((d) => ({
        x: d.year || 2020,
        y: d.citation_count || 0,
        title: d.title,
        pagerank: d.pagerank,
      }))
      .filter((d) => d.y > 0) // Only show papers with citations
      .slice(0, 50), // Limit for performance
  })).filter((g) => g.data.length > 0)

  // If no source grouping worked, just show all
  if (chartData.every((g) => g.data.length === 0)) {
    chartData.push({
      id: 'all',
      data: data
        .filter((d) => (d.citation_count || 0) > 0)
        .slice(0, 100)
        .map((d) => ({
          x: d.year || 2020,
          y: d.citation_count || 0,
          title: d.title,
          pagerank: d.pagerank,
        })),
    })
  }

  return (
    <ResponsiveScatterPlot
      data={chartData}
      margin={{ top: 20, right: 20, bottom: 60, left: 70 }}
      xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
      yScale={{ type: 'linear', min: 0, max: 'auto' }}
      colors={['#5b72f2', '#10b981', '#f59e0b']}
      nodeSize={8}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'Publication Year',
        legendPosition: 'middle',
        legendOffset: 45,
        format: (v) => String(Math.round(Number(v))),
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'Citation Count',
        legendPosition: 'middle',
        legendOffset: -55,
      }}
      enableGridX={false}
      enableGridY={true}
      useMesh={true}
      theme={{
        axis: {
          legend: { text: { fill: '#78716c', fontSize: 11 } },
          ticks: { text: { fill: '#78716c', fontSize: 11 } },
        },
        grid: { line: { stroke: '#f5f5f4', strokeDasharray: '4 4' } },
      }}
      tooltip={({ node }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft max-w-xs">
          <p className="font-medium text-neutral-900 text-sm line-clamp-2">
            {(node.data as any).title}
          </p>
          <div className="mt-1 text-xs text-neutral-500">
            {node.data.x} • {node.data.y} citations
          </div>
        </div>
      )}
    />
  )
}

