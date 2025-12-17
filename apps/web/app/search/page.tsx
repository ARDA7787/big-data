'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search as SearchIcon,
  Filter,
  SortAsc,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { api, SearchResult } from '@/lib/api'
import { cn, formatNumber, truncate } from '@/lib/utils'
import { Card } from '@/components/ui/card'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('relevance')
  const [yearFrom, setYearFrom] = useState<number | undefined>()
  const [yearTo, setYearTo] = useState<number | undefined>()
  const [source, setSource] = useState<string | undefined>()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', query, page, sortBy, yearFrom, yearTo, source],
    queryFn: () =>
      api.search({
        q: query,
        page,
        page_size: 20,
        sort_by: sortBy,
        year_from: yearFrom,
        year_to: yearTo,
        source,
      }),
    enabled: query.length > 0,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-white p-6 shadow-inner-soft">
        <h2 className="text-xl font-semibold text-neutral-900">
          Search Research Papers
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Find papers across arXiv, PubMed, and OpenAlex
        </p>

        <form onSubmit={handleSearch} className="mt-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, abstract, or keywords..."
              className="w-full rounded-xl border border-neutral-200 bg-white py-3.5 pl-12 pr-4 text-neutral-900 placeholder:text-neutral-400 focus:border-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Search
            </button>
          </div>
        </form>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-neutral-400" />
            <span className="text-sm text-neutral-500">Filters:</span>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="relevance">Relevance</option>
            <option value="year">Year (newest)</option>
            <option value="citations">Citations</option>
            <option value="pagerank">Influence</option>
          </select>

          <select
            value={source || ''}
            onChange={(e) => setSource(e.target.value || undefined)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All Sources</option>
            <option value="arxiv">arXiv</option>
            <option value="pubmed">PubMed</option>
            <option value="openalex">OpenAlex</option>
          </select>

          <input
            type="number"
            placeholder="From year"
            value={yearFrom || ''}
            onChange={(e) => setYearFrom(e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-28 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />

          <input
            type="number"
            placeholder="To year"
            value={yearTo || ''}
            onChange={(e) => setYearTo(e.target.value ? parseInt(e.target.value) : undefined)}
            className="w-28 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>

      {/* Results */}
      {query.length > 0 && (
        <div className="space-y-4">
          {/* Results Header */}
          {data && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                Found <span className="font-medium text-neutral-900">{formatNumber(data.total)}</span> results
                {isFetching && <span className="ml-2 text-primary-600">Updating...</span>}
              </p>
              {data.facets && (
                <div className="flex gap-4 text-xs text-neutral-400">
                  {data.facets.sources.map((s) => (
                    <span key={s.value}>
                      {s.value}: {formatNumber(s.count)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 w-3/4 rounded bg-neutral-100" />
                    <div className="h-4 w-1/4 rounded bg-neutral-100" />
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded bg-neutral-100" />
                      <div className="h-3 w-5/6 rounded bg-neutral-100" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Results List */}
          <AnimatePresence mode="popLayout">
            {data?.results.map((result, index) => (
              <motion.div
                key={result.work_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <SearchResultCard result={result} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-4 text-sm text-neutral-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* No Results */}
          {data?.results.length === 0 && (
            <Card className="p-12 text-center">
              <SearchIcon className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 text-lg font-medium text-neutral-900">
                No results found
              </h3>
              <p className="mt-2 text-neutral-500">
                Try adjusting your search or filters
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {query.length === 0 && (
        <Card className="p-12 text-center">
          <SearchIcon className="mx-auto h-12 w-12 text-neutral-300" />
          <h3 className="mt-4 text-lg font-medium text-neutral-900">
            Start searching
          </h3>
          <p className="mt-2 text-neutral-500">
            Enter keywords to find research papers
          </p>
        </Card>
      )}
    </div>
  )
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const sourceColors: Record<string, string> = {
    arxiv: 'bg-red-100 text-red-700',
    pubmed: 'bg-blue-100 text-blue-700',
    openalex: 'bg-orange-100 text-orange-700',
  }

  return (
    <Card className="group p-6 transition-all hover:border-primary-200 hover:shadow-soft-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {result.source && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  sourceColors[result.source] || 'bg-neutral-100 text-neutral-700'
                )}
              >
                {result.source}
              </span>
            )}
            {result.year && (
              <span className="text-xs text-neutral-400">{result.year}</span>
            )}
          </div>

          <h3 className="mt-2 font-semibold text-neutral-900 group-hover:text-primary-700">
            {result.title}
          </h3>

          {result.abstract && (
            <p className="mt-2 text-sm text-neutral-600 line-clamp-2">
              {truncate(result.abstract, 300)}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            {result.primary_field && (
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                {result.primary_field}
              </span>
            )}
            {result.citation_count !== undefined && result.citation_count > 0 && (
              <span className="text-neutral-500">
                {formatNumber(result.citation_count)} citations
              </span>
            )}
            {result.pagerank !== undefined && result.pagerank > 0 && (
              <span className="text-neutral-500">
                Influence: {result.pagerank.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        {result.doi && (
          <a
            href={`https://doi.org/${result.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 opacity-0 transition-all group-hover:opacity-100 hover:border-primary-300 hover:text-primary-600"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </Card>
  )
}

