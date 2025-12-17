'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, Settings, Activity, User, LogOut, HelpCircle, X, Bookmark, Server, Database, Wifi } from 'lucide-react'
import { api } from '@/lib/api'
import { motion, AnimatePresence } from 'framer-motion'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Overview of your scholarly knowledge graph',
  },
  '/search': {
    title: 'Search Papers',
    subtitle: 'Find research across arXiv, PubMed, and OpenAlex',
  },
  '/topics': {
    title: 'Topic Trends',
    subtitle: 'Discover and explore research themes',
  },
  '/rankings': {
    title: 'Influence Rankings',
    subtitle: 'Top papers and authors by PageRank and citations',
  },
  '/graph': {
    title: 'Citation Graph',
    subtitle: 'Explore paper citation networks',
  },
  '/pipeline': {
    title: 'System Status',
    subtitle: 'Pipeline health and data quality',
  },
  '/profile': {
    title: 'Your Profile',
    subtitle: 'Saved papers and authors',
  },
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const pageInfo = pageTitles[pathname] || { title: 'Page', subtitle: '' }

  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'general' | 'pipeline'>('general')
  const profileRef = useRef<HTMLDivElement>(null)

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Check system health
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30000,
  })

  const isHealthy = health?.status === 'healthy'

  // Handle search submission
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-100 bg-white/80 px-8 backdrop-blur-xl">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">
            {pageInfo.title}
          </h1>
          <p className="text-sm text-neutral-500">{pageInfo.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Search */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Quick search..."
              className="h-9 w-64 rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-12 text-sm placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-2xs text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 transition-colors"
              title="Press Enter or click to search"
            >
              ↵
            </button>
          </form>

          {/* Activity/Pipeline Status - just the icon */}
          <button 
            onClick={() => { setShowSettings(true); setSettingsTab('pipeline'); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 relative"
            title="System Status"
          >
            <Activity className="h-5 w-5" />
            {/* Status dot */}
            <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`} />
          </button>

          {/* Settings */}
          <button 
            onClick={() => { setShowSettings(true); setSettingsTab('general'); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* Profile Dropdown */}
          <div className="relative ml-2" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-medium text-white hover:from-primary-500 hover:to-primary-700 transition-all"
              title="Profile"
            >
              AS
            </button>

            {/* Profile Dropdown Menu */}
            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-neutral-200 bg-white py-2 shadow-lg"
                >
                  <div className="px-4 py-3 border-b border-neutral-100">
                    <p className="text-sm font-semibold text-neutral-900">Aarya Shah</p>
                    <p className="text-xs text-neutral-500">CS-GY 6513 • NYU Tandon</p>
                  </div>
                  <div className="py-1">
                    <a
                      href="/profile"
                      onClick={() => setShowProfile(false)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <Bookmark className="h-4 w-4 text-neutral-400" />
                      Saved Papers
                    </a>
                    <button
                      onClick={() => { setShowProfile(false); setShowSettings(true); setSettingsTab('pipeline'); }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <Activity className="h-4 w-4 text-neutral-400" />
                      Pipeline Status
                    </button>
                    <button
                      onClick={() => { setShowProfile(false); setShowSettings(true); setSettingsTab('general'); }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <Settings className="h-4 w-4 text-neutral-400" />
                      Settings
                    </button>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <HelpCircle className="h-4 w-4 text-neutral-400" />
                      Documentation
                    </a>
                  </div>
                  <div className="border-t border-neutral-100 py-1">
                    <button
                      onClick={() => setShowProfile(false)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Demo Mode (No Auth)
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Settings Modal - CENTERED PROPERLY */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            
            {/* Modal - Fixed centering */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div 
                className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-6 border-b border-neutral-100">
                  <h2 className="text-xl font-semibold text-neutral-900">Settings</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-neutral-100">
                  <button
                    onClick={() => setSettingsTab('general')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      settingsTab === 'general'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    General
                  </button>
                  <button
                    onClick={() => setSettingsTab('pipeline')}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      settingsTab === 'pipeline'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    Pipeline Status
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {settingsTab === 'general' && (
                    <>
                      {/* API Configuration */}
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">API Configuration</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-neutral-500 mb-1">Backend API URL</label>
                            <input
                              type="text"
                              value="http://localhost:8000"
                              readOnly
                              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-neutral-50 text-neutral-600"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Data Info */}
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Dataset Info</h3>
                        <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50 text-sm text-neutral-600">
                          <p>This is a demo deployment with ~1000 papers from arXiv, PubMed, and OpenAlex.</p>
                          <p className="mt-2 text-xs text-neutral-500">
                            To run with more data, modify <code className="bg-neutral-200 px-1 rounded">configs/demo.yaml</code> and re-run the pipeline.
                          </p>
                        </div>
                      </div>

                      {/* Project Info */}
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Project</h3>
                        <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50 text-sm text-neutral-600">
                          <p className="font-medium">Big Data Course Project</p>
                          <p className="text-xs text-neutral-500 mt-1">CS-GY 6513 • NYU Tandon</p>
                          <p className="text-xs text-neutral-500">Aarya Shah • Aryan Donde</p>
                        </div>
                      </div>
                    </>
                  )}

                  {settingsTab === 'pipeline' && (
                    <>
                      {/* System Status */}
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">System Status</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4">
                            <Server className="h-5 w-5 text-neutral-400" />
                            <div>
                              <p className="text-sm font-medium text-neutral-900">API</p>
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <span className="text-xs text-neutral-500">{isHealthy ? 'Connected' : 'Checking...'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4">
                            <Database className="h-5 w-5 text-neutral-400" />
                            <div>
                              <p className="text-sm font-medium text-neutral-900">Elasticsearch</p>
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${health?.elasticsearch === 'healthy' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <span className="text-xs text-neutral-500">{health?.elasticsearch === 'healthy' ? 'Healthy' : 'Checking...'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4">
                            <Wifi className="h-5 w-5 text-neutral-400" />
                            <div>
                              <p className="text-sm font-medium text-neutral-900">Spark</p>
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-xs text-neutral-500">Available</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-4">
                            <Database className="h-5 w-5 text-neutral-400" />
                            <div>
                              <p className="text-sm font-medium text-neutral-900">HDFS</p>
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-xs text-neutral-500">Running</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pipeline Info */}
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Pipeline Information</h3>
                        <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50 text-sm text-neutral-600 space-y-2">
                          <div className="flex justify-between">
                            <span>Last Ingestion</span>
                            <span className="font-medium">Demo Data</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ETL Duration</span>
                            <span className="font-medium">~30 sec</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Analytics Duration</span>
                            <span className="font-medium">~1 min</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Indexing Duration</span>
                            <span className="font-medium">~15 sec</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Links */}
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Quick Links</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <a
                            href="http://localhost:50070"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-neutral-200 p-3 text-sm hover:bg-neutral-50 transition-colors"
                          >
                            <p className="font-medium text-neutral-900">HDFS Browser</p>
                            <p className="text-xs text-neutral-500">View files in HDFS</p>
                          </a>
                          <a
                            href="http://localhost:8080"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-neutral-200 p-3 text-sm hover:bg-neutral-50 transition-colors"
                          >
                            <p className="font-medium text-neutral-900">Spark UI</p>
                            <p className="text-xs text-neutral-500">Monitor Spark jobs</p>
                          </a>
                          <a
                            href="http://localhost:9200"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-neutral-200 p-3 text-sm hover:bg-neutral-50 transition-colors"
                          >
                            <p className="font-medium text-neutral-900">Elasticsearch</p>
                            <p className="text-xs text-neutral-500">View indices</p>
                          </a>
                          <a
                            href="http://localhost:8000/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-neutral-200 p-3 text-sm hover:bg-neutral-50 transition-colors"
                          >
                            <p className="font-medium text-neutral-900">API Docs</p>
                            <p className="text-xs text-neutral-500">OpenAPI documentation</p>
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end p-6 pt-0">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
