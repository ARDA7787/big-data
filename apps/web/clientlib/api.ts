export type OverviewStats = {
  total_works: number
  total_authors: number
  total_citations: number
  years_covered: number
  sources: number
  topics: number
}

export type YearlyStats = {
  year: number
  paper_count: number
  field_count?: number
}

export type SourceBreakdown = {
  source: string
  paper_count: number
  percentage: number
}

export type RankedPaper = {
  work_id: string
  title: string
  year?: number
  primary_field?: string
  pagerank: number
  citation_count: number
  community_id?: number
  abstract?: string
  source?: string
  doi?: string
}

export type RankedAuthor = {
  author_id: string
  name: string
  affiliation?: string
  total_pagerank: number
  total_citations: number
  paper_count: number
}

export type SearchResult = {
  work_id: string
  title: string
  year?: number
  source?: string
  citation_count?: number
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function getJSON<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

function buildQuery(params: Record<string, any>): string {
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) usp.set(k, String(v))
  })
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  async getOverview(): Promise<OverviewStats> {
    return getJSON<OverviewStats>('/stats/overview')
  },

  async getYearlyStats(): Promise<YearlyStats[]> {
    return getJSON<YearlyStats[]>('/stats/yearly')
  },

  async getSourceStats(): Promise<{ sources: SourceBreakdown[] }> {
    return getJSON<{ sources: SourceBreakdown[] }>('/stats/sources')
  },

  async getEmerging(): Promise<{ emerging_topics: { topic_id: number; label: string; paper_count: number; topic_share: number; growth_rate: number }[] }> {
    return getJSON('/stats/emerging')
  },

  async getYearSourceStats(): Promise<{ data: { year: number; arxiv: number; pubmed: number; openalex: number }[] }> {
    return getJSON('/stats/year-source')
  },

  async getTopPapers(params: { sort_by?: 'pagerank' | 'citations'; year_from?: number; year_to?: number; field?: string; limit?: number } = {}): Promise<RankedPaper[]> {
    const q = buildQuery(params)
    return getJSON<RankedPaper[]>(`/rankings/papers${q}`)
  },

  async getTopAuthors(params: { sort_by?: 'pagerank' | 'citations'; limit?: number } = {}): Promise<RankedAuthor[]> {
    const q = buildQuery(params)
    return getJSON<RankedAuthor[]>(`/rankings/authors${q}`)
  },

  async getComparison(limit = 100): Promise<{ papers: { work_id: string; title: string; year?: number; primary_field?: string; pagerank: number; citation_count: number }[]; stats: { correlation: number; avg_pagerank: number; avg_citations: number; total_papers: number } }> {
    const q = buildQuery({ limit })
    return getJSON(`/rankings/comparison${q}`)
  },

  async search(params: { q: string; year_from?: number; year_to?: number; source?: string; page?: number; page_size?: number }): Promise<{ total: number; results: SearchResult[] }> {
    const q = buildQuery(params)
    return getJSON(`/search${q}`)
  },

  async getNeighborhood(params: { work_id: string; hops?: number; max_nodes?: number; direction?: 'both' | 'citing' | 'cited'; year_from?: number; year_to?: number }): Promise<{ center: any; nodes: any[]; edges: { source: string; target: string }[]; stats: any }> {
    const { work_id, ...rest } = params
    const q = buildQuery(rest)
    return getJSON(`/graph/neighborhood/${encodeURIComponent(work_id)}${q}`)
  },

  async getGraphStats(): Promise<{ nodes: number; edges: number; communities: number; avg_degree: number; density: number }> {
    return getJSON('/graph/stats')
  },

  async health(): Promise<{ status: string; elasticsearch: string; data: string }> {
    return getJSON('/health')
  },

  async getFieldStats(): Promise<{ fields: { field: string; paper_count: number; percentage: number }[] }> {
    return getJSON('/stats/fields')
  },
}
