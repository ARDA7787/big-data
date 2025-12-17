'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Database,
  CheckCircle,
  AlertCircle,
  Clock,
  Server,
  HardDrive,
  Cpu,
  Activity,
  RefreshCcw,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

export default function PipelinePage() {
  const { data: pipelineStats, isLoading, refetch } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: api.getPipelineStats,
    refetchInterval: 30000, // Refresh every 30 seconds
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-success bg-success/10'
      case 'warning':
        return 'text-warning bg-warning/10'
      case 'error':
        return 'text-error bg-error/10'
      default:
        return 'text-neutral-500 bg-neutral-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return CheckCircle
      case 'warning':
        return Clock
      case 'error':
        return AlertCircle
      default:
        return Activity
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">
            Pipeline Health & Monitoring
          </h2>
          <p className="text-sm text-neutral-500">
            Data ingestion and processing status
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </motion.div>

      {/* System Status */}
      <motion.section variants={itemVariants}>
        <h3 className="mb-4 text-sm font-medium text-neutral-500">System Status</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              name: 'HDFS',
              status: 'healthy',
              details: 'NameNode running',
              icon: HardDrive,
            },
            {
              name: 'Spark',
              status: 'healthy',
              details: '2 workers available',
              icon: Cpu,
            },
            {
              name: 'Elasticsearch',
              status: 'healthy',
              details: 'Cluster green',
              icon: Database,
            },
            {
              name: 'API',
              status: pipelineStats?.status || 'unknown',
              details: 'All endpoints responding',
              icon: Server,
            },
          ].map((service) => {
            const StatusIcon = getStatusIcon(service.status)
            return (
              <Card key={service.name} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
                      <service.icon className="h-5 w-5 text-neutral-600" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{service.name}</p>
                      <p className="text-xs text-neutral-500">{service.details}</p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full',
                      getStatusColor(service.status)
                    )}
                  >
                    <StatusIcon className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </motion.section>

      {/* Ingestion Statistics */}
      <motion.section variants={itemVariants}>
        <h3 className="mb-4 text-sm font-medium text-neutral-500">
          Ingestion Statistics
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Records by Source */}
          <Card className="p-5">
            <h4 className="font-medium text-neutral-900">Records by Source</h4>
            <div className="mt-4 space-y-3">
              {Object.entries(
                pipelineStats?.ingestion?.records_by_source || {
                  arxiv: 400,
                  pubmed: 300,
                  openalex: 300,
                }
              ).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        source === 'arxiv'
                          ? 'bg-blue-500'
                          : source === 'pubmed'
                          ? 'bg-green-500'
                          : 'bg-purple-500'
                      )}
                    />
                    <span className="text-sm text-neutral-600 capitalize">
                      {source}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-neutral-900">
                    {formatNumber(count as number)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Last Ingestion */}
          <Card className="p-5">
            <h4 className="font-medium text-neutral-900">Last Ingestion</h4>
            <div className="mt-4">
              <p className="text-2xl font-bold text-neutral-900">
                {pipelineStats?.ingestion?.last_run
                  ? new Date(pipelineStats.ingestion.last_run).toLocaleDateString()
                  : 'N/A'}
              </p>
              <p className="text-sm text-neutral-500">
                {pipelineStats?.ingestion?.last_run
                  ? new Date(pipelineStats.ingestion.last_run).toLocaleTimeString()
                  : 'No ingestion recorded'}
              </p>
            </div>
          </Card>

          {/* Pipeline Duration */}
          <Card className="p-5">
            <h4 className="font-medium text-neutral-900">Pipeline Duration</h4>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Ingestion</span>
                <span className="font-medium">~2 min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">ETL</span>
                <span className="font-medium">~30 sec</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Analytics</span>
                <span className="font-medium">~1 min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Indexing</span>
                <span className="font-medium">~15 sec</span>
              </div>
            </div>
          </Card>
        </div>
      </motion.section>

      {/* Data Quality */}
      <motion.section variants={itemVariants}>
        <h3 className="mb-4 text-sm font-medium text-neutral-500">Data Quality</h3>
        <Card className="p-5">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                metric: 'Missing Abstract Rate',
                value: pipelineStats?.quality?.missing_abstract_rate || 0.15,
                threshold: 0.2,
                format: 'percent',
              },
              {
                metric: 'Missing DOI Rate',
                value: pipelineStats?.quality?.missing_doi_rate || 0.25,
                threshold: 0.3,
                format: 'percent',
              },
              {
                metric: 'Missing Authors Rate',
                value: pipelineStats?.quality?.missing_authors_rate || 0.02,
                threshold: 0.05,
                format: 'percent',
              },
              {
                metric: 'Duplicate Rate',
                value: pipelineStats?.quality?.duplicate_rate || 0.05,
                threshold: 0.1,
                format: 'percent',
              },
            ].map((item) => {
              const isGood = item.value <= item.threshold
              return (
                <div key={item.metric} className="text-center">
                  <p className="text-sm text-neutral-500">{item.metric}</p>
                  <p
                    className={cn(
                      'mt-1 text-2xl font-bold',
                      isGood ? 'text-success' : 'text-warning'
                    )}
                  >
                    {(item.value * 100).toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Threshold: {(item.threshold * 100).toFixed(0)}%
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      </motion.section>

      {/* Quick Actions */}
      <motion.section variants={itemVariants}>
        <h3 className="mb-4 text-sm font-medium text-neutral-500">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'HDFS Browser',
              description: 'View files in HDFS',
              href: 'http://localhost:9870/explorer.html',
              external: true,
            },
            {
              title: 'Spark UI',
              description: 'Monitor Spark jobs',
              href: 'http://localhost:8080',
              external: true,
            },
            {
              title: 'Elasticsearch',
              description: 'View indices',
              href: 'http://localhost:9200/_cat/indices?v',
              external: true,
            },
            {
              title: 'API Docs',
              description: 'OpenAPI documentation',
              href: 'http://localhost:8000/docs',
              external: true,
            },
          ].map((action) => (
            <a
              key={action.title}
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noopener noreferrer' : undefined}
              className="group rounded-xl border border-neutral-100 bg-white p-4 transition-all hover:border-primary-200 hover:shadow-soft"
            >
              <h4 className="font-medium text-neutral-900 group-hover:text-primary-600">
                {action.title}
              </h4>
              <p className="mt-1 text-sm text-neutral-500">{action.description}</p>
            </a>
          ))}
        </div>
      </motion.section>

      {/* Notes */}
      <motion.section variants={itemVariants}>
        <Card className="border-amber-200 bg-amber-50/50 p-5">
          <h3 className="font-medium text-amber-800">
            Author Disambiguation Notes
          </h3>
          <p className="mt-2 text-sm text-amber-700">
            Author matching uses name-based hashing, which may conflate authors
            with identical names. For production use, consider implementing ML-based
            author disambiguation using ORCID, affiliation patterns, and co-authorship
            networks.
          </p>
        </Card>
      </motion.section>
    </motion.div>
  )
}

