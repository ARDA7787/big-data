# ScholarGraph Repository Technical Dossier (IEEE-Style Overview)

## Abstract
ScholarGraph unifies scholarly metadata from arXiv, PubMed, and OpenAlex into a scalable knowledge graph that supports citation-aware analytics and an interactive research intelligence dashboard. The platform combines resumable ingestion, Spark-based ETL and analytics, Elasticsearch serving, a FastAPI backend, and a production-grade Next.js frontend orchestrated through Docker Compose. This dossier provides an exhaustive IEEE report-ready narrative covering architecture, data governance, implementation specifics, algorithmic details, API specifications, UI components, operational workflows, and future work considerations.

## Index Terms
Big Data Engineering; Knowledge Graphs; Citation Analytics; Apache Spark; GraphFrames; LDA Topic Modeling; PageRank; FastAPI; Next.js; Elasticsearch; Docker Compose; Year-Balanced Sampling; HDFS; Parquet.

---

## I. Introduction

### A. Problem Context
The global volume of scientific publications exceeds 3 million articles annually, creating an information overload that makes manual synthesis impractical. Researchers require consolidated insights spanning multiple domains, time periods, and citation networks to identify influential works, emerging topics, and research trends.

### B. Project Goal
Build an end-to-end big data pipeline that:
1. Ingests heterogeneous scholarly sources with production-grade resilience
2. Harmonizes data into a unified knowledge graph schema
3. Computes influence metrics and topic analytics at scale
4. Surfaces findings through RESTful APIs and interactive visualizations

### C. Scope
- **Data Engineering**: Multi-source ingestion, ETL pipelines, distributed storage
- **Data Science**: Topic modeling (LDA), graph analytics (PageRank, community detection), trend analysis
- **Backend Services**: RESTful API design, search infrastructure, caching strategies
- **Frontend UX**: Interactive dashboards, data visualizations, user personalization

### D. Team
| Name | Role | Contributions |
|------|------|---------------|
| Aarya Shah | Data Engineering Lead | Ingestion pipelines, Spark ETL, HDFS architecture |
| Aryan Donde | Analytics & Frontend Lead | GraphFrames analytics, LDA implementation, Next.js dashboard |

---

## II. Objectives & Success Criteria

### A. Primary Objectives
1. **Comprehensive Coverage**: Capture ≥1,000 papers (demo) or ≥100,000 papers (full) across AI/ML/NLP domains with temporally balanced distribution (2015–2024).
2. **Scalable Processing**: Leverage Apache Spark and GraphFrames to support multi-stage ETL, topic modeling, and graph algorithms on commodity hardware.
3. **Actionable Analytics**: Deliver topics, trends, rankings, and graph statistics consumable by API clients and UI dashboards.
4. **Operational Reliability**: Provide checkpointed ingestion, rate limiting, health diagnostics, and reproducible orchestration.

### B. Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Ingestion throughput | ≥100 records/min | Records per minute logged |
| ETL latency | <10 min for 1K records | Spark job duration |
| API response time | <200ms p95 | FastAPI middleware metrics |
| Search relevance | Elasticsearch score >0.8 | Manual evaluation |
| Topic coherence | Meaningful labels (no generic verbs) | Qualitative review |

---

## III. Data Sources & Governance

### A. Source Specifications

#### 1. arXiv
- **API**: OAI-PMH and REST API (`export.arxiv.org/api/query`)
- **Rate Limit**: 1 request per 3 seconds (strict enforcement)
- **Categories**: cs.AI, cs.LG, cs.CL, cs.CV (configurable)
- **Data Format**: Atom XML with custom namespaces
- **Fields Extracted**: arxiv_id, title, abstract, authors (name, affiliation), categories, primary_category, published, updated, doi, journal_ref, comment

#### 2. PubMed
- **API**: NCBI E-utilities (esearch + efetch)
- **Rate Limit**: 3 req/s (without API key), 10 req/s (with API key)
- **Search Terms**: "machine learning", "deep learning", "natural language processing"
- **Data Format**: XML (PubmedArticle schema)
- **Fields Extracted**: pmid, title, abstract, authors, journal, pub_date, mesh_terms, keywords, doi, pmc_id

#### 3. OpenAlex
- **API**: REST API (`api.openalex.org/works`)
- **Rate Limit**: 10 req/s (polite pool with email)
- **Filters**: Concept IDs for AI/ML, date ranges, citation count thresholds
- **Data Format**: JSON
- **Fields Extracted**: openalex_id, doi, title, publication_year, publication_date, cited_by_count, authors (with ORCID, affiliations), concepts (with scores), venue, referenced_works, related_works, abstract (inverted index reconstruction), open_access status

### B. Year-Balanced Sampling Strategy
To prevent recency bias (APIs typically return newest papers first), the ingestion implements year-balanced fetching:

```
Year Bins:
├── 2015-2017: 15% allocation (older, foundational papers)
├── 2018-2020: 20% allocation (mid-range)
├── 2021-2022: 25% allocation (recent)
└── 2023-2024: 40% allocation (latest)
```

