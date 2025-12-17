'use client'

import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, BookOpen, User, Calendar, Tag, Network, Search, TrendingUp, BarChart3, AlertCircle, Bookmark, BookmarkCheck, FileText, Link2Off } from 'lucide-react'
import { RankedPaper, SearchResult } from '@/lib/api'
import { formatNumber, truncate } from '@/lib/utils'
import { useState } from 'react'
import { useSavedItems } from '@/lib/saved-items-context'

interface PaperModalProps {
  paper: (RankedPaper & { abstract?: string; authors?: string[]; doi?: string; source?: string }) | null
  onClose: () => void
  open?: boolean
}

// Helper to normalize paper links
function getPaperLinks(paper: PaperModalProps['paper']) {
  if (!paper) return { landingUrl: null, pdfUrl: null }
  
  let landingUrl: string | null = null
  let pdfUrl: string | null = null
  
  // DOI takes priority
  if (paper.doi) {
    landingUrl = `https://doi.org/${paper.doi}`
  }
  
  // arXiv - extract ID and create both landing and PDF URLs
  if (paper.source === 'arxiv' || paper.work_id?.includes('arxiv:')) {
    const arxivId = paper.work_id?.replace('arxiv:', '') || ''
    if (arxivId) {
      landingUrl = `https://arxiv.org/abs/${arxivId}`
      pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`
    }
  }
  
  // PubMed
  if (paper.source === 'pubmed' || paper.work_id?.includes('pmid:')) {
    const pmid = paper.work_id?.replace('pmid:', '') || ''
    if (pmid) {
      landingUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    }
  }
  
  // OpenAlex - use DOI if available, otherwise construct from ID
  if (paper.source === 'openalex' && !landingUrl) {
    // OpenAlex IDs look like "W1234567" or "openalex:W1234567"
    const oaId = paper.work_id?.replace('openalex:', '') || paper.work_id
    if (oaId && paper.doi) {
      landingUrl = `https://doi.org/${paper.doi}`
    }
  }
  
  return { landingUrl, pdfUrl }
}

