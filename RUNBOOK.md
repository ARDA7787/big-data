# Grader Runbook

Step-by-step instructions to run the Scalable Scholarly Knowledge Graph project from a clean machine.

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

# 3. Run data ingestion (~3-5 min)
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

Fetches data from:
- arXiv API (400 papers)
- PubMed API (300 papers)
- OpenAlex API (300 papers)

Total: ~1000 records in demo mode.

**Expected output:**
```
✓ arxiv: 400 records
✓ pubmed: 300 records
✓ openalex: 300 records
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
Unified works (deduplicated): 900
Unique authors: 6629
Citation edges: 152
```

### Step 5: Run Spark Analytics

```bash
make analytics CONFIG=demo
```

Runs machine learning and graph analytics:
- Topic modeling (LDA with 10 topics)
- PageRank (citation influence)
- Community detection (Label Propagation)
- Trend analysis

**Expected output:**
```
Created 10 topics
Graph: 900 vertices, 152 edges
Running PageRank...
Running Label Propagation...
Computed metrics for 900 works
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
- **Dashboard**: Overview statistics and charts
- **Search**: Full-text paper search
- **Topics**: Topic modeling visualization
- **Rankings**: PageRank and citation rankings
- **Graph**: Citation network explorer

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| All containers running | `docker ps` | 6+ containers up |
| API health | `curl localhost:8000/health` | `{"status":"healthy"...}` |
| ES index | `curl localhost:9200/scholarly_works/_count` | `{"count":98...}` |
| Frontend | Open `http://localhost:3000` | Dashboard loads |

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

### Analytics OOM

The analytics job uses reduced memory settings. If it still fails:
```bash
# Increase Docker Desktop memory allocation
# Or run with even smaller settings:
docker exec spark-master /spark/bin/spark-submit \
  --driver-memory 512m \
  --executor-memory 512m \
  --conf spark.sql.shuffle.partitions=4 \
  ...
```

### Slow First Build

First run builds custom Spark images. This takes ~5 minutes.
Subsequent runs reuse cached images.

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