Implementation uses date-filtered queries per bin with configurable minimum papers per year (`min_per_year: 15`).

### C. Data Governance Controls
| Control | Implementation |
|---------|----------------|
| Global caps | `max_total_records` in YAML config |
| Source limits | Per-source `max_records` setting |
| Rate limiting | Token bucket algorithm with configurable RPS |
| Retry policy | Exponential backoff (factor 2, max 3 attempts) |
| Traceability | Metadata fields: `_ingested_at`, `_source`, `_batch_id` |
| Checkpointing | JSON checkpoint files with cursor and record count |

---

## IV. System Architecture

### A. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Distributed Storage | HDFS | 3.2.1 | Raw and processed data storage |
| File Format | Parquet | - | Columnar storage with Snappy compression |
| Distributed Compute | Apache Spark | 3.3.0 | ETL and analytics processing |
| Graph Processing | GraphFrames | 0.8.2 | PageRank, community detection |
| Machine Learning | Spark MLlib | 3.3.0 | TF-IDF, LDA topic modeling |
| Full-Text Search | Elasticsearch | 8.11.0 | Search indexing and faceted queries |
| Backend Framework | FastAPI | 0.100+ | REST API with async support |
| Data Validation | Pydantic | 2.x | Request/response models |
| In-Memory Analytics | DuckDB | 0.9+ | Parquet querying without ETL |
| Frontend Framework | Next.js | 14.x | React-based SSR/SSG application |
| UI Styling | Tailwind CSS | 3.x | Utility-first CSS framework |
| Charts | Nivo + D3.js | 0.83+ | Data visualizations |
| Animations | Framer Motion | 10.x | UI micro-interactions |
| HTTP Client | httpx | 0.24+ | Async HTTP with connection pooling |
| Container Orchestration | Docker Compose | 2.x | Multi-service orchestration |

### B. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
├───────────────────┬───────────────────┬────────────────────────────────────┤
│      arXiv        │      PubMed       │            OpenAlex                 │
│   REST API        │   E-utilities     │           REST API                  │
│  (1 req/3s)       │   (3-10 req/s)    │         (10 req/s)                  │
└─────────┬─────────┴─────────┬─────────┴──────────────┬─────────────────────┘
          │                   │                        │
          ▼                   ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INGESTION LAYER (Python)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │Rate Limiter │  │Year-Balanced│  │  Storage    │  │  Checkpoint │        │
│  │(Token Bucket)│  │  Sampling   │  │  Manager    │  │   Manager   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ NDJSON.gz
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STORAGE LAYER (HDFS)                                 │
│  ┌──────────────────────────────┬──────────────────────────────────────┐    │
│  │         RAW ZONE             │         PROCESSED ZONE               │    │
│  │  /data/raw/{source}/         │  /data/processed/{table}/            │    │
│  │    ingest_date=YYYY-MM-DD/   │    year={YYYY}/                      │    │
│  │      *.ndjson.gz             │      *.parquet (Snappy)              │    │
│  └──────────────────────────────┴──────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROCESSING LAYER (Spark)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         ETL PIPELINE                                 │    │
│  │  [Read NDJSON] → [Parse Schema] → [Normalize] → [Dedupe] → [Parquet]│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      ANALYTICS PIPELINE                              │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │    │
│  │  │Topic Model│  │ PageRank  │  │ Community │  │  Trends   │        │    │
│  │  │(TF-IDF+LDA)│  │(GraphFrame)│  │(Label Prop)│  │ Analysis  │        │    │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
┌─────────────────────────────┐  ┌────────────────────────────────────────────┐
│      SEARCH INDEX           │  │            API LAYER (FastAPI)             │
│     (Elasticsearch)         │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  ┌───────────────────────┐  │  │  │  Search  │ │  Stats   │ │  Topics  │   │
│  │ scholarly_works index │  │  │  │  Router  │ │  Router  │ │  Router  │   │
│  │  - title^3 (boosted)  │  │  │  └──────────┘ └──────────┘ └──────────┘   │
│  │  - abstract (text)    │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  - year (integer)     │  │  │  │ Rankings │ │  Graph   │ │  Health  │   │
│  │  - pagerank (float)   │  │  │  │  Router  │ │  Router  │ │  Router  │   │
│  │  - citation_count     │  │  │  └──────────┘ └──────────┘ └──────────┘   │
│  └───────────────────────┘  │  │                                            │
└─────────────────────────────┘  └──────────────────┬─────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER (Next.js)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │ Dashboard │ │  Search  │ │  Topics  │ │ Rankings │ │  Graph   │ │Profile│ │
│  │  (KPIs)  │ │ (Faceted)│ │ (Trends) │ │(PageRank)│ │(Force D3)│ │(Saved)│ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### C. Data Flow Summary
1. **Acquisition**: Ingesters fetch data with rate limiting, checkpoint progress, emit NDJSON batches to HDFS raw zone
2. **Curation**: Spark ETL normalizes schemas, deduplicates by DOI (preferring OpenAlex), writes year-partitioned Parquet
3. **Analytics**: Spark MLlib runs LDA; GraphFrames computes PageRank and communities; trend analysis calculates growth rates
4. **Serving**: Elasticsearch indexes works for search; DuckDB queries Parquet for aggregations; FastAPI exposes REST endpoints
5. **Experience**: Next.js dashboard consumes API, renders visualizations, persists user preferences

