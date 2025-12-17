'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Home,
  Search,
  TrendingUp,
  Trophy,
  Network,
  Activity,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Overview', href: '/', icon: Home },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'Topics', href: '/topics', icon: TrendingUp },
  { name: 'Rankings', href: '/rankings', icon: Trophy },
  { name: 'Graph Explorer', href: '/graph', icon: Network },
  { name: 'Pipeline', href: '/pipeline', icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-200 bg-white">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-neutral-100 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-sm">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-neutral-900">
              ScholarGraph
            </h1>
            <p className="text-xs text-neutral-500">Knowledge at Scale</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 rounded-lg bg-primary-50"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon
                  className={cn(
                    'relative z-10 h-5 w-5 transition-colors',
                    isActive
                      ? 'text-primary-600'
                      : 'text-neutral-400 group-hover:text-neutral-600'
                  )}
                />
                <span className="relative z-10">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-neutral-100 px-4 py-4">
          <div className="rounded-lg bg-gradient-to-br from-primary-50 to-primary-100/50 p-4">
            <p className="text-xs font-medium text-primary-900">
              Big Data Course Project
            </p>
            <p className="mt-1 text-xs text-primary-700/80">
              CS-GY 6513 • NYU Tandon
            </p>
            <div className="mt-3 flex gap-2 text-2xs text-primary-600/70">
              <span>Aarya Shah</span>
              <span>•</span>
              <span>Aryan Donde</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

