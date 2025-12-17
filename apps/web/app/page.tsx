'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  FileText,
  Users,
  Quote,
  Calendar,
  Database,
  Lightbulb,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/utils'
import { StatsCard } from '@/components/ui/stats-card'
import { Card } from '@/components/ui/card'
import { YearlyChart } from '@/components/charts/yearly-chart'
import { SourcesChart } from '@/components/charts/sources-chart'

export default function HomePage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: api.getOverview,
  })

  const { data: yearly } = useQuery({
    queryKey: ['yearly-stats'],
    queryFn: api.getYearlyStats,
  })

  const { data: sources } = useQuery({
    queryKey: ['source-stats'],
    queryFn: api.getSourceStats,
  })

  const { data: emerging } = useQuery({
    queryKey: ['emerging'],
    queryFn: api.getEmerging,
  })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Hero Section */}
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-8 text-white shadow-soft-lg">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold">Scholarly Knowledge Graph</h2>
          <p className="mt-2 max-w-2xl text-primary-100">
            Unified dataset of research papers from arXiv, PubMed, and OpenAlex.
            Explore citation networks, discover emerging topics, and analyze
            research influence at scale.
          </p>
          
          <div className="mt-6 flex gap-4">
            <a
              href="/search"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-primary-700 shadow-sm transition-all hover:bg-primary-50"
            >
              Start Exploring
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="/graph"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10"
            >
              View Graph
            </a>
          </div>
        </div>
      </motion.section>

      {/* KPI Cards */}
      <motion.section variants={itemVariants}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatsCard
            title="Total Works"
            value={stats?.total_works || 0}
            icon={FileText}
            loading={statsLoading}
            trend={{ value: 12, label: 'vs last month' }}
          />
          <StatsCard
            title="Authors"
            value={stats?.total_authors || 0}
            icon={Users}
            loading={statsLoading}
          />
          <StatsCard
            title="Citations"
            value={stats?.total_citations || 0}
            icon={Quote}
            loading={statsLoading}
          />
          <StatsCard
            title="Years Covered"
            value={stats?.years_covered || 0}
            icon={Calendar}
            loading={statsLoading}
          />
          <StatsCard
            title="Sources"
            value={stats?.sources || 0}
            icon={Database}
            loading={statsLoading}
          />
          <StatsCard
            title="Topics"
            value={stats?.topics || 0}
            icon={Lightbulb}
            loading={statsLoading}
          />
        </div>
      </motion.section>

      {/* Charts Row */}
      <motion.section variants={itemVariants} className="grid gap-6 lg:grid-cols-3">
        {/* Publications Over Time */}
        <Card className="col-span-2 p-6">
          <h3 className="text-sm font-medium text-neutral-500">
            Publications Over Time
          </h3>
          <div className="mt-4 h-64">
            <YearlyChart data={yearly || []} />
          </div>
        </Card>

        {/* Sources Distribution */}
        <Card className="p-6">
          <h3 className="text-sm font-medium text-neutral-500">
            Data Sources
          </h3>
          <div className="mt-4 h-64">
            <SourcesChart data={sources?.sources || []} />
          </div>
        </Card>
      </motion.section>

      {/* Emerging Topics */}
      <motion.section variants={itemVariants}>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                Emerging Topics
              </h3>
              <p className="text-sm text-neutral-500">
                Research areas showing rapid growth
              </p>
            </div>
            <a
              href="/topics"
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all →
            </a>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {emerging?.emerging_topics?.slice(0, 6).map((topic, index) => (
              <div
                key={topic.topic_id}
                className="group rounded-xl border border-neutral-100 bg-neutral-50 p-4 transition-all hover:border-primary-200 hover:bg-primary-50/50"
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl font-bold text-neutral-200">
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    <TrendingUp className="h-3 w-3" />
                    {(topic.growth_rate * 100).toFixed(0)}%
                  </div>
                </div>
                <h4 className="mt-2 font-medium text-neutral-900 group-hover:text-primary-700">
                  {topic.label}
                </h4>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatNumber(topic.paper_count)} papers
                </p>
              </div>
            ))}
          </div>
        </Card>
      </motion.section>

      {/* Quick Actions */}
      <motion.section variants={itemVariants}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Search Papers',
              description: 'Find research by keywords',
              href: '/search',
              icon: FileText,
              color: 'from-blue-500 to-blue-600',
            },
            {
              title: 'Explore Topics',
              description: 'Analyze research trends',
              href: '/topics',
              icon: TrendingUp,
              color: 'from-emerald-500 to-emerald-600',
            },
            {
              title: 'View Rankings',
              description: 'Top papers by influence',
              href: '/rankings',
              icon: Users,
              color: 'from-amber-500 to-amber-600',
            },
            {
              title: 'Graph Explorer',
              description: 'Visualize citations',
              href: '/graph',
              icon: Database,
              color: 'from-purple-500 to-purple-600',
            },
          ].map((action) => (
            <a
              key={action.title}
              href={action.href}
              className="group relative overflow-hidden rounded-xl bg-white p-5 shadow-soft transition-all hover:shadow-soft-lg"
            >
              <div
                className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${action.color} opacity-10 transition-transform group-hover:scale-150`}
              />
              <action.icon className="h-6 w-6 text-neutral-400" />
              <h4 className="mt-4 font-semibold text-neutral-900">
                {action.title}
              </h4>
              <p className="mt-1 text-sm text-neutral-500">
                {action.description}
              </p>
            </a>
          ))}
        </div>
      </motion.section>
    </motion.div>
  )
}