---

## V. Ingestion Pipeline Implementation

### A. Core Components

#### 1. Rate Limiter (Token Bucket Algorithm)
```python
class RateLimiter:
    """Token bucket rate limiter for API requests."""
    def __init__(self, requests_per_second: float, burst_size: int = 1):
        self.requests_per_second = requests_per_second
        self.burst_size = burst_size
        self.tokens = float(burst_size)
        self.last_update = time.monotonic()
    
    async def acquire(self) -> float:
        """Acquire a token, waiting if necessary. Returns wait time."""
        # Replenish tokens based on elapsed time
        # Wait if no tokens available
        # Track metrics for observability
```

#### 2. Checkpoint Manager
Provides persistent state tracking for resumable ingestion:
- Stores cursor position, records processed, and metadata per source
- Atomic writes via temp file + rename pattern
- JSON format for human readability and debugging

#### 3. Storage Manager
Handles raw data persistence:
- NDJSON format for streaming compatibility
- Gzip compression (~80% size reduction)
- Partitioning: `/data/raw/{source}/ingest_date=YYYY-MM-DD/batch_*.ndjson.gz`
- Automatic metadata injection (`_ingested_at`, `_source`, `_batch_id`)

### B. Source-Specific Ingesters

#### arXiv Ingester
```python
class ArxivIngester:
    BASE_URL = "https://export.arxiv.org/api/query"
    
    def _build_query(self, categories: list[str]) -> str:
        """Build arXiv search query from categories."""
        return " OR ".join(f"cat:{cat}" for cat in categories)
    
    def _parse_entry(self, entry: ET.Element) -> dict:
        """Parse Atom XML entry into record."""
        # Extract arxiv_id from URL, parse authors, categories, dates
    
    async def ingest(self) -> dict:
        """Run year-balanced ingestion with checkpointing."""
        for start_year, end_year, target_records in self._get_year_ranges():
            query = f"({base_query}) AND submittedDate:[{date_from} TO {date_to}]"
            await self._fetch_records_for_query(client, query, target_records)
```

#### OpenAlex Ingester
```python
class OpenAlexIngester:
    BASE_URL = "https://api.openalex.org/works"
    
    def _build_filter_string(self) -> str:
        """Build OpenAlex filter: concepts, date range, citation threshold."""
    
    def _parse_work(self, work: dict) -> dict:
        """Parse JSON work into record with normalized authors, concepts."""
    
    def _reconstruct_abstract(self, inverted_index: dict) -> str:
        """Reconstruct abstract from OpenAlex's inverted index format."""
        # Build position -> word mapping, sort, join
```

#### PubMed Ingester
- Uses E-utilities esearch (get IDs) + efetch (get records) pattern
- Parses XML with MeSH terms, journal metadata, PMC IDs
- Handles date filtering via `mindate`/`maxdate` parameters

---

## VI. Spark ETL Pipeline

### A. Pipeline Stages

```
[Raw NDJSON] → [Schema Parsing] → [Normalization] → [Deduplication] → [Relation Extraction] → [Parquet Output]
```

### B. Schema Normalization

Each source maps to a unified schema:

| Unified Field | arXiv Source | PubMed Source | OpenAlex Source |
|---------------|--------------|---------------|-----------------|
| source_id | arxiv:{arxiv_id} | pmid:{pmid} | openalex:{openalex_id} |
| title | title | title | title/display_name |
| abstract | summary | abstract | reconstructed from inverted_index |
| authors | authors[].name | authors[].name | authorships[].author.display_name |
| year | year(published) | year(pub_date) | publication_year |
| fields | categories | mesh_terms[].term | concepts[].name |
| primary_field | primary_category | mesh_terms[0].term | concepts[0].name |
| doi | doi | doi | doi |
| referenced_works | — | — | referenced_works[] |

### C. Deduplication Strategy
```python
# Keep first record per DOI, preferring OpenAlex (has citations)
window = Window.partitionBy("dedup_key").orderBy(
    F.when(F.col("source") == "openalex", 0).otherwise(1),
    F.col("_ingested_at").desc()
)
unified = unified.withColumn("row_num", F.row_number().over(window))
    .filter(F.col("row_num") == 1)
```

### D. ID Generation
- **work_id**: SHA-256 hash of source_id, truncated to 16 chars
- **author_id**: SHA-256 hash of lowercased, trimmed author name
- **venue_id**: SHA-256 hash of lowercased, trimmed venue name

### E. Output Tables

| Table | Columns | Partitioning |
|-------|---------|--------------|
| works | work_id, source_id, source, title, abstract, fields, primary_field, pub_date, year, doi, venue_id, venue_name | year |
| authors | author_id, name, affiliation | — |
| work_authors | work_id, author_id, position | — |
| venues | venue_id, name | — |
| citations | citing_work_id, cited_work_id | — |

---

