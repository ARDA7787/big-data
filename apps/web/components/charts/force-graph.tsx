'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

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
  width?: number
  height?: number
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

// Color palette for communities
const communityColors = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
]

export function ForceGraph({
  nodes,
  edges,
  centerNode,
  width = 800,
  height = 600,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width, height })
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    node: GraphNode | null
  }>({ visible: false, x: 0, y: 0, node: null })

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width || width,
          height: rect.height || height,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [width, height])

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width: w, height: h } = dimensions

    // Create D3 nodes
    const d3Nodes: D3Node[] = nodes.map((node) => ({
      ...node,
      isCenter: centerNode?.id === node.id,
    }))

    // Create D3 links
    const d3Links: D3Link[] = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }))

    // Create container group for zoom
    const g = svg.append('g')

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create simulation
    const simulation = d3
      .forceSimulation<D3Node>(d3Nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(d3Links)
          .id((d) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(30))

    // Create arrow marker for directed edges
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#94a3b8')

    // Draw links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(d3Links)
      .enter()
      .append('line')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)')

    // Calculate node size based on PageRank
    const maxPagerank = Math.max(...nodes.map((n) => n.pagerank || 0), 0.001)
    const nodeSize = (d: D3Node) => {
      const base = d.isCenter ? 16 : 8
      const prScale = Math.sqrt((d.pagerank || 0) / maxPagerank) * 8
      return base + prScale
    }

    // Get node color based on community
    const getNodeColor = (d: D3Node) => {
      if (d.isCenter) return '#f59e0b' // Amber for center
      if (d.community_id !== undefined) {
        return communityColors[d.community_id % communityColors.length]
      }
      return '#6366f1' // Default indigo
    }

    // Draw nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(d3Nodes)
      .enter()
      .append('circle')
      .attr('r', nodeSize)
      .attr('fill', getNodeColor)
      .attr('stroke', (d) => (d.isCenter ? '#fbbf24' : '#fff'))
      .attr('stroke-width', (d) => (d.isCenter ? 3 : 1.5))
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', nodeSize(d) * 1.3)

        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          node: d,
        })
      })
      .on('mouseout', function (event, d) {
        d3.select(this).transition().duration(150).attr('r', nodeSize(d))

        setTooltip({ visible: false, x: 0, y: 0, node: null })
      })
      .call(
        d3
          .drag<SVGCircleElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    // Add labels for important nodes
    const label = g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(d3Nodes.filter((d) => d.isCenter || (d.pagerank || 0) > maxPagerank * 0.5))
      .enter()
      .append('text')
      .text((d) => {
        const title = d.title || ''
        return title.length > 25 ? title.slice(0, 25) + '...' : title
      })
      .attr('font-size', (d) => (d.isCenter ? '11px' : '9px'))
      .attr('fill', '#475569')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => nodeSize(d) + 14)
      .style('pointer-events', 'none')

    // Update positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x || 0)
        .attr('y1', (d) => (d.source as D3Node).y || 0)
        .attr('x2', (d) => (d.target as D3Node).x || 0)
        .attr('y2', (d) => (d.target as D3Node).y || 0)

      node.attr('cx', (d) => d.x || 0).attr('cy', (d) => d.y || 0)

      label.attr('x', (d) => d.x || 0).attr('y', (d) => d.y || 0)
    })

    // Initial zoom to fit
    const initialScale = 0.8
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(w * 0.1, h * 0.1).scale(initialScale)
    )

    return () => {
      simulation.stop()
    }
  }, [nodes, edges, centerNode, dimensions])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="bg-neutral-50/50"
        style={{ minHeight: height }}
      />

      {/* Tooltip */}
      {tooltip.visible && tooltip.node && (
        <div
          className="pointer-events-none absolute z-50 max-w-xs rounded-lg bg-white p-3 shadow-lg"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            transform: 'translate(-50%, 10px)',
          }}
        >
          <p className="font-medium text-neutral-900 text-sm line-clamp-2">
            {tooltip.node.title}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
            {tooltip.node.year && <span>{tooltip.node.year}</span>}
            {tooltip.node.pagerank !== undefined && (
              <span>PR: {tooltip.node.pagerank.toFixed(4)}</span>
            )}
            {tooltip.node.citation_count !== undefined && (
              <span>Citations: {tooltip.node.citation_count}</span>
            )}
          </div>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute left-3 top-3 rounded bg-white/80 px-2 py-1 text-xs text-neutral-500 backdrop-blur">
        Drag to pan • Scroll to zoom • Drag nodes to rearrange
      </div>
    </div>
  )
}

