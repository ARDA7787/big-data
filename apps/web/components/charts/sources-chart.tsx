'use client'

import { ResponsivePie } from '@nivo/pie'

interface SourcesChartProps {
  data: { source: string; paper_count: number; percentage: number }[]
}

const sourceColors: Record<string, string> = {
  arxiv: '#b31b1b',
  pubmed: '#326599',
  openalex: '#c75e27',
}

export function SourcesChart({ data }: SourcesChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No data available
      </div>
    )
  }

  const chartData = data.map((d) => ({
    id: d.source,
    label: d.source.charAt(0).toUpperCase() + d.source.slice(1),
    value: d.paper_count,
    color: sourceColors[d.source] || '#5b72f2',
  }))

  return (
    <ResponsivePie
      data={chartData}
      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      innerRadius={0.6}
      padAngle={2}
      cornerRadius={4}
      activeOuterRadiusOffset={8}
      colors={{ datum: 'data.color' }}
      borderWidth={0}
      enableArcLinkLabels={false}
      arcLabelsSkipAngle={10}
      arcLabelsTextColor="#ffffff"
      arcLabelsRadiusOffset={0.55}
      theme={{
        labels: {
          text: {
            fontSize: 12,
            fontWeight: 600,
          },
        },
      }}
      tooltip={({ datum }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: datum.color }}
            />
            <span className="font-medium text-neutral-900">{datum.label}</span>
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            {datum.value.toLocaleString()} papers ({((datum.value / data.reduce((sum, d) => sum + d.paper_count, 0)) * 100).toFixed(1)}%)
          </div>
        </div>
      )}
      legends={[
        {
          anchor: 'bottom',
          direction: 'row',
          justify: false,
          translateX: 0,
          translateY: 20,
          itemsSpacing: 20,
          itemWidth: 80,
          itemHeight: 18,
          itemTextColor: '#78716c',
          itemDirection: 'left-to-right',
          symbolSize: 10,
          symbolShape: 'circle',
        },
      ]}
    />
  )
}