## VII. Spark Analytics Pipeline

### A. Topic Modeling (LDA)

#### Pipeline Architecture
```
[Abstracts] → [RegexTokenizer] → [StopWordsRemover] → [CountVectorizer] → [IDF] → [LDA]
```

#### Configuration Parameters
| Parameter | Demo Value | Full Value | Description |
|-----------|------------|------------|-------------|
| num_topics | 10 | 50 | Number of LDA topics |
| max_iterations | 20 | 100 | LDA optimization iterations |
| vocabulary_size | 5,000 | 10,000 | Max vocabulary terms |
| min_doc_freq | 5 | 10 | Minimum document frequency |
| max_doc_freq_ratio | 0.7 | 0.6 | Maximum document frequency ratio |

#### Scientific Stopwords (80+ terms)
Critical for meaningful topic labels. Filters out generic research terms:
```python
SCIENTIFIC_STOPWORDS = {
    # Generic research terms
    'study', 'studies', 'research', 'paper', 'method', 'methods', 'results',
    'analysis', 'approach', 'model', 'data', 'dataset', 'performance',
    
    # Generic verbs (often become incorrect topic labels)
    'identified', 'evaluate', 'achieved', 'developed', 'obtained', 'performed',
    'reported', 'measured', 'compared', 'analyzed', 'investigated', 'applied',
    
    # AI/ML generic terms
    'learning', 'training', 'network', 'algorithm', 'accuracy', 'optimization',
    
    # ... 80+ total terms
}
```

#### Topic Label Generation
```python
def get_topic_terms(term_indices, term_weights):
    """Extract topic terms, filtering scientific filler words."""
    terms = []
    for idx, weight in zip(term_indices, term_weights):
        term = vocabulary[idx].lower()
        if term not in SCIENTIFIC_STOPWORDS and len(term) > 3:
            terms.append({"term": vocabulary[idx], "weight": float(weight)})
    return terms
```

### B. Graph Analytics (GraphFrames)

#### PageRank Implementation
```python
def run_graph_analytics(spark, works_df, citations_df, config):
    # Create vertices and edges
    vertices = works_df.select(F.col("work_id").alias("id"), "title", "year")
    edges = citations_df.select(
        F.col("citing_work_id").alias("src"),
        F.col("cited_work_id").alias("dst")
    )
    
    # Filter to valid vertices only
    valid_ids = vertices.select("id")
    edges = edges.join(valid_ids, edges.src == valid_ids.id, "inner")
    
    # Create GraphFrame and run PageRank
    graph = GraphFrame(vertices, edges)
    pagerank_results = graph.pageRank(resetProbability=0.15, maxIter=20)
    
    # Run Label Propagation for community detection
    communities = graph.labelPropagation(maxIter=10)
```

#### Metrics Computed
| Metric | Algorithm | Purpose |
|--------|-----------|---------|
| pagerank | PageRank (20 iterations, α=0.15) | Influence score based on citation network structure |
| citation_count | In-degree count | Raw popularity metric |
| community_id | Label Propagation | Research cluster/subfield identification |

### C. Trend Analysis

#### Growth Rate Calculation
```python
# Calculate topic share per year
topic_share = paper_count / total_papers_in_year

# Calculate growth using smoothed 2-year baseline
baseline_share = avg(prev_year_share, prev_2_year_share)
growth_rate = (current_share - baseline_share) / baseline_share

# Flag emerging topics
emerging = growth_rate > threshold  # Default: 0.3 (30% growth)
```

#### Output Tables
| Table | Description |
|-------|-------------|
| topic_trends | Topic share by year with paper counts |
| emerging_topics | Topics with growth > threshold |
| top_papers | Pre-ranked papers by PageRank (top 1000) |
| top_authors | Authors ranked by cumulative PageRank |
| yearly_stats | Paper and field counts by year |

---

## VIII. Backend API Implementation

### A. Service Architecture

```
FastAPI Application
├── Lifespan Manager (startup/shutdown)
├── CORS Middleware
├── Exception Handler
├── Routers
│   ├── /health - Health checks
│   ├── /search - Elasticsearch-powered search
│   ├── /stats - Dataset statistics
│   ├── /topics - Topic analysis
│   ├── /rankings - Paper and author rankings
│   └── /graph - Citation network exploration
└── Services
    ├── DataService (DuckDB + Parquet)
    └── ElasticsearchService (async client)
```

### B. Data Service (DuckDB-Backed)

```python
class DataService:
    def __init__(self, data_path: str):
        self.conn = duckdb.connect(":memory:")
        self._register_views()  # Register Parquet files as views
    
    def _register_views(self):
        """Register Parquet files as DuckDB views for efficient querying."""
        tables = ["works", "authors", "citations", "topics", "metrics", ...]
        for table in tables:
            self.conn.execute(f"""
                CREATE OR REPLACE VIEW {table} AS 
                SELECT * FROM parquet_scan('{path}/**/*.parquet')
            """)
```

### C. Elasticsearch Service

