# ScholarGraph - Scalable Scholarly Knowledge Graph

> Mining Research Papers & Citation Networks at Scale

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Spark 3.3](https://img.shields.io/badge/spark-3.3-orange.svg)](https://spark.apache.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A unified scholarly knowledge graph platform that ingests data from arXiv, PubMed, and OpenAlex, models it as a citation network, runs scalable analytics, and exposes insights via a polished web dashboard.

**Team**: Aarya Shah, Aryan Donde  
**Course**: CS-GY 6513 Big Data (NYU Tandon)

---

## 🎯 Project Overview

This project demonstrates end-to-end big data engineering by building a scholarly knowledge graph from multiple open data sources. We:

1. **Ingest** research papers from arXiv, PubMed, and OpenAlex APIs with year-balanced sampling
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
│  • Year-balanced sampling (2015-2024)                                   │
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
│  • Faceted filtering            │  • Parquet aggregates (DuckDB)        │
│  • Influence metrics            │  • Graph queries                      │
└─────────────────────────────────┴───────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER (Next.js)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Dashboard │ Search │ Topics │ Rankings │ Citation Graph │ Profile      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ UI Features

### Dashboard
- **KPI Cards**: Total papers, authors, citations, topics with real-time stats
- **Publications Timeline**: Interactive line chart showing papers over time
- **Source Distribution**: Pie chart of data sources (arXiv, PubMed, OpenAlex)
- **Field Distribution**: Top research fields breakdown
- **Sample Dataset Labels**: Clear indication that stats are from indexed data

### Search Papers
- **Elasticsearch-Powered**: Full-text search across titles and abstracts
- **Faceted Filters**: Year range, source, field of study
- **Sort Options**: Relevance, citations, PageRank, year
- **Paper Modal**: Click any result to view full details with save option

### Topic Trends
- **Topic Cards**: Visual display of discovered topics with top terms
- **Trend Charts**: Line chart and heatmap visualizations
- **Topic Drilldown**: Double-click to see papers, authors, and year histogram
- **Why Trending**: Explanation panel for each topic

### Rankings
- **Dual View**: Papers and Authors tabs
- **Multiple Layouts**: List, Grid, and Card views
- **Paper Modal**: Full details on click with abstract, source, DOI
- **Save Functionality**: Bookmark papers for later

### Citation Graph Explorer
- **Force-Directed Graph**: Interactive SVG-based visualization
- **Pre-computed Layout**: Static positions for stability (no jittering)
- **Settings Panel**: Customize colors (community/year/citations) and node sizes
- **Search in Graph**: Find and highlight specific papers
- **Zoom Controls**: Vertical toolbar on left side
- **Side Panel**: Click any node to see full paper details
- **Save/Export**: Bookmark papers and export graph as SVG
- **Labels Toggle**: Show/hide all node labels

### Profile / Saved Items
- **Saved Papers**: Persisted list of bookmarked papers
- **Saved Authors**: Persisted list of bookmarked authors
- **Quick Actions**: Look up, view citations, remove from saved

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

# 2. Run ingestion (demo mode: ~1000 papers, year-balanced)
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

---

## 📁 Repository Structure

```
/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/                # App router pages
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── search/         # Search page
│   │   │   ├── topics/         # Topics page
│   │   │   ├── rankings/       # Rankings page
│   │   │   ├── graph/          # Citation graph
│   │   │   └── profile/        # Saved items
│   │   ├── components/         # React components
│   │   │   ├── charts/         # D3/Nivo visualizations
│   │   │   ├── ui/             # UI components (modals, cards)
│   │   │   └── layout/         # Header, sidebar
│   │   └── lib/                # Utilities, API client, contexts
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
│       └── analytics/          # Analytics jobs (LDA, PageRank)
├── infra/
│   ├── docker-compose.yml      # Full stack orchestration
│   ├── spark/                  # Spark configs
│   └── elasticsearch/          # ES configs
├── data/                       # Local data (gitignored)
├── docs/
│   ├── REPORT.md               # Business report
│   ├── SLIDES_OUTLINE.md       # Presentation outline
│   └── ARCHITECTURE.md         # Detailed architecture
├── configs/
│   ├── demo.yaml               # Small demo config (year-balanced)
│   └── full.yaml               # Full ingestion config
├── scripts/
│   └── rebuild_data.sh         # Data regeneration script
├── Makefile                    # Build & run commands
└── README.md                   # This file
```

---

## 🧪 Analytics Features

### Topic Modeling (LDA)
- TF-IDF vectorization of abstracts
- Latent Dirichlet Allocation with 10-50 topics
- **Improved stopwords**: 80+ scientific filler terms filtered
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
- **Heatmap visualization**: Topic × Year matrix

---

## 🔧 Data Quality Improvements

### Year-Balanced Ingestion
- Papers distributed across year bins (2015-2017, 2018-2020, 2021-2022, 2023-2024)
- Prevents 2025 dominance from "latest-first" API ordering
- Configurable via `demo.yaml`

### Topic Quality
- Expanded scientific stopwords (80+ terms)
- Filters out generic labels like "Identified", "Using", "Method"
- Noun-phrase preference for topic labels

### Data Health Diagnostics
- `/stats/data-health` endpoint for year/source distribution
- Alerts for imbalanced data

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
