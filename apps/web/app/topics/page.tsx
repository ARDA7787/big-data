'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { TrendingUp, Zap, ArrowUpRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatNumber, cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { TopicTrendsChart } from '@/components/charts/topic-trends-chart'

export default function TopicsPage() {
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null)

  const { data: topics } = useQuery({
    queryKey: ['topics'],
    queryFn: api.getTopics,
  })

  const { data: trends } = useQuery({
    queryKey: ['topic-trends', selectedTopic],
    queryFn: () => api.getTopicTrends({ topic_id: selectedTopic || undefined }),
  })

  const { data: emerging } = useQuery({
    queryKey: ['emerging-topics'],
    queryFn: () => api.getEmergingTopics(10),
  })

  return (
    <div className="space-y-8">
      {/* Emerging Topics Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Emerging Topics
            </h2>
            <p className="text-sm text-neutral-500">
              Research areas with significant recent growth
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {emerging?.map((topic, index) => (
            <motion.div
              key={topic.topic_id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn(
                  'cursor-pointer p-4 transition-all hover:border-primary-200 hover:shadow-soft-lg',
                  selectedTopic === topic.topic_id && 'border-primary-300 ring-2 ring-primary-500/20'
                )}
                onClick={() => setSelectedTopic(topic.topic_id)}
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
                <h3 className="mt-2 font-semibold text-neutral-900">
                  {topic.label}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatNumber(topic.paper_count)} papers
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trend Visualization */}
      <section>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                Topic Trends Over Time
              </h3>
              <p className="text-sm text-neutral-500">
                {selectedTopic
                  ? `Showing trend for selected topic`
                  : 'Select a topic to see its trend'}
              </p>
            </div>
            {selectedTopic && (
              <button
                onClick={() => setSelectedTopic(null)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Show all topics
              </button>
            )}
          </div>
          <div className="h-80">
            <TopicTrendsChart
              data={trends?.trends || []}
              selectedTopic={selectedTopic}
            />
          </div>
        </Card>
      </section>

      {/* All Topics Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              All Topics
            </h2>
            <p className="text-sm text-neutral-500">
              Browse topics discovered by LDA topic modeling
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics?.map((topic) => (
            <Card
              key={topic.topic_id}
              className={cn(
                'cursor-pointer p-5 transition-all hover:border-primary-200 hover:shadow-soft-lg',
                selectedTopic === topic.topic_id && 'border-primary-300 ring-2 ring-primary-500/20'
              )}
              onClick={() => setSelectedTopic(topic.topic_id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-600">
                  {topic.topic_id}
                </div>
                <ArrowUpRight className="h-4 w-4 text-neutral-300" />
              </div>

              <h3 className="mt-3 font-semibold text-neutral-900">
                {topic.label}
              </h3>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {topic.top_terms.slice(0, 5).map((term, i) => (
                  <span
                    key={i}
                    className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                    style={{
                      opacity: 0.5 + (term.weight / (topic.top_terms[0]?.weight || 1)) * 0.5,
                    }}
                  >
                    {term.term}
                  </span>
                ))}
              </div>

              {topic.paper_count && (
                <p className="mt-3 text-sm text-neutral-500">
                  {formatNumber(topic.paper_count)} papers
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