```python
class ElasticsearchService:
    async def create_index(self, settings: dict):
        """Create index with custom text analyzer."""
        mapping = {
            "settings": {
                "analysis": {
                    "analyzer": {
                        "text_analyzer": {
                            "type": "custom",
                            "tokenizer": "standard",
                            "filter": ["lowercase", "stop", "snowball"]
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "work_id": {"type": "keyword"},
                    "title": {"type": "text", "analyzer": "text_analyzer"},
                    "abstract": {"type": "text", "analyzer": "text_analyzer"},
                    "year": {"type": "integer"},
                    "pagerank": {"type": "float"},
                    "citation_count": {"type": "integer"},
                    # ...
                }
            }
        }
```

### D. API Endpoint Reference

#### Search Endpoints
| Method | Path | Parameters | Description |
|--------|------|------------|-------------|
| GET | /search | q, year_from, year_to, source, field, sort_by, page, page_size | Full-text search with facets |
| GET | /search/suggest | q | Autocomplete suggestions |

#### Statistics Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /stats/overview | Total works, authors, citations, topics |
| GET | /stats/yearly | Publications by year |
| GET | /stats/sources | Publications by source with percentages |
| GET | /stats/year-source | Year × source matrix for heatmap |
| GET | /stats/data-health | Year distribution diagnostics |

#### Topics Endpoints
| Method | Path | Parameters | Description |
|--------|------|------------|-------------|
| GET | /topics | — | List all topics with top terms |
| GET | /topics/trends | topic_id, year_from, year_to | Topic share over time |
| GET | /topics/emerging | limit | High-growth topics |
| GET | /topics/{id} | limit | Topic details with papers/authors |
| GET | /topics/{id}/papers | page, page_size | Paginated papers for topic |
| GET | /topics/{id}/histogram | — | Year distribution for topic |
| GET | /topics/{id}/why-trending | — | Trend explanation with factors |

#### Rankings Endpoints
| Method | Path | Parameters | Description |
|--------|------|------------|-------------|
| GET | /rankings/papers | sort_by, year_from, year_to, field, limit | Top papers by PageRank/citations |
| GET | /rankings/authors | sort_by, limit | Top authors by cumulative influence |
| GET | /rankings/comparison | limit | PageRank vs citations scatter data |
| GET | /rankings/communities | limit | Community statistics |
| GET | /rankings/hidden-gems | limit | High PageRank, low citation papers |

#### Graph Endpoints
| Method | Path | Parameters | Description |
|--------|------|------------|-------------|
| GET | /graph/neighborhood/{id} | hops, max_nodes, direction | Citation neighborhood |
| GET | /graph/community/{id} | max_nodes, sample_method | Community subgraph |
| GET | /graph/path | source_id, target_id, max_depth | Shortest citation path |
| GET | /graph/stats | — | Overall graph statistics |
| GET | /graph/sample | size, min_citations | Random sample for exploration |

### E. Search Query Construction
```python
# Multi-match with field boosting
query = {
    "multi_match": {
        "query": q,
        "fields": ["title^3", "abstract", "primary_field^2"],
        "type": "best_fields",
        "fuzziness": "AUTO"
    }
}

# Sort options
sort_options = {
    "relevance": [{"_score": "desc"}],
    "year": [{"year": "desc"}, {"_score": "desc"}],
    "citations": [{"citation_count": "desc"}, {"_score": "desc"}],
    "pagerank": [{"pagerank": "desc"}, {"_score": "desc"}]
}

# Aggregations for facets
aggs = {
    "years": {"terms": {"field": "year", "size": 20}},
    "sources": {"terms": {"field": "source", "size": 10}},
    "fields": {"terms": {"field": "primary_field.keyword", "size": 20}}
}
```

---

## IX. Frontend Application

### A. Application Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard (KPIs, charts)
│   ├── search/page.tsx    # Elasticsearch search
│   ├── topics/page.tsx    # Topic trends + drilldown
│   ├── rankings/page.tsx  # Papers/authors rankings
│   ├── graph/page.tsx     # Citation graph explorer
│   └── profile/page.tsx   # Saved items
├── components/
│   ├── charts/            # Visualization components
│   │   ├── yearly-chart.tsx
│   │   ├── sources-chart.tsx
│   │   ├── year-source-heatmap.tsx
│   │   ├── citation-distribution.tsx
│   │   ├── topic-heatmap.tsx
│   │   ├── topic-trends-chart.tsx
│   │   └── scatter-plot-chart.tsx
│   ├── ui/                # UI components
│   │   ├── card.tsx
│   │   ├── stats-card.tsx
│   │   ├── paper-modal.tsx
│   │   └── topic-modal.tsx
│   └── layout/            # Layout components
├── clientlib/
│   ├── api.ts             # API client
│   ├── utils.ts           # Utility functions
│   └── saved-items-context.tsx  # State management
└── lib/
    └── api.ts             # API endpoint definitions
