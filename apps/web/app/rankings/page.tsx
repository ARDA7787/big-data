'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Users, BarChart3, TrendingUp, Sparkles, Bookmark, BookmarkCheck, Search, Grid3X3, List, Network } from 'lucide-react'
import { api, RankedPaper, RankedAuthor } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ScatterPlotChart } from '@/components/charts/scatter-plot-chart'
import { CitationsScatter } from '@/components/charts/citations-scatter'
import { FieldsPie } from '@/components/charts/fields-pie'
import { PaperModal } from '@/components/ui/paper-modal'
import { useSavedItems } from '@/lib/saved-items-context'

type Tab = 'papers' | 'authors' | 'comparison' | 'analytics'
type ViewMode = 'list' | 'grid' | 'cards'

export default function RankingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('papers')
  const [sortBy, setSortBy] = useState<'pagerank' | 'citations'>('pagerank')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedPaper, setSelectedPaper] = useState<RankedPaper | null>(null)
  
  const { savedPapers, savedAuthors, toggleSavedPaper, toggleSavedAuthor, isSavedPaper, isSavedAuthor } = useSavedItems()

  const { data: papers, isLoading: papersLoading } = useQuery({
    queryKey: ['top-papers', sortBy],
    queryFn: () => api.getTopPapers({ sort_by: sortBy, limit: 50 }),
    enabled: activeTab === 'papers',
  })

  const { data: authors, isLoading: authorsLoading } = useQuery({
    queryKey: ['top-authors', sortBy],
    queryFn: () => api.getTopAuthors({ sort_by: sortBy, limit: 50 }),
    enabled: activeTab === 'authors',
  })

  const { data: comparison } = useQuery({
    queryKey: ['comparison'],
    queryFn: () => api.getComparison(200),
    enabled: activeTab === 'comparison',
  })

  const { data: fields } = useQuery({
    queryKey: ['fields'],
    queryFn: api.getFieldStats,
    enabled: activeTab === 'analytics',
  })

  const { data: allPapers } = useQuery({
    queryKey: ['all-papers-scatter'],
    queryFn: () => api.getTopPapers({ limit: 200 }),
    enabled: activeTab === 'analytics',
  })

  const tabs = [
    { id: 'papers' as Tab, label: 'Top Papers', icon: Trophy },
    { id: 'authors' as Tab, label: 'Top Authors', icon: Users },
    { id: 'comparison' as Tab, label: 'PR vs Citations', icon: BarChart3 },
    { id: 'analytics' as Tab, label: 'Analytics', icon: Sparkles },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">
            Influence Rankings
          </h2>
          <p className="text-sm text-neutral-500">
            Papers and authors ranked by PageRank and citation count
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('pagerank')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              sortBy === 'pagerank'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
          >
            PageRank
          </button>
          <button
            onClick={() => setSortBy('citations')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              sortBy === 'citations'
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
          >
            Citations
          </button>
        </div>
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
          </button>
        ))}
      </div>

      {/* View Mode Switcher for Papers/Authors */}
      {(activeTab === 'papers' || activeTab === 'authors') && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">View:</span>
            <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  viewMode === 'list'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
              >
                <List className="h-4 w-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  viewMode === 'grid'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
              >
                <Grid3X3 className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  viewMode === 'cards'
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                )}
              >
                <Network className="h-4 w-4" />
                Cards
              </button>
            </div>
          </div>
          
          {/* Saved items count */}
          {savedPapers.length + savedAuthors.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-700">
              <Bookmark className="h-4 w-4" />
              <span>{savedPapers.length} papers, {savedAuthors.length} authors saved</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {activeTab === 'papers' && (
        <>
          {papersLoading ? (
            <LoadingSkeleton />
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {papers?.map((paper, index) => (
                <PaperCard 
                  key={paper.work_id} 
                  paper={paper} 
                  rank={index + 1}
                  onSave={() => toggleSavedPaper(paper)}
                  isSaved={isSavedPaper(paper.work_id)}
                />
              ))}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {papers?.map((paper, index) => (
                <PaperGridCard
                  key={paper.work_id}
                  paper={paper}
                  rank={index + 1}
                  onSave={() => toggleSavedPaper(paper)}
                  isSaved={isSavedPaper(paper.work_id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {papers?.slice(0, 10).map((paper, index) => (
                <PaperDetailCard
                  key={paper.work_id}
                  paper={paper}
                  rank={index + 1}
                  onSave={() => toggleSavedPaper(paper)}
                  isSaved={isSavedPaper(paper.work_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Paper Details Modal */}
      {selectedPaper && (
        <PaperModal
          paper={selectedPaper}
          onClose={() => setSelectedPaper(null)}
        />
      )}

      {activeTab === 'authors' && (
        <>
          {authorsLoading ? (
            <LoadingSkeleton />
          ) : viewMode === 'list' ? (
            <div className="space-y-3">
              {authors?.map((author, index) => (
                <AuthorListCard 
                  key={author.author_id} 
                  author={author} 
                  rank={index + 1}
                  onSave={() => toggleSavedAuthor(author)}
                  isSaved={isSavedAuthor(author.author_id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {authors?.map((author, index) => (
                <AuthorCard 
                  key={author.author_id} 
                  author={author} 
                  rank={index + 1}
                  onSave={() => toggleSavedAuthor(author)}
                  isSaved={isSavedAuthor(author.author_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'comparison' && (
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-neutral-900">
              PageRank vs Citation Count
            </h3>
            <p className="text-sm text-neutral-500">
              Correlation: {comparison?.stats?.correlation?.toFixed(3) || 'N/A'}
            </p>
          </div>
          <div className="h-96">
            <ScatterPlotChart data={comparison?.papers || []} />
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            Papers above the trend line have higher PageRank relative to their citations,
            suggesting they are cited by influential papers. Papers below may be highly cited
            but by less influential sources.
          </p>
        </Card>
      )}

      {activeTab === 'analytics' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                Citations Over Time
              </h3>
              <p className="text-sm text-neutral-500">
                Paper citations by publication year
              </p>
            </div>
            <div className="h-80">
              <CitationsScatter data={allPapers || []} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                Research Fields
              </h3>
              <p className="text-sm text-neutral-500">
                Distribution of papers by field
              </p>
            </div>
            <div className="h-80">
              <FieldsPie data={fields?.fields || []} />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

interface PaperCardProps {
  paper: RankedPaper
  rank: number
  onSave: () => void
  isSaved: boolean
}

function PaperCard({ paper, rank, onSave, isSaved }: PaperCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.02 }}
    >
      <Card 
        className="flex items-center gap-4 p-4 transition-all hover:shadow-soft-lg group"
      >
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold',
            rank <= 3
              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
              : 'bg-neutral-100 text-neutral-600'
          )}
        >
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-neutral-900 truncate">
            {paper.title}
          </h4>
          <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
            {paper.year && <span>{paper.year}</span>}
            {paper.primary_field && (
              <span className="truncate">{paper.primary_field}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-neutral-400">PageRank</p>
            <p className="font-semibold text-neutral-900">
              {paper.pagerank.toFixed(4)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-400">Citations</p>
            <p className="font-semibold text-neutral-900">
              {formatNumber(paper.citation_count)}
            </p>
          </div>
          <button
            onClick={onSave}
            className={cn(
              'p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100',
              isSaved
                ? 'bg-amber-100 text-amber-600 opacity-100'
                : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            )}
            title={isSaved ? 'Remove from saved' : 'Save paper'}
          >
            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
      </Card>
    </motion.div>
  )
}

function PaperGridCard({ paper, rank, onSave, isSaved }: PaperCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: rank * 0.02 }}
    >
      <Card 
        className="p-4 transition-all hover:shadow-soft-lg h-full flex flex-col"
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold',
              rank <= 3
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                : 'bg-neutral-100 text-neutral-600'
            )}
          >
            {rank}
          </div>
          <button
            onClick={onSave}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isSaved
                ? 'bg-amber-100 text-amber-600'
                : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            )}
          >
            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
        
        <h4 className="font-medium text-neutral-900 text-sm line-clamp-2 flex-1">
          {paper.title}
        </h4>
        
        <div className="mt-3 pt-3 border-t border-neutral-100 grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-neutral-900">
              {paper.pagerank.toFixed(2)}
            </p>
            <p className="text-xs text-neutral-400">PageRank</p>
          </div>
          <div>
            <p className="text-lg font-bold text-neutral-900">
              {formatNumber(paper.citation_count)}
            </p>
            <p className="text-xs text-neutral-400">Citations</p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function PaperDetailCard({ paper, rank, onSave, isSaved }: PaperCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
    >
      <Card 
        className="p-6 transition-all hover:shadow-soft-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold',
                rank <= 3
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                  : 'bg-neutral-100 text-neutral-600'
              )}
            >
              {rank}
            </div>
            <div>
              <span className="text-xs text-neutral-400">Rank #{rank}</span>
              {paper.year && (
                <p className="text-sm text-neutral-500">{paper.year}</p>
              )}
            </div>
          </div>
          <button
            onClick={onSave}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isSaved
                ? 'bg-amber-100 text-amber-600'
                : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            )}
          >
            {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
        </div>
        
        <h4 className="font-semibold text-neutral-900 text-lg">
          {paper.title}
        </h4>
        
        {paper.primary_field && (
          <span className="inline-block mt-2 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
            {paper.primary_field}
          </span>
        )}
        
        <div className="mt-4 grid grid-cols-3 gap-4 rounded-xl bg-neutral-50 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-neutral-900">
              {paper.pagerank.toFixed(2)}
            </p>
            <p className="text-xs text-neutral-500">PageRank</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-neutral-900">
              {formatNumber(paper.citation_count)}
            </p>
            <p className="text-xs text-neutral-500">Citations</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-neutral-900">
              {paper.community_id ?? '—'}
            </p>
            <p className="text-xs text-neutral-500">Community</p>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2">
          <button className="flex-1 rounded-lg border border-neutral-200 py-2 text-sm font-medium text-neutral-400 transition-colors" disabled>
            View Details
          </button>
          <a
            href={`/search?q=${encodeURIComponent(paper.title)}`}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 transition-colors"
          >
            <Search className="h-4 w-4" />
          </a>
        </div>
      </Card>
    </motion.div>
  )
}

interface AuthorCardProps {
  author: RankedAuthor
  rank: number
  onSave: () => void
  isSaved: boolean
}

function AuthorListCard({ author, rank, onSave, isSaved }: AuthorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.02 }}
    >
      <Card className="flex items-center gap-4 p-4 transition-all hover:shadow-soft-lg group">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold',
            rank <= 3
              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
              : 'bg-neutral-100 text-neutral-600'
          )}
        >
          {rank}
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
        <div className="flex shrink-0 items-center gap-4">
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
            onClick={onSave}
            className={cn(
              'p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100',
              isSaved
                ? 'bg-amber-100 text-amber-600 opacity-100'
                : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
            )}
          >
            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>
      </Card>
    </motion.div>
  )
}

function AuthorCard({ author, rank, onSave, isSaved }: AuthorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: rank * 0.02 }}
    >
      <Card className="p-5 transition-all hover:shadow-soft-lg">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold',
              rank <= 3
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                : 'bg-neutral-100 text-neutral-600'
            )}
          >
            {rank}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-success">
              <TrendingUp className="h-3 w-3" />
              Top {Math.ceil(rank / 50 * 100)}%
            </div>
            <button
              onClick={onSave}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isSaved
                  ? 'bg-amber-100 text-amber-600'
                  : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
              )}
            >
              {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <h4 className="mt-3 font-semibold text-neutral-900">{author.name}</h4>
        {author.affiliation && (
          <p className="mt-1 text-sm text-neutral-500 truncate">
            {author.affiliation}
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-4">
          <div>
            <p className="text-xs text-neutral-400">Papers</p>
            <p className="font-semibold text-neutral-900">
              {formatNumber(author.paper_count)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">PageRank</p>
            <p className="font-semibold text-neutral-900">
              {author.total_pagerank.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Citations</p>
            <p className="font-semibold text-neutral-900">
              {formatNumber(author.total_citations)}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="p-4">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-neutral-100" />
              <div className="h-3 w-1/2 rounded bg-neutral-100" />
            </div>
          </div>
        </Card>
      ))}
    </>
  )
}
