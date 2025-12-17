#!/bin/bash
# =============================================================================
# Data Rebuild Script for ScholarGraph
# =============================================================================
# This script completely rebuilds the data pipeline to fix:
# - Year distribution imbalance (77% 2025 -> balanced distribution)
# - Topic quality (remove "Identified" and other generic labels)
# - Source field in Elasticsearch
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "========================================="
echo "ScholarGraph Data Rebuild Script"
echo "========================================="
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if containers are up
echo "Step 0: Checking container status..."
docker compose -f infra/docker-compose.yml ps

echo ""
echo "Step 1: Clearing old data..."
echo "----------------------------------------"

# Clear processed data
rm -rf data/processed/* 2>/dev/null || true
rm -rf data/analytics/* 2>/dev/null || true
rm -rf data/raw/* 2>/dev/null || true
rm -rf data/checkpoints/* 2>/dev/null || true
echo "✓ Cleared local data directories"

# Clear Elasticsearch index
echo "Deleting Elasticsearch index..."
curl -s -X DELETE "http://localhost:9200/scholarly_works" 2>/dev/null || true
echo "✓ Cleared Elasticsearch index"

echo ""
echo "Step 2: Running ingestion pipeline..."
echo "----------------------------------------"
echo "This will fetch balanced data from arXiv, PubMed, and OpenAlex"
echo ""

# Run ingestion in the backend container
docker exec -it backend python -c "
import asyncio
import sys
sys.path.insert(0, '/app')

async def run_ingest():
    from ingest_runner import run_ingestion
    await run_ingestion()

try:
    asyncio.run(run_ingest())
except Exception as e:
    print(f'Ingestion error: {e}')
    print('Trying alternative method...')
" 2>/dev/null || echo "Ingestion via backend failed, using spark container..."

# Alternative: Run via spark container if backend doesn't have ingest
docker exec spark-master python3 /opt/spark/jobs/ingest_runner.py --config /data/configs/demo.yaml 2>/dev/null || true

echo ""
echo "Step 3: Running Spark ETL..."
echo "----------------------------------------"
docker exec spark-master spark-submit \
    --master spark://spark-master:7077 \
    --driver-memory 2g \
    --executor-memory 2g \
    /opt/spark/jobs/etl/main.py \
    --config /data/configs/demo.yaml

echo ""
echo "Step 4: Running Spark Analytics (Topics + PageRank)..."
echo "----------------------------------------"
docker exec spark-master spark-submit \
    --master spark://spark-master:7077 \
    --driver-memory 2g \
    --executor-memory 2g \
    /opt/spark/jobs/analytics/main.py \
    --config /data/configs/demo.yaml

echo ""
echo "Step 5: Rebuilding Elasticsearch index..."
echo "----------------------------------------"
docker exec backend python -c "
import sys
sys.path.insert(0, '/app')
from scripts.index_elasticsearch import run_indexing
run_indexing()
"

echo ""
echo "Step 6: Verifying results..."
echo "----------------------------------------"

# Check year distribution
echo "Year distribution in Elasticsearch:"
curl -s "http://localhost:9200/scholarly_works/_search" -H "Content-Type: application/json" -d '{
  "size": 0,
  "aggs": {
    "years": {
      "terms": { "field": "year", "size": 15, "order": { "_key": "desc" } }
    }
  }
}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
buckets = data.get('aggregations', {}).get('years', {}).get('buckets', [])
total = sum(b.get('doc_count', 0) for b in buckets)
print(f'Total papers: {total}')
for b in buckets:
    year = b.get('key')
    count = b.get('doc_count')
    pct = (count/total*100) if total else 0
    bar = '█' * int(pct/2)
    print(f'  {year}: {count:4d} ({pct:5.1f}%) {bar}')
"

echo ""
echo "Topic labels:"
curl -s http://localhost:8000/topics | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data[:10]:
    print(f'  - {t.get(\"label\", \"N/A\")}')
"

echo ""
echo "========================================="
echo "Data rebuild complete!"
echo "========================================="
echo ""
echo "Please hard refresh your browser (Cmd+Shift+R) to see changes."