```

### B. Dashboard Page Features

1. **Hero Section**: Gradient banner with project description and quick actions
2. **KPI Cards**: Total works, authors, citations, years covered, sources, topics
3. **Publications Timeline**: Interactive line chart (Nivo) showing papers over time
4. **Source Distribution**: Pie chart of arXiv/PubMed/OpenAlex proportions
5. **Year × Source Heatmap**: Matrix visualization of data distribution
6. **Citation Distribution**: Histogram of citation counts
7. **Emerging Topics**: Cards showing top growth-rate topics
8. **Quick Actions**: Navigation cards to Search, Topics, Rankings, Graph

### C. Search Page Features
- **Elasticsearch-powered**: Full-text search with fuzzy matching
- **Faceted Filters**: Year range slider, source checkboxes, field dropdown
- **Sort Options**: Relevance, year (desc), citations (desc), PageRank (desc)
- **Results Cards**: Title, authors, year, source, abstract snippet, metrics
- **Paper Modal**: Full details on click with save/bookmark option

### D. Topics Page Features
- **Topic Cards**: Visual display with label, top terms, paper count
- **Trend Charts**: 
  - Line chart: Topic share over time
  - Heatmap: Topic × year matrix
- **Topic Drilldown Modal**: Double-click to see:
  - Full term list with weights
  - Papers in topic (paginated)
  - Top authors for topic
  - Year histogram
  - "Why Trending" explanation

### E. Rankings Page Features
- **Tab Navigation**: Papers / Authors toggle
- **View Modes**: List, Grid, Card layouts
- **Paper Rankings**: 
  - Sort by PageRank or citations
  - Filter by year range, field
  - Full details on click (abstract, source, DOI)
- **Author Rankings**:
  - Total PageRank score
  - Total citations
  - Paper count
- **PageRank vs Citations Comparison**: Scatter plot with correlation stats
- **Hidden Gems**: Papers with high PageRank but low citations

### F. Graph Explorer Features
- **Force-Directed Visualization**: D3.js-based interactive graph
- **Pre-computed Layout**: Static positions for stability (no jittering)
- **Color Modes**: Community, year, citation count
- **Node Sizing**: By PageRank, citations, or uniform
- **Zoom Controls**: Vertical toolbar (zoom in/out, fit, reset)
- **Search in Graph**: Find and highlight specific papers
- **Side Panel**: Click node to see full paper details
- **Export**: Download graph as SVG
- **Labels Toggle**: Show/hide all node labels

### G. Profile/Saved Items Features
- **Saved Papers**: Persistent list with localStorage
- **Saved Authors**: Persistent list with localStorage
- **Quick Actions**: Look up in search, view citations, remove
- **Context Provider**: `SavedItemsContext` for global state

### H. State Management
```typescript
// React Query for server state
const { data: stats, isLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: api.getOverview,
})

// Context for client state (saved items)
const SavedItemsContext = createContext<SavedItemsContextType | null>(null)

// localStorage persistence
useEffect(() => {
    localStorage.setItem('savedPapers', JSON.stringify(savedPapers))
}, [savedPapers])
```

---

## X. Configuration System

### A. YAML Configuration Structure

```yaml
# configs/demo.yaml
mode: demo

global:
  max_total_records: 1000
  start_year: 2015
  end_year: 2024
  checkpoint_dir: /data/checkpoints
  raw_data_dir: /data/raw
  processed_data_dir: /data/processed
  analytics_dir: /data/analytics

arxiv:
  enabled: true
  max_records: 200
  categories: [cs.AI, cs.LG, cs.CL]
  year_distribution:
    enabled: true
    min_per_year: 15
  rate_limit:
    requests_per_second: 0.33
    retry_attempts: 3
    retry_backoff_factor: 2
  batch_size: 100

pubmed:
  enabled: true
  max_records: 200
  search_terms: ["machine learning", "deep learning"]
  rate_limit:
    requests_per_second: 3
  batch_size: 100

openalex:
  enabled: true
  max_records: 600
  filters:
    concepts: [C41008148, C119857082]  # AI, ML concept IDs
    from_publication_date: "2015-01-01"
    to_publication_date: "2024-12-31"
  rate_limit:
    requests_per_second: 10
  email: "scholarly-graph@nyu.edu"

spark:
  app_name: "ScholarlyKG-ETL-Demo"
  master: "spark://spark-master:7077"
  driver_memory: "2g"
  executor_memory: "2g"
  shuffle_partitions: 10

analytics:
  topics:
    enabled: true
    num_topics: 10
    max_iterations: 20
    vocabulary_size: 5000
  graph:
    enabled: true
    pagerank:
      max_iterations: 10
      reset_probability: 0.15
    community_detection:
      algorithm: label_propagation
      max_iterations: 5
  trends:
    enabled: true
    emerging_threshold: 1.5

elasticsearch:
  host: elasticsearch
  port: 9200
  index_name: scholarly_works
  index_settings:
    number_of_shards: 1
    number_of_replicas: 0

logging:
  level: INFO
  format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
