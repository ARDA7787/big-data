'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Users, BarChart3, TrendingUp } from 'lucide-react'
import { api, RankedPaper, RankedAuthor } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ScatterPlotChart } from '@/components/charts/scatter-plot-chart'

type Tab = 'papers' | 'authors' | 'comparison'

export default function RankingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('papers')
  const [sortBy, setSortBy] = useState<'pagerank' | 'citations'>('pagerank')

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

  const tabs = [
    { id: 'papers' as Tab, label: 'Top Papers', icon: Trophy },
    { id: 'authors' as Tab, label: 'Top Authors', icon: Users },
    { id: 'comparison' as Tab, label: 'PR vs Citations', icon: BarChart3 },
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

      {/* Content */}
      {activeTab === 'papers' && (
        <div className="space-y-3">
          {papersLoading ? (
            <LoadingSkeleton />
          ) : (
            papers?.map((paper, index) => (
              <PaperCard key={paper.work_id} paper={paper} rank={index + 1} />
            ))
          )}
        </div>
      )}

      {activeTab === 'authors' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {authorsLoading ? (
            <LoadingSkeleton />
          ) : (
            authors?.map((author, index) => (
              <AuthorCard key={author.author_id} author={author} rank={index + 1} />
            ))
          )}
        </div>
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
    </div>
  )
}

function PaperCard({ paper, rank }: { paper: RankedPaper; rank: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.02 }}
    >
      <Card className="flex items-center gap-4 p-4 transition-all hover:shadow-soft-lg">
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
        <div className="flex shrink-0 gap-6 text-right">
          <div>
            <p className="text-xs text-neutral-400">PageRank</p>
            <p className="font-semibold text-neutral-900">
              {paper.pagerank.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Citations</p>
            <p className="font-semibold text-neutral-900">
              {formatNumber(paper.citation_count)}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function AuthorCard({ author, rank }: { author: RankedAuthor; rank: number }) {
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
          <div className="flex items-center gap-1 text-xs text-success">
            <TrendingUp className="h-3 w-3" />
            Top {Math.ceil(rank / 50 * 100)}%
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

