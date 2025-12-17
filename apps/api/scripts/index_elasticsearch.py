#!/usr/bin/env python3
"""
Index processed data into Elasticsearch.

This script:
1. Connects to Elasticsearch
2. Creates/recreates the scholarly_works index
3. Reads processed Parquet data
4. Bulk indexes documents with influence metrics
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import duckdb
from config import settings
from services.elasticsearch_service import ElasticsearchService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class ElasticsearchIndexer:
    """Indexes Parquet data into Elasticsearch."""
    
    def __init__(self, data_path: str, es_url: str, index_name: str):
        self.data_path = Path(data_path)
        self.es_service = ElasticsearchService(es_url, index_name)
        self.batch_size = 500
        
        # Initialize DuckDB connection
        self.conn = duckdb.connect(":memory:")
        self._register_tables()
    
    def _register_tables(self):
        """Register Parquet files as DuckDB views."""
        processed_path = self.data_path / "processed"
        analytics_path = self.data_path / "analytics"
        
        tables = [
            ("works", processed_path / "works"),
            ("metrics", processed_path / "metrics"),
        ]
        
        for view_name, path in tables:
            if path.exists():
                try:
                    self.conn.execute(f"""
                        CREATE OR REPLACE VIEW {view_name} AS 
                        SELECT * FROM parquet_scan('{path}/**/*.parquet')
                    """)
                    logger.info(f"Registered view: {view_name}")
                except Exception as e:
                    logger.warning(f"Failed to register {view_name}: {e}")
    
    def _get_documents(self, limit: int = None) -> list[dict]:
        """Query documents to index."""
        sql = """
            SELECT 
                w.work_id,
                w.source_id,
                w.source,
                w.title,
                w.abstract,
                w.year,
                w.pub_date,
                w.primary_field,
                w.fields,
                w.doi,
                w.venue_name,
                COALESCE(m.pagerank, 0.0) as pagerank,
                COALESCE(m.citation_count, 0) as citation_count,
                m.community_id
            FROM works w
            LEFT JOIN metrics m ON w.work_id = m.work_id
            WHERE w.title IS NOT NULL
        """
        
        if limit:
            sql += f" LIMIT {limit}"
        
        result = self.conn.execute(sql)
        columns = [desc[0] for desc in result.description]
        rows = result.fetchall()
        
        documents = []
        for row in rows:
            doc = dict(zip(columns, row))
            
            # Convert fields array to list if needed
            if doc.get("fields") and not isinstance(doc["fields"], list):
                doc["fields"] = [doc["fields"]]
            
            # Ensure numeric types
            doc["pagerank"] = float(doc.get("pagerank") or 0.0)
            doc["citation_count"] = int(doc.get("citation_count") or 0)
            
            documents.append(doc)
        
        return documents
    
    async def run(self, recreate: bool = True, limit: int = None):
        """Run the indexing process."""
        logger.info("=" * 60)
        logger.info("Starting Elasticsearch Indexing")
        logger.info("=" * 60)
        
        # Connect to Elasticsearch
        try:
            await self.es_service.connect()
        except Exception as e:
            logger.error(f"Failed to connect to Elasticsearch: {e}")
            raise
        
        try:
            # Create/recreate index
            if recreate:
                logger.info(f"Creating index: {self.es_service.index_name}")
                await self.es_service.create_index(settings={"number_of_shards": 1})
            
            # Get documents
            logger.info("Reading documents from Parquet...")
            documents = self._get_documents(limit=limit)
            total_docs = len(documents)
            logger.info(f"Found {total_docs} documents to index")
            
            if total_docs == 0:
                logger.warning("No documents found. Check if Parquet files exist.")
                return
            
            # Index in batches
            indexed = 0
            for i in range(0, total_docs, self.batch_size):
                batch = documents[i:i + self.batch_size]
                
                try:
                    await self.es_service.bulk_index(batch)
                    indexed += len(batch)
                    
                    pct = (indexed / total_docs) * 100
                    logger.info(f"Indexed {indexed}/{total_docs} ({pct:.1f}%)")
                    
                except Exception as e:
                    logger.error(f"Failed to index batch {i}: {e}")
                    continue
            
            # Refresh index
            await self.es_service.refresh()
            
            # Verify count
            count = await self.es_service.count()
            logger.info(f"Index contains {count} documents")
            
            logger.info("=" * 60)
            logger.info("Indexing Complete!")
            logger.info("=" * 60)
            
        finally:
            await self.es_service.close()


async def main():
    parser = argparse.ArgumentParser(description='Index data to Elasticsearch')
    parser.add_argument(
        '--data-path', '-d',
        default='/data',
        help='Path to data directory'
    )
    parser.add_argument(
        '--es-url',
        default=None,
        help='Elasticsearch URL (default: from settings)'
    )
    parser.add_argument(
        '--index-name',
        default=None,
        help='Index name (default: from settings)'
    )
    parser.add_argument(
        '--no-recreate',
        action='store_true',
        help='Do not recreate index, append to existing'
    )
    parser.add_argument(
        '--limit', '-n',
        type=int,
        default=None,
        help='Limit number of documents to index'
    )
    
    args = parser.parse_args()
    
    indexer = ElasticsearchIndexer(
        data_path=args.data_path,
        es_url=args.es_url or settings.elasticsearch_url,
        index_name=args.index_name or settings.elasticsearch_index
    )
    
    await indexer.run(
        recreate=not args.no_recreate,
        limit=args.limit
    )


if __name__ == "__main__":
    asyncio.run(main())
