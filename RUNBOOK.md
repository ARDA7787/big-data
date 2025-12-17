# Grader Runbook

Step-by-step instructions to run the ScholarGraph project from a clean machine.

## Prerequisites

- **Docker Desktop** (v20.10+) with Docker Compose v2
  - Recommended: Allocate at least 8GB RAM to Docker
  - Minimum: 4GB RAM (may experience OOM issues)
- **Make** (GNU Make)
- **20GB free disk space**
- **Internet connection** (for API data ingestion)

## Quick Start (5 commands)

```bash
# 1. Start all services (builds on first run, ~5 min)
make up

# 2. Initialize HDFS directories
make init-hdfs

# 3. Run data ingestion (~3-5 min, year-balanced)
make ingest CONFIG=demo

# 4. Run ETL + Analytics (~5 min total)
make etl CONFIG=demo
make analytics CONFIG=demo

# 5. Open the dashboard
open http://localhost:3000
```

## Detailed Steps

### Step 1: Start Infrastructure

```bash
make up
```

This command:
- Builds custom Spark images with required dependencies
- Starts HDFS (NameNode + DataNode)
- Starts Spark (Master + Worker)
- Starts Elasticsearch
- Starts Backend API (FastAPI)
- Starts Frontend (Next.js)

First run takes ~5 minutes for image builds. Subsequent runs are fast.

**Verify services are healthy:**
```bash
make wait-healthy
```

### Step 2: Initialize HDFS

```bash
make init-hdfs
```

Creates the required HDFS directories for raw and processed data.

### Step 3: Run Data Ingestion

```bash
make ingest CONFIG=demo
```

Fetches data with **year-balanced sampling**:
- arXiv API (~200 papers)
- PubMed API (~200 papers)
- OpenAlex API (~600 papers)

Year distribution is balanced across 2015-2024 to prevent data skew.

**Expected output:**
```
✓ arxiv: 200 records (year-balanced)
✓ pubmed: 200 records
✓ openalex: 600 records
Total Records: 1000
```

### Step 4: Run Spark ETL

```bash
make etl CONFIG=demo
```

Transforms raw NDJSON into unified Parquet tables:
- Works (papers)
- Authors
- Venues
- Citations

**Expected output:**
```
Unified works (deduplicated): ~900
Unique authors: ~6000
Citation edges: ~150
```

### Step 5: Run Spark Analytics

```bash
make analytics CONFIG=demo
```

Runs machine learning and graph analytics:
- Topic modeling (LDA with 10 topics, 80+ stopwords)
- PageRank (citation influence)
- Community detection (Label Propagation)
- Trend analysis

**Expected output:**
```
Created 10 topics
Topic labels: Language, Image, Cancer, Social, ...
Graph: 900 vertices, 152 edges
Running PageRank...
Running Label Propagation...
✓ Analytics complete
```

### Step 6: Index to Elasticsearch (Optional)

```bash
make index
```

Indexes papers to Elasticsearch for full-text search.

### Step 7: Access the Dashboard

Open http://localhost:3000 in your browser.

**Available pages:**
- **Dashboard**: Overview statistics and charts (with "Sample Dataset" labels)
- **Search**: Full-text paper search with modal details
- **Topics**: Topic trends (line chart + heatmap) with drilldown modal
- **Rankings**: PageRank and citation rankings with paper modal
- **Graph**: Interactive citation network with side panel details
- **Profile**: Saved papers and authors

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| All containers running | `docker ps` | 6+ containers up |
| API health | `curl localhost:8000/health` | `{"status":"healthy"...}` |
| Data balance | `curl localhost:8000/stats/data-health` | "Data looks balanced" |
| Topic quality | `curl localhost:8000/topics \| jq '.[].label'` | No "Identified" |
| ES index | `curl localhost:9200/scholarly_works/_count` | `{"count":~900}` |
| Frontend | Open `http://localhost:3000` | Dashboard loads |

## Feature Verification

### Citation Graph
1. Navigate to **Citation Graph** page
2. Graph should be **stable** (no jittering)
3. Click any node → **Side panel** opens with paper details
4. Toggle **Labels** in Settings → ALL nodes show labels
5. Zoom controls on **left side** (not overlapping legend)

### Rankings
1. Navigate to **Rankings** page
2. Click any paper → **Modal** opens with abstract, source, DOI
3. Click **Save** → Paper added to saved items

### Topics
1. Navigate to **Topic Trends** page
2. View **Line Chart** and **Heatmap** modes
3. Double-click any topic → **Drilldown modal** with papers, authors, histogram

### Profile
1. Navigate to **Profile** (from header dropdown)
2. View saved papers and authors
3. Use **Look Up** and **Remove** actions

## Troubleshooting

### Port Conflicts

If you see "port already allocated":
```bash
# Stop all Docker containers
docker stop $(docker ps -aq)

# Then retry
make up
```

### Elasticsearch OOM

If Elasticsearch crashes:
```bash
docker start elasticsearch
sleep 30
docker restart backend
```

### Data Imbalance

If you see too many 2025 papers:
```bash
# Re-run ingestion with year-balanced config
rm -rf data/raw/* data/processed/*
make ingest CONFIG=demo  # Uses year_distribution.enabled: true
make etl CONFIG=demo
make analytics CONFIG=demo
```

### Topic Labels Generic

If topics show "Identified" or other generic labels:
```bash
# Re-run analytics (uses expanded 80+ stopwords)
make analytics CONFIG=demo
```

## Cleanup

```bash
# Stop and remove all containers + volumes
make clean

# Or just stop without removing data
make down
```

## Service URLs

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API Docs | http://localhost:8000/docs |
| Spark Master | http://localhost:8080 |
| HDFS NameNode | http://localhost:9870 |
| Elasticsearch | http://localhost:9200 |

## Demo Mode vs Full Mode

| Mode | Config | Papers | Time |
|------|--------|--------|------|
| Demo | `CONFIG=demo` | ~1000 | ~10 min |
| Full | `CONFIG=full` | ~100,000 | ~2 hours |

For grading, demo mode is recommended.

## Manual Data Regeneration

If you need to completely rebuild the data:

```bash
# 1. Clear old data
rm -rf data/processed/* data/analytics/* data/raw/*

# 2. Delete ES index
curl -X DELETE "http://localhost:9200/scholarly_works"

# 3. Run full pipeline
make ingest CONFIG=demo
make etl CONFIG=demo
make analytics CONFIG=demo
make index

# 4. Rebuild frontend (if needed)
docker compose -f infra/docker-compose.yml build frontend
docker compose -f infra/docker-compose.yml up -d frontend
```
