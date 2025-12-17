'use client'

import { ResponsivePie } from '@nivo/pie'

interface FieldData {
  field: string
  paper_count: number
}

interface FieldsPieProps {
  data: FieldData[]
}

export function FieldsPie({ data }: FieldsPieProps) {
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        No field data available
      </div>
    )
  }

  // Take top 8 fields, group rest as "Other"
  const sorted = [...data].sort((a, b) => b.paper_count - a.paper_count)
  const top = sorted.slice(0, 7)
  const otherCount = sorted.slice(7).reduce((sum, d) => sum + d.paper_count, 0)
  
  const pieData = [
    ...top.map((d) => ({
      id: d.field || 'Unknown',
      label: d.field || 'Unknown',
      value: d.paper_count,
    })),
    ...(otherCount > 0 ? [{ id: 'Other', label: 'Other', value: otherCount }] : []),
  ]

  return (
    <ResponsivePie
      data={pieData}
      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      innerRadius={0.5}
      padAngle={1}
      cornerRadius={4}
      activeOuterRadiusOffset={8}
      colors={{ scheme: 'paired' }}
      borderWidth={1}
      borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
      arcLinkLabelsSkipAngle={10}
      arcLinkLabelsTextColor="#78716c"
      arcLinkLabelsThickness={1}
      arcLinkLabelsColor={{ from: 'color' }}
      arcLabelsSkipAngle={10}
      arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
      enableArcLabels={false}
      legends={[
        {
          anchor: 'right',
          direction: 'column',
          justify: false,
          translateX: 0,
          translateY: 0,
          itemsSpacing: 4,
          itemWidth: 100,
          itemHeight: 16,
          itemOpacity: 0.85,
          symbolSize: 10,
          symbolShape: 'circle',
        },
      ]}
      theme={{
        legends: { text: { fontSize: 10 } },
      }}
      tooltip={({ datum }) => (
        <div className="rounded-lg border border-neutral-100 bg-white px-3 py-2 shadow-soft">
          <div className="font-medium text-neutral-900">{datum.label}</div>
          <div className="text-sm text-neutral-500">
            {datum.value} papers ({((datum.value / pieData.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)}%)
          </div>
        </div>
      )}
    />
  )
}

