'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ZoomIn, ZoomOut, Maximize2, RotateCcw, 
  Search, Download, Settings2, Bookmark, 
  BookmarkCheck, ExternalLink, X, FileText, Calendar,
  TrendingUp, Users, Hash, ArrowRight, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GraphNode {
  id: string
  title: string
  year?: number
  pagerank?: number
  citation_count?: number
  community_id?: number
}

interface GraphEdge {
  source: string
  target: string
}

interface ForceGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  centerNode?: GraphNode
  onNodeSelect?: (node: GraphNode | null) => void
  onNodeSave?: (node: GraphNode) => void
  savedNodeIds?: Set<string>
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  title: string
  year?: number
  pagerank?: number
  citation_count?: number
  community_id?: number
  isCenter?: boolean
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node
  target: string | D3Node
}

const communityColors = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6',
]

export function ForceGraph({
  nodes,
  edges,
  centerNode,
  onNodeSelect,
  onNodeSave,
  savedNodeIds = new Set(),
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null)
  const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLabels, setShowLabels] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [colorBy, setColorBy] = useState<'community' | 'year' | 'citations'>('community')
  const [sizeBy, setSizeBy] = useState<'pagerank' | 'citations' | 'uniform'>('pagerank')
  const [zoomLevel, setZoomLevel] = useState(1)

  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // Update dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width || 800, height: rect.height || 600 })
      }
    }
    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Search filter
  const highlightedNodeIds = useMemo(() => {
    if (searchQuery.length < 2) return new Set<string>()
    return new Set(nodes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase())).map(n => n.id))
  }, [nodes, searchQuery])

  // Pre-compute layout once
  const computedPositions = useMemo(() => {
    if (nodes.length === 0) return new Map<string, { x: number; y: number }>()
    
    const { width: w, height: h } = dimensions
    const validNodeIds = new Set(nodes.map(n => n.id))
    const validEdges = edges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target))

    const d3Nodes: D3Node[] = nodes.map((node) => ({
      ...node,
      isCenter: centerNode?.id === node.id,
    }))

    const d3Links: D3Link[] = validEdges.map((edge) => ({ source: edge.source, target: edge.target }))

    // Pin center node
    const center = d3Nodes.find(n => n.isCenter)
    if (center) {
      center.fx = w / 2
      center.fy = h / 2
    }

    // Create and run simulation to completion
    const simulation = d3.forceSimulation<D3Node>(d3Nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(d3Links).id(d => d.id).distance(100).strength(0.2))
      .force('charge', d3.forceManyBody().strength(-150).distanceMax(300))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(20))
      .force('x', d3.forceX(w / 2).strength(0.05))
      .force('y', d3.forceY(h / 2).strength(0.05))
      .stop()

    // Run simulation synchronously
    for (let i = 0; i < 300; i++) simulation.tick()

    // Store computed positions
    const positions = new Map<string, { x: number; y: number }>()
    d3Nodes.forEach(node => {
      positions.set(node.id, { x: node.x || w / 2, y: node.y || h / 2 })
    })

    return positions
  }, [nodes, edges, centerNode, dimensions])

  // Main D3 rendering effect
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0 || computedPositions.size === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width: w, height: h } = dimensions
    const validNodeIds = new Set(nodes.map(n => n.id))
    const validEdges = edges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target))

    // Node calculations
    const maxPagerank = Math.max(...nodes.map(n => n.pagerank || 0), 0.001)
    const maxCitations = Math.max(...nodes.map(n => n.citation_count || 0), 1)
    const minYear = Math.min(...nodes.filter(n => n.year).map(n => n.year!), 2000)
    const maxYear = Math.max(...nodes.filter(n => n.year).map(n => n.year!), 2025)

    const getNodeSize = (node: GraphNode): number => {
      const isCenter = centerNode?.id === node.id
      const base = isCenter ? 18 : 8
      if (sizeBy === 'uniform') return base
      if (sizeBy === 'citations') return base + Math.sqrt((node.citation_count || 0) / maxCitations) * 10
      return base + Math.sqrt((node.pagerank || 0) / maxPagerank) * 10
    }

    const getNodeColor = (node: GraphNode): string => {
      if (centerNode?.id === node.id) return '#f59e0b'
      if (colorBy === 'community' && node.community_id !== undefined) return communityColors[Math.abs(node.community_id) % communityColors.length]
      if (colorBy === 'year' && node.year) return d3.interpolateBlues(0.3 + ((node.year - minYear) / (maxYear - minYear || 1)) * 0.7)
      if (colorBy === 'citations') return d3.interpolateGreens(0.3 + Math.sqrt((node.citation_count || 0) / maxCitations) * 0.7)
      return '#3b82f6'
    }

    // SVG Defs
    const defs = svg.append('defs')
    
    // Glow for center
    const glow = defs.append('filter').attr('id', 'glow')
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur')
    const merge = glow.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Shadow
    const shadow = defs.append('filter').attr('id', 'shadow')
    shadow.append('feDropShadow').attr('dx', '0').attr('dy', '1').attr('stdDeviation', '2').attr('flood-color', 'rgba(0,0,0,0.1)')

    // Arrow
    defs.append('marker').attr('id', 'arrow').attr('viewBox', '0 -5 10 10').attr('refX', 22).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-3L6,0L0,3').attr('fill', '#cbd5e1')

    // Container for zoom
    const g = svg.append('g')

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    zoomBehaviorRef.current = zoom
    svg.call(zoom).on('dblclick.zoom', null)

    // Draw links
    const linkGroup = g.append('g').attr('class', 'links')
    
    validEdges.forEach(edge => {
      const sourcePos = computedPositions.get(edge.source)
      const targetPos = computedPositions.get(edge.target)
      if (!sourcePos || !targetPos) return

      linkGroup.append('line')
        .attr('x1', sourcePos.x)
        .attr('y1', sourcePos.y)
        .attr('x2', targetPos.x)
        .attr('y2', targetPos.y)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.5)
        .attr('marker-end', 'url(#arrow)')
        .attr('data-source', edge.source)
        .attr('data-target', edge.target)
    })

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes')

    nodes.forEach(node => {
      const pos = computedPositions.get(node.id)
      if (!pos) return

      const isCenter = centerNode?.id === node.id
      const isHighlighted = highlightedNodeIds.has(node.id)
      const size = getNodeSize(node)
      const color = getNodeColor(node)

      const nodeG = nodeGroup.append('g')
        .attr('transform', `translate(${pos.x}, ${pos.y})`)
        .attr('data-id', node.id)
        .style('cursor', 'pointer')

      // Circle
      const circle = nodeG.append('circle')
        .attr('r', size)
        .attr('fill', color)
        .attr('stroke', isCenter ? '#fcd34d' : isHighlighted ? '#22c55e' : '#ffffff')
        .attr('stroke-width', isCenter ? 3 : 2)
        .attr('filter', isCenter ? 'url(#glow)' : 'url(#shadow)')

      // Label (if enabled) - show for ALL nodes when labels are on
      if (showLabels) {
        nodeG.append('text')
          .text((node.title || '').slice(0, 22) + ((node.title || '').length > 22 ? '…' : ''))
          .attr('font-size', isCenter ? '10px' : '8px')
          .attr('font-weight', isCenter ? '600' : '400')
          .attr('fill', '#374151')
          .attr('text-anchor', 'middle')
          .attr('dy', size + 12)
          .style('pointer-events', 'none')
          .style('text-shadow', '0 1px 2px rgba(255,255,255,0.8)')
      }

      // Hover effects
      nodeG
        .on('mouseenter', function() {
          circle.attr('r', size * 1.3).attr('stroke-width', 3)
          
          // Highlight connected edges
          linkGroup.selectAll('line')
            .attr('stroke-opacity', function() {
              const src = d3.select(this).attr('data-source')
              const tgt = d3.select(this).attr('data-target')
              return src === node.id || tgt === node.id ? 0.8 : 0.15
            })
            .attr('stroke', function() {
              const src = d3.select(this).attr('data-source')
              const tgt = d3.select(this).attr('data-target')
              return src === node.id || tgt === node.id ? '#3b82f6' : '#e2e8f0'
            })
            .attr('stroke-width', function() {
              const src = d3.select(this).attr('data-source')
              const tgt = d3.select(this).attr('data-target')
              return src === node.id || tgt === node.id ? 2 : 1
            })

          setHoveredNode({ ...node, isCenter } as D3Node)
        })
        .on('mouseleave', function() {
          circle.attr('r', size).attr('stroke-width', isCenter ? 3 : 2)
          
          linkGroup.selectAll('line')
            .attr('stroke-opacity', 0.5)
            .attr('stroke', '#e2e8f0')
            .attr('stroke-width', 1)

          setHoveredNode(null)
        })
        .on('click', function(event) {
          event.stopPropagation()
          const nodeData: D3Node = { ...node, isCenter, x: pos.x, y: pos.y }
          setSelectedNode(nodeData)
          onNodeSelect?.(nodeData)
        })
    })

    // Initial zoom
    svg.call(zoom.transform, d3.zoomIdentity.translate(w * 0.05, h * 0.05).scale(0.9))

    // Click background to deselect
    svg.on('click', () => {
      setSelectedNode(null)
      onNodeSelect?.(null)
    })

  }, [nodes, edges, centerNode, dimensions, computedPositions, showLabels, colorBy, sizeBy, highlightedNodeIds, onNodeSelect])

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.4)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7)
    }
  }, [])

  const handleZoomReset = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const { width: w, height: h } = dimensions
      d3.select(svgRef.current).transition().duration(400)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(w * 0.05, h * 0.05).scale(0.9))
    }
  }, [dimensions])

  const handleExport = useCallback(() => {
    if (!svgRef.current) return
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'citation-graph.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div ref={containerRef} className="relative h-full w-full bg-slate-50 rounded-xl overflow-hidden">
      {/* SVG Graph */}
      <svg ref={svgRef} width="100%" height="100%" className="cursor-grab active:cursor-grabbing" style={{ minHeight: 600 }} />

      {/* Search Bar */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search papers..."
            className="w-52 rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-8 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {highlightedNodeIds.size > 0 && (
          <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white">
            {highlightedNodeIds.size} found
          </span>
        )}
      </div>

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className={cn(
          'absolute top-4 right-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm',
          showSettings ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        )}
      >
        <Settings2 className="h-4 w-4" />
        Settings
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-4 space-y-4 z-20"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Color by</label>
              <select value={colorBy} onChange={(e) => setColorBy(e.target.value as any)} className="w-full rounded-lg border border-slate-200 py-1.5 px-2 text-sm">
                <option value="community">Community</option>
                <option value="year">Year</option>
                <option value="citations">Citations</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Size by</label>
              <select value={sizeBy} onChange={(e) => setSizeBy(e.target.value as any)} className="w-full rounded-lg border border-slate-200 py-1.5 px-2 text-sm">
                <option value="pagerank">PageRank</option>
                <option value="citations">Citations</option>
                <option value="uniform">Uniform</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Labels</span>
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={cn('w-10 h-6 rounded-full transition-colors', showLabels ? 'bg-blue-500' : 'bg-slate-200')}
              >
                <span className={cn('block w-4 h-4 rounded-full bg-white shadow transform transition-transform mx-1', showLabels ? 'translate-x-4' : 'translate-x-0')} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom Controls - Left Side Vertical */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 rounded-xl border border-slate-200 bg-white shadow-lg p-1.5">
        <button onClick={handleZoomIn} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="px-1 py-1 text-[10px] font-semibold text-slate-500 text-center">{Math.round(zoomLevel * 100)}%</span>
        <button onClick={handleZoomOut} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-px w-full bg-slate-200 my-1" />
        <button onClick={handleZoomReset} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Reset view">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button onClick={handleExport} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" title="Export SVG">
          <Download className="h-4 w-4" />
        </button>
      </div>

      {/* Legend - Bottom Left */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-amber-200" />
          <span className="font-medium">Center</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="h-3.5 w-3.5 rounded-full bg-blue-500" />
          <span className="font-medium">Papers</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-xs font-semibold text-slate-500">{nodes.length} nodes</span>
      </div>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredNode && !selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 bottom-20 -translate-x-1/2 max-w-sm rounded-xl bg-white px-4 py-3 shadow-xl border border-slate-100 pointer-events-none z-30"
          >
            <p className="font-semibold text-slate-900 text-sm line-clamp-2">{hoveredNode.title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {hoveredNode.year && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{hoveredNode.year}</span>}
              {hoveredNode.citation_count !== undefined && hoveredNode.citation_count > 0 && (
                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs">{hoveredNode.citation_count} cites</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Side Panel - Paper Details */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute top-0 right-0 bottom-0 w-96 bg-white border-l-2 border-blue-500 shadow-2xl overflow-y-auto z-50"
          >
            {/* Header with gradient */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-500 p-5 z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-1">
                    📄 Paper Details
                  </p>
                  {selectedNode.isCenter && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 text-[10px] font-bold uppercase mb-2">
                      <Sparkles className="h-3 w-3" />
                      Center Node
                    </span>
                  )}
                  <h2 className="font-bold text-white text-lg leading-snug">{selectedNode.title}</h2>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedNode(null); onNodeSelect?.(null) }}
                  className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white shrink-0 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {selectedNode.year && (
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Year</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{selectedNode.year}</p>
                  </div>
                )}
                {selectedNode.citation_count !== undefined && (
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-4 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Citations</span>
                    </div>
                    <p className="text-3xl font-bold text-emerald-700">{selectedNode.citation_count}</p>
                  </div>
                )}
                {selectedNode.pagerank !== undefined && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">PageRank</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{selectedNode.pagerank.toFixed(4)}</p>
                  </div>
                )}
                {selectedNode.community_id !== undefined && (
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-2xl p-4 border border-violet-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-violet-600" />
                      <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Community</span>
                    </div>
                    <p className="text-3xl font-bold text-violet-700">#{Math.abs(selectedNode.community_id) % 100}</p>
                  </div>
                )}
              </div>

              {/* Paper ID */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Paper ID</span>
                </div>
                <p className="text-sm font-mono text-slate-600 break-all bg-white rounded-lg p-2 border border-slate-100">{selectedNode.id}</p>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <button
                  onClick={(e) => { e.stopPropagation(); onNodeSave?.(selectedNode) }}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all',
                    savedNodeIds.has(selectedNode.id)
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 ring-2 ring-amber-300'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {savedNodeIds.has(selectedNode.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                  {savedNodeIds.has(selectedNode.id) ? '✓ Saved to Collection' : 'Save Paper'}
                </button>

                <a
                  href={`/search?q=${encodeURIComponent(selectedNode.title)}`}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30"
                >
                  <ExternalLink className="h-5 w-5" />
                  Look Up Full Details
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Tip */}
              <p className="text-center text-xs text-slate-400 pt-2">
                Click anywhere outside to close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
