# Scalable Scholarly Knowledge Graph

> Mining Research Papers & Citation Networks at Scale

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Spark 3.5](https://img.shields.io/badge/spark-3.5-orange.svg)](https://spark.apache.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A unified scholarly knowledge graph platform that ingests data from arXiv, PubMed, and OpenAlex, models it as a citation network, runs scalable analytics, and exposes insights via a polished web dashboard.

**Team**: Aarya Shah, Aryan Donde  
**Course**: CS-GY 6513 Big Data (NYU Tandon)

---

## 🎯 Project Overview

This project demonstrates end-to-end big data engineering by building a scholarly knowledge graph from multiple open data sources. We:

1. **Ingest** millions of research papers from arXiv, PubMed, and OpenAlex APIs
2. **Model** data as a unified knowledge graph (papers, authors, venues, citations)
3. **Analyze** at scale using Spark, GraphFrames, and MLlib
4. **Serve** results via Elasticsearch and a FastAPI backend
5. **Visualize** insights in a production-quality Next.js dashboard

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES (APIs)                             │
├─────────────────┬─────────────────┬─────────────────────────────────────┤
│     arXiv       │     PubMed      │            OpenAlex                 │
│  (CS/Physics)   │   (Biomedical)  │     (Works + Citations)             │
└────────┬────────┴────────┬────────┴──────────────┬──────────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    INGESTION LAYER (Python)                             │
│  • Rate limiting & exponential backoff                                  │
│  • Checkpointing & resumability                                         │
│  • NDJSON output to HDFS raw zone                                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER (HDFS)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  RAW ZONE                      │  PROCESSED ZONE                        │
│  /data/raw/{source}/{date}/    │  /data/processed/{table}/year={YYYY}/  │
│  • NDJSON files                │  • Parquet files (partitioned)         │
│  • Immutable                   │  • Columnar, compressed                │
└────────────────────────────────┴────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROCESSING LAYER (Spark)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  ETL Jobs              │  Analytics Jobs                                │
│  • Schema normalization│  • Topic modeling (TF-IDF + LDA)              │
│  • Deduplication       │  • PageRank (GraphFrames)                     │
│  • ID resolution       │  • Community detection                        │
│  • Citation linking    │  • Trend analysis                             │
└────────────────────────┴────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVING LAYER                                        │
├─────────────────────────────────┬───────────────────────────────────────┤
│  Elasticsearch                  │  FastAPI Backend                      │
│  • Full-text search             │  • REST API                           │
│  • Faceted filtering            │  • Parquet aggregates                 │
│  • Influence metrics            │  • Graph queries                      │
└─────────────────────────────────┴───────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (Next.js)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Dashboard │ Search │ Topics │ Rankings │ Graph Explorer │ Pipeline     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Why This is Big Data

This architecture is designed for **scale beyond a single machine**:

| Component | Why It's Big Data |
|-----------|-------------------|
| **HDFS** | Distributed file system with replication; scales horizontally |
| **Parquet** | Columnar format with predicate pushdown; enables partition pruning |
| **Spark** | Distributed compute engine; processes data across worker nodes |
| **GraphFrames** | Distributed graph processing; PageRank on billion-edge graphs |
| **Elasticsearch** | Distributed search with sharding; handles millions of documents |

### Partitioning Strategy

- **Raw data**: Partitioned by `source/ingest_date` for incremental ingestion
- **Processed data**: Partitioned by `year` for time-range queries
- **Analytics outputs**: Pre-aggregated for dashboard performance

### Scalability Proof Points

1. **Horizontal scaling**: Add Spark workers to increase processing capacity
2. **Partition pruning**: Year-based partitioning enables efficient time filtering
3. **Distributed joins**: Citation graph built via Spark broadcast + shuffle joins
4. **Search sharding**: Elasticsearch auto-distributes across nodes

---

## 📁 Repository Structure

```
/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # App router pages
│   │   ├── components/         # React components
│   │   └── lib/                # Utilities
│   └── api/                    # FastAPI backend
│       ├── routers/            # API routes
│       ├── services/           # Business logic
│       └── models/             # Pydantic models
├── pipelines/
│   ├── ingest/                 # Python ingestion jobs
│   │   ├── sources/            # API clients (arXiv, PubMed, OpenAlex)
│   │   └── utils/              # Shared utilities
│   └── spark/                  # PySpark jobs
│       ├── etl/                # ETL jobs
│       └── analytics/          # Analytics jobs
├── infra/
│   ├── docker-compose.yml      # Full stack orchestration
│   ├── spark/                  # Spark configs
│   ├── hdfs/                   # HDFS configs
│   └── elasticsearch/          # ES configs
├── data/                       # Local data (gitignored)
├── docs/
│   ├── REPORT.md               # Business report
│   ├── SLIDES_OUTLINE.md       # Presentation outline
│   └── ARCHITECTURE.md         # Detailed architecture
├── configs/
│   ├── demo.yaml               # Small demo config
│   └── full.yaml               # Full ingestion config
├── Makefile                    # Build & run commands
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose (v2.0+)
- 16GB RAM recommended (8GB minimum for demo mode)
- 20GB disk space

### One-Command Demo

```bash
# Clone and enter the repository
git clone <repo-url>
cd scholarly-knowledge-graph

# Start everything and run the demo pipeline
make demo

# Open the dashboard
open http://localhost:3000
```

### Step-by-Step

```bash
# 1. Start infrastructure
make up

# 2. Run ingestion (demo mode: ~1000 papers)
make ingest CONFIG=demo

# 3. Run Spark ETL
make etl

# 4. Run analytics (topics, PageRank, communities)
make analytics

# 5. Index to Elasticsearch
make index

# 6. Open dashboard
open http://localhost:3000
```

### Useful Commands

```bash
make up          # Start all containers
make down        # Stop all containers
make logs        # View container logs
make spark-shell # Open interactive Spark shell
make status      # Check pipeline status
make clean       # Remove all data and containers
```

---

## 🌐 Deployment

### Local Development

Uses Docker Compose with pseudo-distributed HDFS:

```bash
make up
```

### Single Cloud VM (Production)

Deploy to an Ubuntu VM (recommended: 4+ vCPUs, 16GB+ RAM):

```bash
# SSH into your VM
ssh user@your-vm-ip

# Clone repository
git clone <repo-url>
cd scholarly-knowledge-graph

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Configure for production
cp configs/production.yaml configs/active.yaml
# Edit configs/active.yaml with your settings

# Start the stack
make up-prod

# Run the full pipeline
make demo CONFIG=production
```

The app will be accessible at `http://your-vm-ip:3000`

For HTTPS, add a reverse proxy (nginx/caddy) in front.

---

## 📊 Data Sources

### arXiv API
- **Endpoint**: `http://export.arxiv.org/api/query`
- **Data**: CS, Physics, Math papers with metadata
- **Rate limit**: 1 request/3 seconds (respected)
- **Fields**: id, title, abstract, authors, categories, dates

### PubMed E-utilities
- **Endpoint**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`
- **Data**: Biomedical literature
- **Rate limit**: 3 requests/second (10 with API key)
- **Fields**: PMID, title, abstract, authors, MeSH terms, journal

### OpenAlex
- **Endpoint**: `https://api.openalex.org/works`
- **Data**: 250M+ works with citation links
- **Rate limit**: 100K requests/day (polite pool)
- **Fields**: OpenAlex ID, DOI, citations, concepts, authors

---

## 🧪 Analytics

### Topic Modeling (LDA)
- TF-IDF vectorization of abstracts
- Latent Dirichlet Allocation with 20-50 topics
- Topic coherence scoring for quality

### Citation Analysis
- **PageRank**: Influence score considering citation network structure
- **Citation count**: Raw popularity metric
- **Comparison**: PageRank surfaces "hidden gems" with fewer citations

### Community Detection
- Label Propagation on citation graph
- Identifies research clusters/subfields
- Used for graph coloring in UI

### Trend Analysis
- Topic share over time (rolling averages)
- Emerging topic detection (growth rate > threshold)
- Velocity metrics for "hot" research areas

---

## 🖥️ UI Pages

| Page | Description |
|------|-------------|
| **Home** | KPI tiles, emerging topics, system health |
| **Search** | Elasticsearch-powered search with filters |
| **Topics** | Topic trends over time, drill-down to papers |
| **Rankings** | Papers/authors by PageRank vs citations |
| **Graph** | Interactive citation network explorer |
| **Pipeline** | Ingestion stats, data quality metrics |

---

## 📖 Documentation

- [Architecture Deep Dive](docs/ARCHITECTURE.md)
- [Business Report](docs/REPORT.md)
- [Presentation Slides](docs/SLIDES_OUTLINE.md)

---

## 👥 Team

| Name | Role | Contributions |
|------|------|---------------|
| Aarya Shah | Data Engineering Lead | Ingestion, Spark ETL, HDFS |
| Aryan Donde | Analytics & Frontend Lead | GraphFrames, LDA, Next.js |

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- arXiv for open access to research metadata
- NCBI/NLM for PubMed E-utilities
- OpenAlex for the comprehensive scholarly graph
- NYU Tandon CS-GY 6513 course staff

