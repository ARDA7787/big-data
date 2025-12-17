'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bookmark, User, FileText, Users, Trash2, Search, ExternalLink, 
  BookmarkCheck, ChevronRight, Calendar, TrendingUp, AlertCircle,
  Network, Settings
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useSavedItems } from '@/lib/saved-items-context'
import { formatNumber, cn } from '@/lib/utils'
import { PaperModal } from '@/components/ui/paper-modal'
import { RankedPaper, RankedAuthor } from '@/lib/api'

type Tab = 'papers' | 'authors'

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('papers')
  const [selectedPaper, setSelectedPaper] = useState<RankedPaper | null>(null)
  
  const { 
    savedPapers, 
    savedAuthors, 
    toggleSavedPaper, 
    toggleSavedAuthor,
    clearAllSaved 
  } = useSavedItems()

  const tabs = [
    { id: 'papers' as Tab, label: 'Saved Papers', icon: FileText, count: savedPapers.length },
    { id: 'authors' as Tab, label: 'Saved Authors', icon: Users, count: savedAuthors.length },
  ]

  const isEmpty = savedPapers.length === 0 && savedAuthors.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-xl font-bold text-white shadow-lg">
            AS
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              Your Saved Items
            </h2>
            <p className="text-sm text-neutral-500">
              {savedPapers.length} papers • {savedAuthors.length} authors saved
            </p>
          </div>
        </div>

        {!isEmpty && (
          <button
            onClick={() => {
              if (window.confirm('Clear all saved items? This cannot be undone.')) {
                clearAllSaved()
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-neutral-900 shadow-soft'
                : 'text-neutral-500 hover:text-neutral-700'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs',
              activeTab === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'bg-neutral-200 text-neutral-600'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Empty State */}
      {isEmpty && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-100">
            <Bookmark className="h-10 w-10 text-neutral-400" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-neutral-900">
            No saved items yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-neutral-500">
            Save papers and authors from the Rankings or Citation Graph pages by clicking the bookmark icon.
          </p>
          <a
            href="/rankings"
            className="mt-6 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Browse Rankings
            <ChevronRight className="h-4 w-4" />
          </a>
        </Card>
      )}

      {/* Saved Papers */}
      {activeTab === 'papers' && savedPapers.length > 0 && (
        <div className="space-y-3">
          {savedPapers.map((paper, index) => (
            <motion.div
              key={paper.work_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className="p-4 transition-all hover:shadow-soft-lg cursor-pointer group"
                onClick={() => setSelectedPaper(paper)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                    <BookmarkCheck className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-neutral-900 line-clamp-2">
                      {paper.title}
                    </h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
                      {paper.year && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {paper.year}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        PR: {paper.pagerank?.toFixed(2) || '—'}
                      </span>
                      <span>
                        {formatNumber(paper.citation_count || 0)} citations
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/search?q=${encodeURIComponent(paper.title)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-600 transition-all"
                      title="Search for this paper"
                    >
                      <Search className="h-4 w-4" />
                    </a>
                    <a
                      href={`/graph?work_id=${paper.work_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-100 hover:text-neutral-600 transition-all"
                      title="View citations"
                    >
                      <Network className="h-4 w-4" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSavedPaper(paper)
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Saved Papers Empty State */}
      {activeTab === 'papers' && savedPapers.length === 0 && !isEmpty && (
        <Card className="flex flex-col items-center justify-center p-8 text-center">
          <FileText className="h-12 w-12 text-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            No saved papers. Browse rankings to save papers.
          </p>
          <a
            href="/rankings"
            className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Go to Rankings →
          </a>
        </Card>
      )}

      {/* Saved Authors */}
      {activeTab === 'authors' && savedAuthors.length > 0 && (
        <div className="space-y-3">
          {savedAuthors.map((author, index) => (
            <motion.div
              key={author.author_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-4 transition-all hover:shadow-soft-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                    <User className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-neutral-900">
                      {author.name}
                    </h4>
                    {author.affiliation && (
                      <p className="text-sm text-neutral-500 truncate">
                        {author.affiliation}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-neutral-400">Papers</p>
                      <p className="font-semibold text-neutral-900">
                        {formatNumber(author.paper_count)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-400">PageRank</p>
                      <p className="font-semibold text-neutral-900">
                        {author.total_pagerank.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-400">Citations</p>
                      <p className="font-semibold text-neutral-900">
                        {formatNumber(author.total_citations)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSavedAuthor(author)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Saved Authors Empty State */}
      {activeTab === 'authors' && savedAuthors.length === 0 && !isEmpty && (
        <Card className="flex flex-col items-center justify-center p-8 text-center">
          <Users className="h-12 w-12 text-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            No saved authors. Browse rankings to save authors.
          </p>
          <a
            href="/rankings"
            className="mt-4 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Go to Rankings →
          </a>
        </Card>
      )}

      {/* Paper Details Modal */}
      {selectedPaper && (
        <PaperModal
          paper={selectedPaper}
          onClose={() => setSelectedPaper(null)}
        />
      )}
    </div>
  )
}

