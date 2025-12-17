'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { 
  X, Search, ExternalLink, TrendingUp, TrendingDown, Minus, 
  BarChart3, Users, FileText, Tag, Bookmark, BookmarkCheck, Info
} from 'lucide-react'
import { api, Topic, RankedPaper } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { useSavedItems } from '@/lib/saved-items-context'

interface TopicModalProps {
  topic: Topic | null
  onClose: () => void
  open?: boolean
}

export function TopicModal({ topic, onClose, open = true }: TopicModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'papers' | 'trend'>('overview')
  
  // Get saved items context safely
  let savedItems: ReturnType<typeof useSavedItems> | null = null
  try {
    savedItems = useSavedItems()
  } catch (e) {
    // Context not available
  }

  // Fetch topic details
  const { data: topicDetails, isLoading } = useQuery({
    queryKey: ['topic-details', topic?.topic_id],
    queryFn: () => api.getTopicDetails(topic!.topic_id, 20),
    enabled: !!topic && open,
  })

  // Fetch topic histogram
  const { data: histogram } = useQuery({
    queryKey: ['topic-histogram', topic?.topic_id],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/topics/${topic!.topic_id}/histogram`)
      return res.json()
    },
    enabled: !!topic && open,
  })

  // Fetch why trending
  const { data: whyTrending } = useQuery({
    queryKey: ['topic-why-trending', topic?.topic_id],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/topics/${topic!.topic_id}/why-trending`)
      return res.json()
    },
    enabled: !!topic && open,
  })

  // Handle ESC key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (topic && open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [topic, open, handleKeyDown])

  if (!topic || !open) return null

  const papers = topicDetails?.papers || []
  const topAuthors = topicDetails?.top_authors || []
  const histogramData = histogram?.histogram || []

  // Get trend direction
  const getTrendIcon = () => {
    const trend = whyTrending?.explanation?.trend_direction
    if (trend === 'growing') return <TrendingUp className="h-4 w-4 text-green-600" />
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-neutral-400" />
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="topic-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-modal-title"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Backdrop - covers entire viewport */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutral-900/70"
          onClick={onClose}
          aria-hidden="true"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        
        {/* Centering container */}
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
            className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col z-10"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 bg-white p-6 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-5 w-5 text-primary-600" />
                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                  Topic #{topic.topic_id}
                </span>
                {whyTrending && (
                  <span className="flex items-center gap-1 text-xs text-neutral-500">
                    {getTrendIcon()}
                    {whyTrending.explanation?.growth_rate > 0 ? '+' : ''}
                    {whyTrending.explanation?.growth_rate}% YoY
                  </span>
                )}
              </div>
              <h2 id="topic-modal-title" className="text-xl font-semibold text-neutral-900">
                {topic.label}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-100 px-6 shrink-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors relative',
                activeTab === 'overview' ? 'text-primary-600' : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              Overview
              {activeTab === 'overview' && (
                <motion.div layoutId="topicModalTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('papers')}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors relative',
                activeTab === 'papers' ? 'text-primary-600' : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              Papers ({topicDetails?.paper_count || 0})
              {activeTab === 'papers' && (
                <motion.div layoutId="topicModalTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('trend')}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors relative',
                activeTab === 'trend' ? 'text-primary-600' : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              Trend Analysis
              {activeTab === 'trend' && (
                <motion.div layoutId="topicModalTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Keywords */}
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Top Keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {topic.top_terms?.map((term, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700"
                          >
                            {term.term}
                            <span className="text-xs text-neutral-400">
                              {(term.weight * 100).toFixed(0)}%
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Top Authors */}
                    {topAuthors.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Top Authors in Topic
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {topAuthors.slice(0, 6).map((author: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50">
                              <span className="text-sm font-medium text-neutral-900 truncate">
                                {author.name}
                              </span>
                              <span className="text-xs text-neutral-400 ml-auto">
                                {author.paper_count} papers
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Why Trending */}
                    {whyTrending && (
                      <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4">
                        <h3 className="text-sm font-semibold text-primary-900 mb-2 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Why is this topic trending?
                        </h3>
                        <ul className="text-sm text-primary-700 space-y-1">
                          {whyTrending.contributing_factors?.map((factor: string, i: number) => (
                            <li key={i}>• {factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'papers' && (
                  <div className="space-y-3">
                    {papers.map((paper: any, i: number) => {
                      const isSaved = savedItems?.isSavedPaper(paper.work_id)
                      return (
                        <div
                          key={paper.work_id}
                          className="p-4 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-neutral-900 line-clamp-2">
                                {paper.title}
                              </h4>
                              <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500">
                                {paper.year && <span>{paper.year}</span>}
                                {paper.primary_field && (
                                  <span className="truncate">{paper.primary_field}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={`/search?q=${encodeURIComponent(paper.title)}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                                title="Search for this paper"
                              >
                                <Search className="h-4 w-4" />
                              </a>
                              {savedItems && (
                                <button
                                  onClick={() => savedItems?.toggleSavedPaper(paper as RankedPaper)}
                                  className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                                    isSaved 
                                      ? 'bg-amber-100 text-amber-600' 
                                      : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
                                  )}
                                  title={isSaved ? 'Remove from saved' : 'Save paper'}
                                >
                                  {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {activeTab === 'trend' && (
                  <div className="space-y-6">
                    {/* Year Histogram */}
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Papers by Year
                      </h3>
                      <div className="space-y-2">
                        {histogramData.map((item: any) => {
                          const maxCount = Math.max(...histogramData.map((d: any) => d.paper_count))
                          const widthPct = (item.paper_count / maxCount) * 100
                          return (
                            <div key={item.year} className="flex items-center gap-3">
                              <span className="text-sm text-neutral-500 w-12">{item.year}</span>
                              <div className="flex-1 h-6 bg-neutral-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary-500 rounded-full"
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-neutral-700 w-12 text-right">
                                {item.paper_count}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Trend Explanation */}
                    {whyTrending?.explanation && (
                      <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50/50">
                        <h3 className="text-sm font-semibold text-neutral-700 mb-2">
                          Trend Summary
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-neutral-900">
                              {whyTrending.explanation.growth_rate > 0 ? '+' : ''}
                              {whyTrending.explanation.growth_rate}%
                            </p>
                            <p className="text-xs text-neutral-500">YoY Growth</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-neutral-900">
                              {whyTrending.explanation.current_year_papers}
                            </p>
                            <p className="text-xs text-neutral-500">This Year</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold capitalize text-neutral-900">
                              {whyTrending.explanation.trend_direction}
                            </p>
                            <p className="text-xs text-neutral-500">Direction</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 border-t border-neutral-100 bg-neutral-50/80 p-4 shrink-0">
            <a
              href={`/search?q=${encodeURIComponent(topic.label)}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              <Search className="h-4 w-4" />
              Search Papers
            </a>
            <button
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Close
            </button>
          </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