export function PaperModal({ paper, onClose, open = true }: PaperModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'stats'>('overview')
  
  // Safe hook usage - check if context exists
  let savedItems: ReturnType<typeof useSavedItems> | null = null
  try {
    savedItems = useSavedItems()
  } catch (e) {
    // Context not available, savedItems features won't work
  }
  
  const savedPapers = savedItems?.savedPapers || []
  const toggleSavedPaper = savedItems?.toggleSavedPaper || (() => {})
  
  // Handle ESC key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])
  
  // Add/remove event listener
  useEffect(() => {
    if (paper && open) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [paper, open, handleKeyDown])
  
  // Early return AFTER hooks
  if (!paper || !open) return null

  const isSaved = savedPapers.some(p => p.work_id === paper.work_id)
  const { landingUrl, pdfUrl } = getPaperLinks(paper)

  // Get source badge color
  const sourceColors: Record<string, string> = {
    arxiv: 'bg-red-100 text-red-700 border-red-200',
    pubmed: 'bg-blue-100 text-blue-700 border-blue-200',
    openalex: 'bg-orange-100 text-orange-700 border-orange-200',
  }

  // Calculate relative performance metrics
  const getPerformanceLevel = (value: number, type: 'pagerank' | 'citations') => {
    if (type === 'pagerank') {
      if (value > 10) return { label: 'Exceptional', color: 'text-green-600 bg-green-50' }
      if (value > 5) return { label: 'High', color: 'text-blue-600 bg-blue-50' }
      if (value > 1) return { label: 'Above Average', color: 'text-primary-600 bg-primary-50' }
      return { label: 'Average', color: 'text-neutral-600 bg-neutral-50' }
    } else {
      if (value > 100) return { label: 'Highly Cited', color: 'text-green-600 bg-green-50' }
      if (value > 50) return { label: 'Well Cited', color: 'text-blue-600 bg-blue-50' }
      if (value > 10) return { label: 'Cited', color: 'text-primary-600 bg-primary-50' }
      return { label: 'Recent', color: 'text-neutral-600 bg-neutral-50' }
    }
  }

  const pageRankPerf = getPerformanceLevel(paper.pagerank || 0, 'pagerank')
  const citationsPerf = getPerformanceLevel(paper.citation_count || 0, 'citations')
  
  // Format community ID - handle potentially large numbers
  const formatCommunityId = (id: number | undefined | null) => {
    if (id === undefined || id === null) return '—'
    // If the number is unreasonably large (likely a bug), show '—'
    if (id > 1000000) return '—'
    return String(id)
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="paper-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paper-modal-title"
      >
        {/* Backdrop - solid dark color */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-neutral-900/70"
          onClick={onClose}
          aria-hidden="true"
        />
        
        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-white p-6 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {paper.source && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${sourceColors[paper.source] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
                    {paper.source}
                  </span>
                )}
                {paper.year && (
                  <span className="flex items-center gap-1 text-xs text-neutral-500">
                    <Calendar className="h-3 w-3" />
                    {paper.year}
                  </span>
                )}
                {paper.primary_field && (
                  <span className="flex items-center gap-1 text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                    <Tag className="h-3 w-3" />
                    {paper.primary_field}
                  </span>
                )}
              </div>
              <h2 id="paper-modal-title" className="text-lg font-semibold text-neutral-900 leading-tight line-clamp-3">
                {paper.title || 'Untitled Paper'}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {savedItems && (
                <button
                  onClick={() => toggleSavedPaper(paper as RankedPaper)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    isSaved 
                      ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                      : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
                  }`}
                  title={isSaved ? 'Remove from saved' : 'Save paper'}
                  aria-label={isSaved ? 'Remove from saved' : 'Save paper'}
                >
                  {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-100 px-6 shrink-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'overview'
                  ? 'text-primary-600'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Overview
              {activeTab === 'overview' && (
                <motion.div
                  layoutId="paperModalTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'stats'
                  ? 'text-primary-600'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Statistics
              {activeTab === 'stats' && (
                <motion.div
                  layoutId="paperModalTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                />
              )}
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Authors */}
                {paper.authors && paper.authors.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
                      <User className="h-4 w-4" />
                      Authors
                    </div>
                    <p className="text-sm text-neutral-600">
                      {paper.authors.join(', ')}
                    </p>
                  </div>
                )}

                {/* Abstract */}
                {paper.abstract ? (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-2">
                      <BookOpen className="h-4 w-4" />
                      Abstract
                    </div>
                    <p className="text-sm text-neutral-600 leading-relaxed">
                      {paper.abstract}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-500">
                    <FileText className="h-4 w-4" />
                    Abstract not available for this paper
                  </div>
                )}

                {/* Paper ID for reference */}
                <div className="text-xs text-neutral-400 font-mono pt-2">
                  ID: {paper.work_id}
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                {/* Quick Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-neutral-50 p-4 text-center">
                    <p className="text-3xl font-bold text-neutral-900">
                      {paper.pagerank?.toFixed(2) || '—'}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">PageRank Score</p>
                    <span className={`inline-block mt-2 rounded-full px-2 py-0.5 text-xs font-medium ${pageRankPerf.color}`}>
                      {pageRankPerf.label}
                    </span>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-4 text-center">
                    <p className="text-3xl font-bold text-neutral-900">
                      {formatNumber(paper.citation_count || 0)}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Citations</p>
                    <span className={`inline-block mt-2 rounded-full px-2 py-0.5 text-xs font-medium ${citationsPerf.color}`}>
                      {citationsPerf.label}
                    </span>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-4 text-center">
                    <p className="text-3xl font-bold text-neutral-900">
                      {formatCommunityId(paper.community_id)}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Community</p>
                    <span className="inline-block mt-2 rounded-full px-2 py-0.5 text-xs font-medium text-neutral-600 bg-white">
                      Cluster
                    </span>
                  </div>
                </div>

                {/* Performance Analysis */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Performance Analysis
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-neutral-600">Influence Score</span>
                        <span className="font-medium text-neutral-900">
                          {Math.min(100, Math.round((paper.pagerank || 0) * 10))}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100">
                        <div 
                          className="h-2 rounded-full bg-gradient-to-r from-primary-400 to-primary-600"
                          style={{ width: `${Math.min(100, (paper.pagerank || 0) * 10)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-neutral-600">Citation Impact</span>
                        <span className="font-medium text-neutral-900">
                          {Math.min(100, Math.round((paper.citation_count || 0) / 2))}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100">
                        <div 
                          className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                          style={{ width: `${Math.min(100, (paper.citation_count || 0) / 2)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50/50">
                  <h4 className="text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Insights
                  </h4>
                  <ul className="text-sm text-neutral-600 space-y-1">
                    {paper.pagerank && paper.pagerank > 5 && (
                      <li>• This paper has high influence in the citation network</li>
                    )}
                    {paper.citation_count && paper.citation_count > 50 && (
                      <li>• Well-cited paper with significant impact</li>
                    )}
                    {paper.year && paper.year >= 2023 && (
                      <li>• Recent publication showing early engagement</li>
                    )}
                    {(!paper.pagerank || paper.pagerank <= 5) && (!paper.citation_count || paper.citation_count <= 50) && (
                      <li>• This paper is building its citation profile</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 border-t border-neutral-100 bg-neutral-50/80 p-4 shrink-0">
            {/* Primary action: View paper */}
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                <FileText className="h-4 w-4" />
                View PDF
              </a>
            ) : landingUrl ? (
              <a
                href={landingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                <ExternalLink className="h-4 w-4" />
                View Page
              </a>
            ) : (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-500 cursor-not-allowed" title="No external link available for this paper">
                <Link2Off className="h-4 w-4" />
                Link Unavailable
              </div>
            )}
            
            {/* Secondary actions */}
            <a
              href={`/search?q=${encodeURIComponent(paper.title)}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Search className="h-4 w-4" />
              Look Up
            </a>
            <a
              href={`/graph?work_id=${paper.work_id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Network className="h-4 w-4" />
              Citations
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
