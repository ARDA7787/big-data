'use client'

import { ResponsiveBar } from '@nivo/bar'

interface YearSourceData {
  year: number
  arxiv: number
  pubmed: number
  openalex: number
}

interface YearSourceHeatmapProps {
  data: YearSourceData[]
}

export function YearSourceHeatmap({ data }: YearSourceHeatmapProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No data available
      </div>
    )
  }

  // Sort by year
  const sortedData = [...data].sort((a, b) => a.year - b.year)

  return (
    <ResponsiveBar
      data={sortedData}
      keys={['arxiv', 'pubmed', 'openalex']}
      indexBy="year"
      margin={{ top: 20, right: 120, bottom: 50, left: 60 }}
      padding={0.2}
      valueScale={{ type: 'linear' }}
      indexScale={{ type: 'band', round: true }}
      colors={['#ef4444', '#3b82f6', '#f97316']}
      borderRadius={2}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        tickRotation: 0,
        legend: 'Year',
        legendPosition: 'middle',
        legendOffset: 40,
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'Papers',
        legendPosition: 'middle',
        legendOffset: -50,
      }}
      enableGridY={true}
      enableLabel={false}
      legends={[
        {
          dataFrom: 'keys',
          anchor: 'bottom-right',
          direction: 'column',
          justify: false,
          translateX: 100,
          translateY: 0,
          itemsSpacing: 4,
          itemWidth: 80,
          itemHeight: 18,
          itemOpacity: 0.85,
          symbolSize: 12,
          symbolShape: 'circle',
        },
      ]}
      theme={{
        axis: {
          legend: { text: { fill: '#78716c', fontSize: 11 } },
          ticks: { text: { fill: '#78716c', fontSize: 11 } },
        },
        grid: { line: { stroke: '#f5f5f4', strokeDasharray: '4 4' } },
        legends: { text: { fontSize: 11 } },
      }}
      tooltip={({ id, value, indexValue }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft">
          <div className="font-medium text-neutral-900 capitalize">{id}</div>
          <div className="text-sm text-neutral-500">
            {indexValue}: {value} papers
          </div>
        </div>
      )}
    />
  )
}