```

### B. Demo vs Full Configuration

| Parameter | Demo | Full |
|-----------|------|------|
| max_total_records | 1,000 | 100,000+ |
| num_topics | 10 | 50 |
| max_iterations (LDA) | 20 | 100 |
| shuffle_partitions | 10 | 200 |
| executor_memory | 2g | 8g |
| ES shards | 1 | 5 |

---

## XI. Docker Compose Deployment

### A. Services Overview

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| hdfs-namenode | bde2020/hadoop-namenode | 9870, 9000 | HDFS metadata management |
| hdfs-datanode | bde2020/hadoop-datanode | 9864 | HDFS data storage |
| spark-master | scholarly-spark-master | 8080, 7077 | Spark job scheduling |
| spark-worker-1 | scholarly-spark-worker | 8081 | Spark task execution |
| spark-worker-2 | scholarly-spark-worker | 8082 | Spark task execution (full mode) |
| elasticsearch | elasticsearch:8.11.0 | 9200, 9300 | Full-text search |
| backend | FastAPI | 8000 | REST API |
| frontend | Next.js | 3000 | Web UI |
| ingestion | Python | — | On-demand ingestion jobs |

### B. Network Configuration
```yaml
networks:
  scholarly-net:
    driver: bridge

# All services connect to scholarly-net for internal communication
# External access via published ports
```

### C. Volume Mounts
```yaml
volumes:
  hdfs_namenode:      # HDFS name data
  hdfs_datanode:      # HDFS block data
  elasticsearch_data: # ES indices
  spark_logs:         # Spark application logs
  spark_worker_1:     # Worker scratch space
  spark_worker_2:     # Worker scratch space

# Bind mounts for code and data
- ../data:/data           # Shared data directory
- ../configs:/config:ro   # Configuration files (read-only)
- ../pipelines/spark:/opt/spark-jobs  # Spark job code
```

### D. Health Checks
All services include health checks for dependency management:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:9870"]
  interval: 30s
  timeout: 10s
  retries: 5
```

---

## XII. Makefile Operations

### A. Infrastructure Commands
```bash
make up              # Start core services
make up-full         # Start all services including extra workers
make down            # Stop all containers
make restart         # Restart all containers
make logs            # View all logs (or CONTAINER=name for specific)
make status          # Check service status
make wait-healthy    # Wait for all services to be healthy
```

### B. Pipeline Commands
```bash
make init-hdfs       # Create HDFS directory structure
make ingest          # Run ingestion (CONFIG=demo|full)
make ingest-arxiv    # Run arXiv ingestion only
make ingest-pubmed   # Run PubMed ingestion only
make ingest-openalex # Run OpenAlex ingestion only
make etl             # Run Spark ETL pipeline
make analytics       # Run Spark analytics pipeline
make index           # Index data to Elasticsearch
make demo            # Run complete demo pipeline (up → ingest → etl → analytics → index)
make full-pipeline   # Run complete full pipeline
```

### C. Development Commands
```bash
make spark-shell     # Interactive Spark shell (Scala)
make pyspark-shell   # Interactive PySpark shell
make hdfs-shell      # HDFS CLI access
make es-shell        # Elasticsearch status
make backend-shell   # Backend container bash
make frontend-shell  # Frontend container shell
```

### D. Maintenance Commands
```bash
make build-images    # Build all Docker images
make clean           # Stop containers, remove volumes, clear data
make clean-data      # Clear data only (keep containers)
make prune           # Deep clean including Docker system prune
make test            # Run all tests
make lint            # Run linters
make format          # Format code
```

---

## XIII. Data Quality & Observability

### A. Data Quality Measures

1. **Year-Balanced Sampling**: Prevents temporal skew from API ordering
2. **DOI-Based Deduplication**: Prefers OpenAlex records (richer metadata)
3. **Scientific Stopword Filtering**: 80+ terms excluded from topic labels
4. **Min Document Frequency**: Filters rare terms from vocabulary
5. **Valid Edge Filtering**: Citation edges only include existing nodes

### B. Observability Endpoints

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Frontend dashboard |
| http://localhost:8000/docs | API documentation (Swagger) |
| http://localhost:8000/health | API health check |
| http://localhost:8080 | Spark Master UI |
| http://localhost:9870 | HDFS NameNode UI |
| http://localhost:9200 | Elasticsearch API |

### C. Health Diagnostics
```bash
# Check data balance
curl localhost:8000/stats/data-health | jq '.diagnosis'

# Expected: "Data looks balanced - year distribution is reasonable"
```

---

## XIV. Limitations & Future Work

### A. Current Limitations
1. **Scale**: Demo configuration limited to ~1K papers; production would need multi-node Spark cluster
2. **Real-time Updates**: Batch-oriented pipeline; no streaming/CDC support
3. **Authentication**: No user authentication or authorization
4. **Citation Completeness**: Only OpenAlex provides reference lists; arXiv/PubMed citations require external linking

### B. Future Enhancements
1. **Transformer Embeddings**: Replace TF-IDF with BERT/SciBERT for semantic similarity
2. **Citation Forecasting**: Predict future citations using graph neural networks
3. **Author Disambiguation**: Entity resolution using ORCID, affiliation matching
4. **Incremental ETL**: Delta processing for efficient updates
5. **Multi-Tenant Access**: Role-based access control, workspace isolation
6. **Recommendation Engine**: Paper suggestions based on reading history

---

## Appendix A — Repository Structure

