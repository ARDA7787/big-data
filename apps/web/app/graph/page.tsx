'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Network, Search, Settings2, AlertCircle, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ForceGraph } from '@/components/charts/force-graph'

export default function GraphPage() {
  const [workId, setWorkId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [hops, setHops] = useState(1)
  const [maxNodes, setMaxNodes] = useState(50)
  const [direction, setDirection] = useState<'both' | 'citing' | 'cited'>('both')

  const { data: graphData, isLoading, error } = useQuery({
    queryKey: ['graph-neighborhood', workId, hops, maxNodes, direction],
    queryFn: () =>
      api.getNeighborhood({
        work_id: workId,
        hops,
        max_nodes: maxNodes,
        direction,
      }),
    enabled: workId.length > 0,
  })

  const { data: graphStats } = useQuery({
    queryKey: ['graph-stats'],
    queryFn: api.getGraphStats,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setWorkId(searchInput)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">
            Citation Graph Explorer
          </h2>
          <p className="text-sm text-neutral-500">
            Visualize citation networks around any paper
          </p>
        </div>

        {/* Graph Stats */}
        {graphStats && (
          <div className="flex gap-4 rounded-lg bg-neutral-50 p-3">
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">
                {formatNumber(graphStats.nodes)}
              </p>
              <p className="text-xs text-neutral-500">Nodes</p>
            </div>
            <div className="w-px bg-neutral-200" />
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">
                {formatNumber(graphStats.edges)}
              </p>
              <p className="text-xs text-neutral-500">Edges</p>
            </div>
            <div className="w-px bg-neutral-200" />
            <div className="text-center">
              <p className="text-lg font-bold text-neutral-900">
                {graphStats.communities}
              </p>
              <p className="text-xs text-neutral-500">Communities</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          {/* Work ID Input */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Paper ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Enter work ID (e.g., abc123def456)"
                className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {/* Hops */}
          <div className="w-24">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Hops
            </label>
            <select
              value={hops}
              onChange={(e) => setHops(parseInt(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 py-2 px-3 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>
          </div>

          {/* Max Nodes */}
          <div className="w-28">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Max Nodes
            </label>
            <select
              value={maxNodes}
              onChange={(e) => setMaxNodes(parseInt(e.target.value))}
              className="w-full rounded-lg border border-neutral-200 py-2 px-3 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          {/* Direction */}
          <div className="w-32">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Direction
            </label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              className="w-full rounded-lg border border-neutral-200 py-2 px-3 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="both">Both</option>
              <option value="citing">Citing</option>
              <option value="cited">Cited by</option>
            </select>
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Explore
            </button>
          </div>
        </form>
      </Card>

      {/* Graph Visualization */}
      <Card className="relative overflow-hidden">
        {/* Loading State */}
        {isLoading && (
          <div className="flex h-[600px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
              <p className="text-sm text-neutral-500">Loading graph...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex h-[600px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-12 w-12 text-error" />
              <p className="font-medium text-neutral-900">Failed to load graph</p>
              <p className="text-sm text-neutral-500">
                The paper may not exist or have no citations
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!workId && !isLoading && (
          <div className="flex h-[600px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Network className="h-12 w-12 text-neutral-300" />
              <p className="font-medium text-neutral-900">Enter a Paper ID</p>
              <p className="text-sm text-neutral-500 max-w-sm">
                Enter a paper's work ID to visualize its citation neighborhood.
                Use the Search page to find paper IDs.
              </p>
            </div>
          </div>
        )}

        {/* Graph */}
        {graphData && !isLoading && (
          <>
            <div className="h-[600px]">
              <ForceGraph
                nodes={graphData.nodes}
                edges={graphData.edges}
                centerNode={graphData.center}
              />
            </div>

            {/* Graph Info */}
            <div className="absolute bottom-4 left-4 rounded-lg bg-white/90 p-3 shadow-soft backdrop-blur">
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-neutral-500">Nodes:</span>
                  <span className="ml-1 font-medium">
                    {graphData.stats.total_nodes}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Edges:</span>
                  <span className="ml-1 font-medium">
                    {graphData.stats.total_edges}
                  </span>
                </div>
                {graphData.stats.truncated && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>Truncated</span>
                  </div>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 rounded-lg bg-white/90 p-3 shadow-soft backdrop-blur">
              <p className="text-xs font-medium text-neutral-500 mb-2">Legend</p>
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <span>Center node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary-500" />
                  <span>Connected papers</span>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Center Node Details */}
      {graphData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900">
                  {graphData.center.title}
                </h3>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-500">
                  {graphData.center.year && <span>{graphData.center.year}</span>}
                  {graphData.center.pagerank && (
                    <span>PageRank: {graphData.center.pagerank.toFixed(4)}</span>
                  )}
                  {graphData.center.citation_count !== undefined && (
                    <span>
                      Citations: {formatNumber(graphData.center.citation_count)}
                    </span>
                  )}
                  {graphData.center.community_id !== undefined && (
                    <span>Community: {graphData.center.community_id}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

