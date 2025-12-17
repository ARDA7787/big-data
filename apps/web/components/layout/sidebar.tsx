'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Search,
  TrendingUp,
  Trophy,
  Network,
  BookOpen,
  Github,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Simplified navigation - no sections
const navItems = [
  { name: 'Search Papers', href: '/search', icon: Search },
  { name: 'Topic Trends', href: '/topics', icon: TrendingUp },
  { name: 'Rankings', href: '/rankings', icon: Trophy },
  { name: 'Citation Graph', href: '/graph', icon: Network },
]

interface NavItemProps {
  item: { name: string; href: string; icon: any }
  pathname: string
}

function NavItem({ item, pathname }: NavItemProps) {
  const isActive = pathname === item.href
  return (
    <Link
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
}

export function Sidebar() {
  const pathname = usePathname()
  const isHomePage = pathname === '/'

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-neutral-200 bg-white">
      <div className="flex h-full flex-col">
        {/* Logo - Clickable to Dashboard */}
        <Link 
          href="/"
          className={cn(
            'flex h-16 items-center gap-3 border-b border-neutral-100 px-6 transition-colors hover:bg-neutral-50',
            isHomePage && 'bg-primary-50/50'
          )}
        >
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-all',
            isHomePage 
              ? 'bg-gradient-to-br from-primary-600 to-primary-800' 
              : 'bg-gradient-to-br from-primary-500 to-primary-700'
          )}>
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-neutral-900">
              ScholarGraph
            </h1>
            <p className="text-xs text-neutral-500">Knowledge at Scale</p>
          </div>
        </Link>

        {/* Navigation - No section headers */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </nav>

        {/* Footer - Clickable GitHub link */}
        <div className="border-t border-neutral-100 px-4 py-4">
          <a
            href="https://github.com/ARDA7787/big-data"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-gradient-to-br from-primary-50 to-primary-100/50 p-4 transition-all hover:from-primary-100 hover:to-primary-100 hover:shadow-md group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-primary-900">
                Big Data Course Project
              </p>
              <Github className="h-4 w-4 text-primary-600 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-1 text-xs text-primary-700/80">
              CS-GY 6513 • NYU Tandon
            </p>
            <div className="mt-3 flex items-center gap-2 text-2xs text-primary-600/70">
              <span>Aarya Shah</span>
              <span>•</span>
              <span>Aryan Donde</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-2xs text-primary-600">
              <ExternalLink className="h-3 w-3" />
              <span>View on GitHub</span>
            </div>
          </a>
        </div>
      </div>
    </aside>
  )
}
