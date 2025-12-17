'use client'

import { ResponsiveBar } from '@nivo/bar'

interface CitationDistributionProps {
  data: { citation_count: number }[]
}

export function CitationDistribution({ data }: CitationDistributionProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No data available
      </div>
    )
  }

  // Create histogram buckets
  const buckets = [
    { range: '0', min: 0, max: 0 },
    { range: '1-5', min: 1, max: 5 },
    { range: '6-10', min: 6, max: 10 },
    { range: '11-25', min: 11, max: 25 },
    { range: '26-50', min: 26, max: 50 },
    { range: '51-100', min: 51, max: 100 },
    { range: '100+', min: 101, max: Infinity },
  ]

  const histogram = buckets.map((bucket) => ({
    range: bucket.range,
    count: data.filter(
      (d) => d.citation_count >= bucket.min && d.citation_count <= bucket.max
    ).length,
  }))

  return (
    <ResponsiveBar
      data={histogram}
      keys={['count']}
      indexBy="range"
      margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
      padding={0.3}
      colors={['#5b72f2']}
      borderRadius={4}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'Citation Count Range',
        legendPosition: 'middle',
        legendOffset: 40,
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 10,
        legend: 'Number of Papers',
        legendPosition: 'middle',
        legendOffset: -50,
      }}
      enableGridY={true}
      enableLabel={true}
      labelSkipWidth={16}
      labelSkipHeight={12}
      labelTextColor="#ffffff"
      theme={{
        axis: {
          legend: { text: { fill: '#78716c', fontSize: 11 } },
          ticks: { text: { fill: '#78716c', fontSize: 11 } },
        },
        grid: { line: { stroke: '#f5f5f4', strokeDasharray: '4 4' } },
        labels: { text: { fontSize: 10, fontWeight: 600 } },
      }}
      tooltip={({ indexValue, value }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft">
          <div className="font-medium text-neutral-900">{indexValue} citations</div>
          <div className="text-sm text-neutral-500">{value} papers</div>
        </div>
      )}
    />
  )
}

