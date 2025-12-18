'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Network, Search, AlertCircle, Zap, ExternalLink, HelpCircle, X, Info,
  Layers, Bookmark, BookmarkCheck, Eye
} from 'lucide-react'
import { api, SearchResult, RankedPaper } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ForceGraph } from '@/components/charts/force-graph'
import { NetworkIllustration } from '@/components/icons/illustrations'
import { useSavedItems } from '@/lib/saved-items-context'

type VizType = 'force' | 'list'

const vizOptions = [
  { id: 'force' as VizType, name: 'Force Graph', icon: Network, description: 'Interactive force-directed layout with advanced controls' },
  { id: 'list' as VizType, name: 'List View', icon: Layers, description: 'Sortable list view' },
]

export default function GraphPage() {
  const [workId, setWorkId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [hops, setHops] = useState(1)
  const [maxNodes, setMaxNodes] = useState(50)
  const [direction, setDirection] = useState<'both' | 'citing' | 'cited'>('both')
  const [vizType, setVizType] = useState<VizType>('force')
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  
  const { savedPapers, toggleSavedPaper, isSavedPaper } = useSavedItems()

  // Search suggestions query
  const { data: suggestions } = useQuery({
    queryKey: ['search-suggestions', searchInput],
    queryFn: () => api.search({ q: searchInput, page_size: 5 }),
    enabled: searchInput.length >= 2,
  })

  // Get top paper to use as default
  const { data: topPapers } = useQuery({
    queryKey: ['top-papers-for-graph'],
    queryFn: () => api.getTopPapers({ sort_by: 'pagerank', limit: 1 }),
  })

  // Auto-load top paper if no work selected
  useEffect(() => {
    if (!workId && topPapers?.length) {
      const topPaper = topPapers[0]
      setWorkId(topPaper.work_id)
      setSearchInput(topPaper.title?.slice(0, 60) + '...')
    }
  }, [topPapers, workId])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    setShowSuggestions(false)
    // If searchInput looks like a work_id, use it directly
    if (searchInput.includes(':')) {
      setWorkId(searchInput)
    }
  }

  const selectSuggestion = (result: SearchResult) => {
    setWorkId(result.work_id)
    setSearchInput(result.title.slice(0, 60) + '...')
    setShowSuggestions(false)
  }

  // Handle saving a node from the graph
  const handleSaveNode = (node: any) => {
    const paper: RankedPaper = {
      work_id: node.id,
      title: node.title,
      year: node.year,
      pagerank: node.pagerank || 0,
      citation_count: node.citation_count || 0,
      primary_field: '',
      community_id: node.community_id,
    }
    toggleSavedPaper(paper)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              Citation Graph Explorer
            </h2>
            <p className="text-sm text-neutral-500">
              Visualize citation networks around any paper
            </p>
          </div>
          
          {/* Help Button */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors"
            title="How to use this page"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>How to use</span>
          </button>
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
          {/* Search Input with Autocomplete */}
          <div className="flex-1 min-w-[300px]" ref={searchRef}>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">
              Search Paper (by title, author, or keywords)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 z-10" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search by title, author, or keywords..."
                className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              
              {/* Autocomplete suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions?.results && suggestions.results.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-neutral-200 bg-white shadow-lg max-h-80 overflow-y-auto"
                  >
                    {suggestions.results.map((result) => (
                      <button
                        key={result.work_id}
                        type="button"
                        onClick={() => selectSuggestion(result)}
                        className="w-full px-4 py-3 text-left hover:bg-primary-50 border-b border-neutral-100 last:border-b-0 transition-colors"
                      >
                        <p className="text-sm font-medium text-neutral-900 line-clamp-1">
                          {result.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                          {result.year && <span>{result.year}</span>}
                          {result.source && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                              {result.source}
                            </span>
                          )}
                          {result.citation_count !== undefined && result.citation_count > 0 && (
                            <span>{formatNumber(result.citation_count)} citations</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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

      {/* Visualization Type Switcher */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">View:</span>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {vizOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setVizType(option.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                vizType === option.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
              title={option.description}
            >
              <option.icon className="h-4 w-4" />
              {option.name}
            </button>
          ))}
        </div>
        
        {/* Saved Papers Badge */}
        {savedPapers.length > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
            <Bookmark className="h-4 w-4" />
            <span>{savedPapers.length} saved</span>
          </div>
        )}
      </div>

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

        {/* Empty State - Only show if not loading and no work selected */}
        {!workId && !isLoading && !topPapers?.length && (
          <div className="flex h-[600px] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <NetworkIllustration />
              <p className="font-medium text-neutral-900">Search for a Paper</p>
              <p className="text-sm text-neutral-500 max-w-sm">
                Search by title, author, or keywords above. Select a paper from the 
                suggestions to visualize its citation network.
              </p>
            </div>
          </div>
        )}

        {/* Graph - Force Layout */}
        {graphData && !isLoading && vizType === 'force' && (
          <div className="h-[650px]">
            <ForceGraph
              nodes={graphData.nodes}
              edges={graphData.edges}
              centerNode={graphData.center}
              onNodeSelect={(node) => setSelectedNode(node)}
              onNodeSave={(node) => handleSaveNode(node)}
              savedNodeIds={new Set(savedPapers.map(p => p.work_id))}
            />
          </div>
        )}

        {/* List View */}
        {graphData && !isLoading && vizType === 'list' && (
          <div className="p-4 max-h-[600px] overflow-y-auto">
            <div className="space-y-2">
              {graphData.nodes.map((node, index) => {
                const isCenter = node.id === graphData.center.id
                const saved = isSavedPaper(node.id)
                return (
                  <div
                    key={node.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      isCenter 
                        ? 'border-amber-200 bg-amber-50' 
                        : 'border-neutral-200 hover:bg-neutral-50'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      isCenter
                        ? 'bg-amber-500 text-white'
                        : 'bg-neutral-100 text-neutral-600'
                    )}>
                      {isCenter ? '★' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {node.title}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-500">
                        {node.year && <span>{node.year}</span>}
                        {node.pagerank && <span>PR: {node.pagerank.toFixed(2)}</span>}
                        {node.citation_count !== undefined && (
                          <span>{formatNumber(node.citation_count)} cites</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSaveNode(node)}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          saved
                            ? 'bg-amber-100 text-amber-600'
                            : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
                        )}
                        title={saved ? 'Remove from saved' : 'Save paper'}
                      >
                        {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => {
                          setWorkId(node.id)
                          setSearchInput(node.title?.slice(0, 60) + '...')
                        }}
                        className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                        title="Explore this paper"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
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
              <button
                onClick={() => handleSaveNode(graphData.center)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-2',
                  isSavedPaper(graphData.center.id)
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                )}
              >
                {isSavedPaper(graphData.center.id) ? (
                  <>
                    <BookmarkCheck className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-neutral-900/70"
              onClick={() => setShowHelp(false)}
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-neutral-900">How to Use the Citation Graph</h2>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-neutral-600">
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">🔍 Search for a Paper</h3>
                  <p>
                    Start typing a paper title, author name, or keywords in the search box. 
                    Select a paper from the suggestions to visualize its citation network.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">🎨 Visualization Modes</h3>
                  <ul className="list-disc list-inside mt-1 text-neutral-500">
                    <li><strong>Force Graph:</strong> Advanced interactive force-directed graph with drag, zoom, settings panel, search within graph, and node customization</li>
                    <li><strong>List View:</strong> Sortable list view - save papers to track them</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">📌 Save Papers</h3>
                  <p>
                    Click the bookmark icon to save papers you're interested in. 
                    Saved papers appear in your profile and persist between sessions.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">📊 Understanding Hops</h3>
                  <ul className="list-disc list-inside text-neutral-500">
                    <li><strong>1 hop:</strong> Direct citations only</li>
                    <li><strong>2-3 hops:</strong> Extended network (may be slower)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-1">⚙️ Force Graph Controls</h3>
                  <ul className="list-disc list-inside text-neutral-500">
                    <li><strong>Settings:</strong> Customize colors (by community/year/citations), node sizes, and physics</li>
                    <li><strong>Search:</strong> Find and highlight specific papers in the graph</li>
                    <li><strong>Zoom:</strong> Use scroll or buttons to zoom; pan by dragging</li>
                    <li><strong>Export:</strong> Download the graph as SVG</li>
                    <li><strong>Simulation:</strong> Pause/play the physics simulation</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowHelp(false)}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
