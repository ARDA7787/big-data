# Architecture Documentation
## Scalable Scholarly Knowledge Graph

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Flow](#2-data-flow)
3. [Component Details](#3-component-details)
4. [Data Model](#4-data-model)
5. [Scalability Design](#5-scalability-design)
6. [Deployment Architecture](#6-deployment-architecture)
7. [API Reference](#7-api-reference)
8. [Configuration](#8-configuration)

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
│  │Rate Limiter │  │ Checkpoint  │  │  Storage    │  │  HTTP Client│        │
│  │(Token Bucket)│  │  Manager    │  │  Manager    │  │(Retry/Backoff│        │
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
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │   Home   │ │  Search  │ │  Topics  │ │ Rankings │ │  Graph   │          │
│  │Dashboard │ │   Page   │ │  Trends  │ │   Page   │ │ Explorer │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
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
| Charts | Nivo | 0.83+ | Visualizations |
| Orchestration | Docker Compose | 2.x | Container management |

---

## 2. Data Flow

### 2.1 Ingestion Flow

```
1. FETCH
   API Request → Rate Limiter → HTTP Client → Response
                     ↓
   [Token Bucket: respects API rate limits]

2. PARSE
   Response → Parser (XML/JSON) → Structured Records
                     ↓
   [arXiv: XML, PubMed: XML, OpenAlex: JSON]

3. STORE
   Records → Storage Manager → NDJSON + Metadata → HDFS
                     ↓
   [Partitioned: source/ingest_date=YYYY-MM-DD/batch_*.ndjson.gz]

4. CHECKPOINT
   Progress → Checkpoint Manager → JSON file
                     ↓
   [Enables resume on failure]
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
   [Distributed across Spark workers]

2. GRAPH CONSTRUCTION
   works → vertices, citations → edges → GraphFrame
                     ↓
   [In-memory graph representation]

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

6. WRITE OUTPUTS
   All results → Parquet + Aggregates
                     ↓
   [Pre-computed for fast serving]
```

---

## 3. Component Details

### 3.1 Ingestion Components

#### Rate Limiter (`rate_limiter.py`)
```python
class RateLimiter:
    """Token bucket algorithm for API rate limiting."""
    
    def __init__(self, requests_per_second: float, burst_size: int = 1):
        self.rps = requests_per_second
        self.tokens = burst_size
        self.last_update = time.monotonic()
    
    async def acquire(self) -> float:
        """Wait for and consume a token. Returns wait time."""
        # Token replenishment + consumption logic
```

#### Checkpoint Manager (`checkpoint.py`)
```python
class CheckpointManager:
    """Persistent state for resumable ingestion."""
    
    def save_checkpoint(self, source, cursor, records_processed, metadata):
        """Atomically save progress to JSON file."""
    
    def get_progress(self, source) -> tuple[int, str]:
        """Get (records_processed, cursor) for resume."""
```

#### Storage Manager (`storage.py`)
```python
class StorageManager:
    """NDJSON storage with partitioning."""
    
    def write_records(self, source, records, batch_id):
        """Write records to partitioned NDJSON (gzipped)."""
        # Path: {base}/{source}/ingest_date={date}/{batch_id}.ndjson.gz
```

### 3.2 Spark Jobs

#### ETL Job (`etl/main.py`)
- **Input**: HDFS raw zone (NDJSON)
- **Output**: HDFS processed zone (Parquet)
- **Tables**: works, authors, work_authors, venues, citations

#### Analytics Job (`analytics/main.py`)
- **Input**: HDFS processed zone (Parquet)
- **Output**: HDFS analytics zone (Parquet)
- **Outputs**: topics, work_topics, metrics, trends, aggregates

### 3.3 API Components

#### Data Service (`data_service.py`)
- Uses **DuckDB** for efficient Parquet querying
- Registers Parquet files as virtual tables
- Executes SQL queries without loading all data

#### Elasticsearch Service (`elasticsearch_service.py`)
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
    primary_field   STRING,      -- Main category/concept
    fields          ARRAY<STRING>,
    doi             STRING,
    venue_id        STRING,
    venue_name      STRING
)
PARTITIONED BY (year);

-- Authors
CREATE TABLE authors (
    author_id       STRING,      -- SHA256 hash of name
    name            STRING,
    affiliation     STRING
);

-- Work-Author relationships
CREATE TABLE work_authors (
    work_id         STRING,
    author_id       STRING,
    position        INT          -- 0 = first author
);

-- Citation edges
CREATE TABLE citations (
    citing_work_id  STRING,
    cited_work_id   STRING
);

-- Topics from LDA
CREATE TABLE topics (
    topic_id        INT,
    label           STRING,      -- Top term as label
    top_terms       ARRAY<STRUCT<term: STRING, weight: FLOAT>>
);

-- Work-Topic assignments
CREATE TABLE work_topics (
    work_id         STRING,
    topic_id        INT,
    topic_score     FLOAT
);

-- Computed metrics
CREATE TABLE metrics (
    work_id         STRING,
    pagerank        FLOAT,
    citation_count  INT,
    community_id    BIGINT
);
```

### 4.2 Analytics Aggregates

```sql
-- Topic trends over time
CREATE TABLE topic_trends (
    year            INT,
    topic_id        INT,
    label           STRING,
    paper_count     INT,
    total_papers    INT,
    topic_share     FLOAT
);

-- Emerging topics
CREATE TABLE emerging_topics (
    topic_id        INT,
    label           STRING,
    paper_count     INT,
    topic_share     FLOAT,
    growth_rate     FLOAT
);

-- Pre-computed rankings
CREATE TABLE top_papers (
    work_id         STRING,
    title           STRING,
    year            INT,
    primary_field   STRING,
    pagerank        FLOAT,
    citation_count  INT,
    community_id    BIGINT
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

### 5.2 Horizontal Scaling

```
                    ┌─────────────────┐
                    │  Spark Master   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Spark Worker 1 │ │  Spark Worker 2 │ │  Spark Worker N │
│  2 cores, 4GB   │ │  2 cores, 4GB   │ │  2 cores, 4GB   │
└─────────────────┘ └─────────────────┘ └─────────────────┘

To scale: Add workers via docker-compose scale or K8s replicas
```

### 5.3 Performance Optimizations

1. **Broadcast joins**: Small dimension tables (topics, venues)
2. **Partition pruning**: Year-based filtering
3. **Column projection**: Select only needed columns
4. **Predicate pushdown**: Parquet filter optimization
5. **Caching**: Hot DataFrames cached in memory

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
  spark-worker-2:   # Task execution (optional)

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
┌─────────────────────────────────────────────────────────────────┐
│                    scholarly-net (Docker Bridge)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐                         │
│  │  namenode    │◄────►│  datanode    │                         │
│  │  :9000/:9870 │      │  :9864       │                         │
│  └──────────────┘      └──────────────┘                         │
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐                         │
│  │ spark-master │◄────►│spark-worker-1│                         │
│  │  :7077/:8080 │      │  :8081       │                         │
│  └──────────────┘      └──────────────┘                         │
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │elasticsearch │◄────►│   backend    │◄────►│  frontend    │  │
│  │  :9200/:9300 │      │    :8000     │      │    :3000     │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

External Access:
  - Frontend: http://localhost:3000
  - API: http://localhost:8000
  - Spark UI: http://localhost:8080
  - HDFS UI: http://localhost:9870
  - Elasticsearch: http://localhost:9200
```

---

## 7. API Reference

### 7.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /search | Full-text search |
| GET | /stats/overview | Dataset statistics |
| GET | /stats/yearly | Publications by year |
| GET | /stats/sources | Publications by source |
| GET | /topics | List all topics |
| GET | /topics/trends | Topic share over time |
| GET | /topics/emerging | High-growth topics |
| GET | /topics/{id} | Topic details + papers |
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
| page | int | Page number (default: 1) |
| page_size | int | Results per page (default: 20) |

---

## 8. Configuration

### 8.1 Demo Configuration

```yaml
mode: demo
global:
  max_total_records: 1000
  start_year: 2022

arxiv:
  enabled: true
  max_records: 400
  categories: [cs.AI, cs.LG, cs.CL]

pubmed:
  enabled: true
  max_records: 300
  search_terms: ["machine learning", "deep learning"]

openalex:
  enabled: true
  max_records: 300
  filters:
    concepts: [C41008148, C119857082]  # AI, ML

analytics:
  topics:
    num_topics: 10
    max_iterations: 20
  graph:
    pagerank:
      max_iterations: 10
```

### 8.2 Full Configuration

```yaml
mode: full
global:
  max_total_records: 1000000

arxiv:
  max_records: 500000
  categories: [cs.*, stat.ML, q-bio.NC]

pubmed:
  max_records: 300000
  use_api_key: true

openalex:
  max_records: 200000
  filters:
    cited_by_count_min: 5

analytics:
  topics:
    num_topics: 50
    max_iterations: 100
  graph:
    pagerank:
      max_iterations: 30
```

---

## Appendix: Troubleshooting

### Common Issues

1. **HDFS Safe Mode**
   ```bash
   docker exec hdfs-namenode hdfs dfsadmin -safemode leave
   ```

2. **Elasticsearch Index Missing**
   ```bash
   make index
   ```

3. **Spark Job Failure**
   - Check: `make logs CONTAINER=spark-master`
   - Ensure workers are connected: http://localhost:8080

4. **Frontend API Connection**
   - Verify backend is healthy: `curl localhost:8000/health`
   - Check CORS settings in `main.py`

### Health Checks

```bash
# All services
make status

# Individual checks
curl localhost:8000/health        # API
curl localhost:9200/_cluster/health  # Elasticsearch
docker exec hdfs-namenode hdfs dfsadmin -report | head  # HDFS
```