```
big-data/
├── apps/
│   ├── api/                        # FastAPI backend
│   │   ├── main.py                 # Application entry point
│   │   ├── config.py               # Settings management
│   │   ├── routers/
│   │   │   ├── search.py           # Search endpoints
│   │   │   ├── stats.py            # Statistics endpoints
│   │   │   ├── topics.py           # Topics endpoints
│   │   │   ├── rankings.py         # Rankings endpoints
│   │   │   ├── graph.py            # Graph endpoints
│   │   │   └── health.py           # Health checks
│   │   ├── services/
│   │   │   ├── data_service.py     # DuckDB + Parquet queries
│   │   │   └── elasticsearch_service.py  # ES client
│   │   ├── scripts/
│   │   │   └── index_elasticsearch.py    # Indexing script
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── web/                        # Next.js frontend
│       ├── app/                    # App Router pages
│       │   ├── page.tsx            # Dashboard
│       │   ├── search/page.tsx     # Search
│       │   ├── topics/page.tsx     # Topics
│       │   ├── rankings/page.tsx   # Rankings
│       │   ├── graph/page.tsx      # Graph explorer
│       │   └── profile/page.tsx    # Saved items
│       ├── components/
│       │   ├── charts/             # Visualization components
│       │   ├── ui/                 # UI components
│       │   └── layout/             # Layout components
│       ├── clientlib/
│       │   ├── api.ts              # API client
│       │   ├── utils.ts            # Utilities
│       │   └── saved-items-context.tsx
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── pipelines/
│   ├── ingest/                     # Python ingestion
│   │   ├── ingest/
│   │   │   ├── main.py             # Orchestrator
│   │   │   ├── sources/
│   │   │   │   ├── arxiv.py        # arXiv ingester
│   │   │   │   ├── pubmed.py       # PubMed ingester
│   │   │   │   └── openalex.py     # OpenAlex ingester
│   │   │   └── utils/
│   │   │       ├── checkpoint.py   # Checkpoint manager
│   │   │       ├── storage.py      # Storage manager
│   │   │       └── rate_limiter.py # Rate limiting
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── spark/                      # PySpark jobs
│       ├── etl/
│       │   └── main.py             # ETL pipeline
│       ├── analytics/
│       │   └── main.py             # Analytics pipeline
│       └── requirements.txt
├── infra/
│   ├── docker-compose.yml          # Service orchestration
│   ├── hdfs/
│   │   ├── core-site.xml
│   │   └── hdfs-site.xml
│   └── spark/
│       ├── Dockerfile
│       └── spark-defaults.conf
├── configs/
│   ├── demo.yaml                   # Demo configuration
│   └── full.yaml                   # Full configuration
├── docs/
│   ├── ARCHITECTURE.md             # Architecture documentation
│   ├── REPORT.md                   # Business report
│   └── SLIDES_OUTLINE.md           # Presentation outline
├── scripts/
│   └── rebuild_data.sh             # Data regeneration script
├── Makefile                        # Build and run commands
├── README.md                       # Project overview
├── RUNBOOK.md                      # Operational guide
├── CHANGELOG.md                    # Version history
└── LICENSE                         # MIT License
```

---

## Appendix B — Key Algorithms

### PageRank Formula
```
PR(p) = (1-d)/N + d * Σ(PR(q)/L(q)) for all q linking to p

Where:
- d = damping factor (0.85)
- N = total number of pages
- L(q) = number of outbound links from page q
```

### LDA Topic Distribution
```
P(word|topic) ∝ count(word, topic) + β
P(topic|document) ∝ count(topic, document) + α

Where:
- α = document-topic prior (Dirichlet)
- β = topic-word prior (Dirichlet)
```

### Growth Rate Calculation
```
growth_rate = (current_share - baseline_share) / baseline_share
baseline_share = avg(prev_year_share, prev_2_year_share)
emerging = growth_rate > threshold (default: 30%)
```

---

## Appendix C — API Response Examples

### Search Response
```json
{
  "query": "transformer attention",
  "total": 245,
  "page": 1,
  "page_size": 20,
  "results": [
    {
      "work_id": "a1b2c3d4e5f6g7h8",
      "title": "Attention Is All You Need",
      "abstract": "The dominant sequence transduction models...",
      "year": 2017,
      "source": "arxiv",
      "primary_field": "cs.CL",
      "pagerank": 0.0042,
      "citation_count": 15234,
      "score": 12.45
    }
  ],
  "facets": {
    "years": [{"value": 2023, "count": 89}],
    "sources": [{"value": "arxiv", "count": 156}],
    "fields": [{"value": "cs.LG", "count": 123}]
  }
}
```

### Topic Response
```json
{
  "topic_id": 3,
  "label": "Transformer",
  "top_terms": [
    {"term": "transformer", "weight": 0.089},
    {"term": "attention", "weight": 0.076},
    {"term": "encoder", "weight": 0.054}
  ],
  "paper_count": 127
}
```

---

*Document prepared for IEEE report format conversion. All code snippets, configurations, and architectural details reflect the actual implementation in the ScholarGraph repository.*
