# Architecture Documentation
## ScholarGraph - Scalable Scholarly Knowledge Graph

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Flow](#2-data-flow)
3. [Component Details](#3-component-details)
4. [Data Model](#4-data-model)
5. [Scalability Design](#5-scalability-design)
6. [Deployment Architecture](#6-deployment-architecture)
7. [API Reference](#7-api-reference)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Configuration](#9-configuration)

---

## 1. System Overview

### 1.1 Architecture Diagram

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
│                         INGESTION LAYER                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │Rate Limiter │  │Year-Balanced│  │  Storage    │  │  HTTP Client│        │
│  │(Token Bucket)│  │  Sampling   │  │  Manager    │  │(Retry/Backoff│       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STORAGE LAYER (HDFS)                                 │
│  ┌──────────────────────────────┬──────────────────────────────────────┐    │
│  │         RAW ZONE             │         PROCESSED ZONE               │    │
│  │  /data/raw/{source}/         │  /data/processed/{table}/            │    │
│  │    ingest_date=YYYY-MM-DD/   │    year={YYYY}/                      │    │
│  │      *.ndjson.gz             │      *.parquet                       │    │
│  └──────────────────────────────┴──────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROCESSING LAYER (Spark)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         ETL PIPELINE                                 │    │
│  │  [Read Raw JSON] → [Parse] → [Normalize] → [Dedupe] → [Write Parquet]│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      ANALYTICS PIPELINE                              │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │    │
│  │  │Topic Model│  │ PageRank  │  │ Community │  │  Trends   │        │    │
│  │  │(MLlib LDA)│  │(GraphFrame)│  │(Label Prop)│  │ Analysis  │        │    │
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
│  │  - title (text)       │  │  │  └──────────┘ └──────────┘ └──────────┘   │
│  │  - abstract (text)    │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  - year (int)         │  │  │  │ Rankings │ │  Graph   │ │  Health  │   │
│  │  - pagerank (float)   │  │  │  │  Router  │ │  Router  │ │  Router  │   │
│  │  - citations (int)    │  │  │  └──────────┘ └──────────┘ └──────────┘   │
│  └───────────────────────┘  │  │                                            │
└─────────────────────────────┘  └──────────────────┬─────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER (Next.js)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  │   Home   │ │  Search  │ │  Topics  │ │ Rankings │ │  Graph   │ │Profile│ │
│  │Dashboard │ │   Page   │ │  Trends  │ │   Page   │ │ Explorer │ │ Saved │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Storage | HDFS | 3.2.1 | Distributed file storage |
| Format | Parquet | - | Columnar storage format |
| Processing | Apache Spark | 3.5.x | Distributed compute |
| Graph | GraphFrames | 0.8.3 | Graph algorithms |
| ML | Spark MLlib | 3.5.x | Topic modeling |
| Search | Elasticsearch | 8.11.x | Full-text search |
| Backend | FastAPI | 0.100+ | REST API |
| Frontend | Next.js | 14.x | React framework |
| UI | Tailwind CSS | 3.x | Styling |
| Charts | Nivo + D3 | 0.83+ | Visualizations |
| Animations | Framer Motion | 10.x | UI animations |
| Orchestration | Docker Compose | 2.x | Container management |

---

## 2. Data Flow

### 2.1 Ingestion Flow (Year-Balanced)

```
1. CONFIGURE YEAR BINS
   Config → Year Ranges (2015-2017, 2018-2020, 2021-2022, 2023-2024)
                     ↓
   [Ensures balanced distribution across time periods]

2. FETCH PER BIN
   For each year bin:
     API Request → Rate Limiter → HTTP Client → Response
                       ↓
     [Fetches targeted records per bin]

3. PARSE
   Response → Parser (XML/JSON) → Structured Records
                     ↓
   [arXiv: XML, PubMed: XML, OpenAlex: JSON]

4. STORE
   Records → Storage Manager → NDJSON + Metadata → HDFS
                     ↓
   [Partitioned: source/ingest_date=YYYY-MM-DD/batch_*.ndjson.gz]
```

### 2.2 ETL Flow

```
1. READ RAW
   HDFS Raw Zone → Spark DataFrame (with schema inference)
                     ↓
   [Distributed read across workers]

2. PARSE & NORMALIZE
   Source-specific columns → Unified schema
                     ↓
   [arxiv_id → source_id, pmid → source_id, etc.]

3. DEDUPLICATE
   DOI-based matching → Keep OpenAlex preference (has citations)
                     ↓
   [Window function + row_number]

4. BUILD RELATIONS
   works → authors, venues, citations
                     ↓
   [Explode arrays, hash-based ID generation]

5. WRITE PARQUET
   DataFrames → Partitioned Parquet (year partition)
                     ↓
   [Snappy compression, partition pruning enabled]
```

### 2.3 Analytics Flow

```
1. TOPIC MODELING
   abstracts → TF-IDF → LDA → topics + work_topics
                     ↓
   [80+ scientific stopwords filtered]

2. GRAPH CONSTRUCTION
   works → vertices, citations → edges → GraphFrame
                     ↓
   [Filtered to valid edges only]

3. PAGERANK
   GraphFrame → pagerank() → influence scores
                     ↓
   [Iterative algorithm, 20 iterations]

4. COMMUNITY DETECTION
   GraphFrame → labelPropagation() → community IDs
                     ↓
   [Near-linear time algorithm]

5. TREND ANALYSIS
   work_topics + years → aggregations → trends + emerging
                     ↓
   [Window functions for growth rate]
```

---

## 3. Component Details

### 3.1 Ingestion Components

#### Year-Balanced Fetcher
```python
def _get_year_ranges(self):
    """Generate year bins for balanced fetching."""
    return [
        (2015, 2017),  # Older papers
        (2018, 2020),  # Mid-range
        (2021, 2022),  # Recent
        (2023, 2024),  # Latest
    ]
```

#### Rate Limiter (`rate_limiter.py`)
```python
class RateLimiter:
    """Token bucket algorithm for API rate limiting."""
    async def acquire(self) -> float:
        """Wait for and consume a token."""
```

### 3.2 Spark Analytics

#### Topic Modeling with Improved Stopwords
```python
SCIENTIFIC_STOPWORDS = {
    'identified', 'using', 'method', 'results', 'study', 'paper',
    'approach', 'based', 'novel', 'proposed', 'demonstrate', 'evaluate',
    'analysis', 'framework', 'performance', 'data', 'model', 'models',
    # ... 80+ total terms
}
```

### 3.3 API Services

#### Data Service (`data_service.py`)
- Uses **DuckDB** for efficient Parquet querying
- Registers Parquet files as virtual tables
- Dynamic stat computation (no stale pre-computed tables)
- Citation neighborhood with valid edge filtering

#### Elasticsearch Service
- Async client for non-blocking I/O
- Bulk indexing for performance
- Custom text analyzer for academic content

---

## 4. Data Model

### 4.1 Core Tables

```sql
-- Works (papers/articles)
CREATE TABLE works (
    work_id         STRING,      -- SHA256 hash of source_id
    source_id       STRING,      -- Original ID (arxiv:2301.00001)
    source          STRING,      -- arxiv, pubmed, openalex
    title           STRING,
    abstract        STRING,
    year            INT,
    pub_date        DATE,
    primary_field   STRING,
    fields          ARRAY<STRING>,
    doi             STRING,
    venue_id        STRING,
    venue_name      STRING
)
PARTITIONED BY (year);

-- Topics from LDA (improved labels)
CREATE TABLE topics (
    topic_id        INT,
    label           STRING,      -- Filtered, meaningful label
    top_terms       ARRAY<STRUCT<term: STRING, weight: FLOAT>>
);

-- Computed metrics
CREATE TABLE metrics (
    work_id         STRING,
    pagerank        FLOAT,
    citation_count  INT,
    community_id    BIGINT       -- Community from Label Propagation
);
```

---

## 5. Scalability Design

### 5.1 Partitioning Strategy

| Layer | Partition Key | Benefit |
|-------|---------------|---------|
| Raw Zone | source, ingest_date | Incremental ingestion |
| Processed | year | Time-range query pruning |
| Search | - (auto-sharded) | Parallel search |

### 5.2 Year-Balanced Ingestion

Prevents data skew by fetching proportionally from year bins:
- 2015-2017: ~25% of records
- 2018-2020: ~25% of records
- 2021-2022: ~25% of records
- 2023-2024: ~25% of records

---

## 6. Deployment Architecture

### 6.1 Docker Compose Services

```yaml
services:
  # Storage
  hdfs-namenode:    # Metadata management
  hdfs-datanode:    # Data storage

  # Compute
  spark-master:     # Job scheduling
  spark-worker-1:   # Task execution

  # Search
  elasticsearch:    # Full-text search

  # Application
  backend:          # FastAPI service
  frontend:         # Next.js app

  # Ingestion (on-demand)
  ingestion:        # Python ingestion jobs
```

### 6.2 Network Architecture

```
External Access:
  - Frontend: http://localhost:3000
  - API: http://localhost:8000
  - Spark UI: http://localhost:8080
  - HDFS UI: http://localhost:9870
  - Elasticsearch: http://localhost:9200
```

---

## 7. API Reference

### 7.1 Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /search | Full-text search |
| GET | /stats/overview | Dataset statistics |
| GET | /stats/yearly | Publications by year |
| GET | /stats/sources | Publications by source |
| GET | /stats/data-health | Data balance diagnostics |
| GET | /topics | List all topics |
| GET | /topics/trends | Topic share over time |
| GET | /topics/emerging | High-growth topics |
| GET | /topics/{id} | Topic details + papers |
| GET | /topics/{id}/papers | Papers for a topic |
| GET | /topics/{id}/year-histogram | Year distribution |
| GET | /topics/{id}/why-trending | Trend explanation |
| GET | /rankings/papers | Top papers by influence |
| GET | /rankings/authors | Top authors |
| GET | /rankings/comparison | PageRank vs citations |
| GET | /graph/neighborhood/{id} | Citation neighborhood |
| GET | /graph/stats | Graph statistics |

### 7.2 Search Parameters

```
GET /search?q=transformer&year_from=2020&source=arxiv&sort_by=pagerank
```

| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query (required) |
| year_from | int | Start year filter |
| year_to | int | End year filter |
| source | string | Source filter |
| field | string | Field/category filter |
| sort_by | string | relevance, year, citations, pagerank |

---

## 8. Frontend Architecture

### 8.1 Pages Structure

```
app/
├── page.tsx              # Dashboard with KPIs and charts
├── search/page.tsx       # Elasticsearch search with filters
├── topics/page.tsx       # Topic trends (line, heatmap) + drilldown modal
├── rankings/page.tsx     # Papers/authors by PageRank with modal
├── graph/page.tsx        # Force graph + List view
└── profile/page.tsx      # Saved papers and authors
```

### 8.2 Key Components

| Component | Description |
|-----------|-------------|
| `ForceGraph` | D3-based citation network with pre-computed layout |
| `TopicModal` | Drilldown modal with papers, authors, histogram |
| `PaperModal` | Paper details with save/lookup actions |
| `TopicHeatmap` | Nivo heatmap for topic × year matrix |
| `SavedItemsContext` | React context for localStorage persistence |

### 8.3 State Management

- **React Query**: Server state caching and refetching
- **Context API**: Saved items (papers, authors)
- **localStorage**: Persistence of user preferences and saved items

---

## 9. Configuration

### 9.1 Demo Configuration (`demo.yaml`)

```yaml
mode: demo
global:
  max_total_records: 1000
  start_year: 2015
  end_year: 2024

arxiv:
  enabled: true
  max_records: 200
  year_distribution:
    enabled: true
  categories: [cs.AI, cs.LG, cs.CL, cs.CV]

pubmed:
  enabled: true
  max_records: 200

openalex:
  enabled: true
  max_records: 600

analytics:
  topics:
    num_topics: 10
    stopwords: expanded  # 80+ scientific terms
```

---

## Appendix: Troubleshooting

### Common Issues

1. **Data Imbalance (too many 2025 papers)**
   - Enable year-balanced ingestion in config
   - Re-run ingestion with `year_distribution.enabled: true`

2. **Topic Labels Generic ("Identified")**
   - Verify expanded stopwords in analytics config
   - Re-run analytics pipeline

3. **Citation Graph "Node Not Found"**
   - Fixed in `data_service.py`: edges filtered to valid nodes only

4. **Rankings Modal Empty**
   - Fixed: `get_top_papers` now includes abstract, source, doi

### Data Health Check

```bash
curl localhost:8000/stats/data-health | jq '.diagnosis'
```

Expected: "Data looks balanced - year distribution is reasonable"
