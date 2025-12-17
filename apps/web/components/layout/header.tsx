'use client'

import { usePathname } from 'next/navigation'
import { Search, Bell, Settings } from 'lucide-react'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Overview',
    subtitle: 'Executive summary and key metrics',
  },
  '/search': {
    title: 'Search',
    subtitle: 'Find research papers across all sources',
  },
  '/topics': {
    title: 'Topic Trends',
    subtitle: 'Explore research topics and their evolution',
  },
  '/rankings': {
    title: 'Influence Rankings',
    subtitle: 'Top papers and authors by impact',
  },
  '/graph': {
    title: 'Graph Explorer',
    subtitle: 'Visualize citation networks',
  },
  '/pipeline': {
    title: 'Pipeline Health',
    subtitle: 'Data ingestion and quality metrics',
  },
}

export function Header() {
  const pathname = usePathname()
  const pageInfo = pageTitles[pathname] || { title: 'Page', subtitle: '' }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-100 bg-white/80 px-8 backdrop-blur-xl">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          {pageInfo.title}
        </h1>
        <p className="text-sm text-neutral-500">{pageInfo.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Quick search..."
            className="h-9 w-64 rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-4 text-sm placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-2xs text-neutral-400">
            ⌘K
          </kbd>
        </div>

        {/* Actions */}
        <button className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
          <Bell className="h-5 w-5" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
          <Settings className="h-5 w-5" />
        </button>

        {/* Avatar */}
        <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-medium text-white">
          AS
        </div>
      </div>
    </header>
  )
}

