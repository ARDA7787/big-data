"""
Elasticsearch service for full-text search.
"""

import logging
from typing import Any, Optional

from elasticsearch import AsyncElasticsearch

logger = logging.getLogger(__name__)


class ElasticsearchService:
    """Service for Elasticsearch operations."""
    
    def __init__(self, url: str, index_name: str):
        """
        Initialize the Elasticsearch service.
        
        Args:
            url: Elasticsearch URL
            index_name: Name of the works index
        """
        self.url = url
        self.index_name = index_name
        self.client: Optional[AsyncElasticsearch] = None
    
    async def connect(self):
        """Connect to Elasticsearch."""
        self.client = AsyncElasticsearch(
            [self.url],
            verify_certs=False,
            ssl_show_warn=False
        )
        
        # Verify connection
        info = await self.client.info()
        logger.info(f"Connected to Elasticsearch: {info['version']['number']}")
    
    async def close(self):
        """Close the Elasticsearch connection."""
        if self.client:
            await self.client.close()
    
    async def health_check(self) -> bool:
        """Check if Elasticsearch is healthy."""
        if not self.client:
            return False
        
        try:
            health = await self.client.cluster.health()
            return health["status"] in ("green", "yellow")
        except Exception as e:
            logger.error(f"Elasticsearch health check failed: {e}")
            return False
    
    async def create_index(self, settings: dict = None):
        """Create the works index with mapping."""
        if not self.client:
            raise RuntimeError("Not connected to Elasticsearch")
        
        mapping = {
            "settings": {
                "number_of_shards": settings.get("number_of_shards", 1) if settings else 1,
                "number_of_replicas": settings.get("number_of_replicas", 0) if settings else 0,
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
                    "source_id": {"type": "keyword"},
                    "source": {"type": "keyword"},
                    "title": {
                        "type": "text",
                        "analyzer": "text_analyzer",
                        "fields": {
                            "keyword": {"type": "keyword", "ignore_above": 500}
                        }
                    },
                    "abstract": {
                        "type": "text",
                        "analyzer": "text_analyzer"
                    },
                    "year": {"type": "integer"},
                    "pub_date": {"type": "date"},
                    "primary_field": {
                        "type": "text",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "fields": {"type": "keyword"},
                    "doi": {"type": "keyword"},
                    "venue_name": {"type": "text"},
                    "pagerank": {"type": "float"},
                    "citation_count": {"type": "integer"},
                    "community_id": {"type": "long"}
                }
            }
        }
        
        # Delete existing index
        if await self.client.indices.exists(index=self.index_name):
            await self.client.indices.delete(index=self.index_name)
            logger.info(f"Deleted existing index: {self.index_name}")
        
        # Create new index
        await self.client.indices.create(index=self.index_name, body=mapping)
        logger.info(f"Created index: {self.index_name}")
    
    async def index_document(self, doc: dict[str, Any]):
        """Index a single document."""
        if not self.client:
            raise RuntimeError("Not connected to Elasticsearch")
        
        await self.client.index(
            index=self.index_name,
            id=doc.get("work_id"),
            document=doc
        )
    
    async def bulk_index(self, documents: list[dict[str, Any]]):
        """Bulk index documents."""
        if not self.client:
            raise RuntimeError("Not connected to Elasticsearch")
        
        actions = []
        for doc in documents:
            actions.append({
                "index": {
                    "_index": self.index_name,
                    "_id": doc.get("work_id")
                }
            })
            actions.append(doc)
        
        if actions:
            response = await self.client.bulk(operations=actions, refresh=True)
            
            if response.get("errors"):
                error_count = sum(
                    1 for item in response["items"]
                    if "error" in item.get("index", {})
                )
                logger.warning(f"Bulk indexing had {error_count} errors")
            
            return len(documents)
        
        return 0
    
    async def search(
        self,
        query: dict[str, Any],
        sort: list = None,
        from_: int = 0,
        size: int = 20,
        aggs: dict = None,
        _source: list = None
    ) -> dict[str, Any]:
        """
        Execute a search query.
        
        Args:
            query: Elasticsearch query DSL
            sort: Sort specification
            from_: Starting offset
            size: Number of results
            aggs: Aggregations
            _source: Fields to return
            
        Returns:
            Elasticsearch response
        """
        if not self.client:
            raise RuntimeError("Not connected to Elasticsearch")
        
        body = {"query": query}
        
        if sort:
            body["sort"] = sort
        if aggs:
            body["aggs"] = aggs
        if _source:
            body["_source"] = _source
        
        response = await self.client.search(
            index=self.index_name,
            body=body,
            from_=from_,
            size=size
        )
        
        return response.body
    
    async def get_document(self, doc_id: str) -> Optional[dict[str, Any]]:
        """Get a document by ID."""
        if not self.client:
            raise RuntimeError("Not connected to Elasticsearch")
        
        try:
            response = await self.client.get(
                index=self.index_name,
                id=doc_id
            )
            return response.body["_source"]
        except Exception:
            return None
    
    async def count(self, query: dict = None) -> int:
        """Count documents matching a query."""
        if not self.client:
            raise RuntimeError("Not connected to Elasticsearch")
        
        body = {"query": query} if query else {}
        
        response = await self.client.count(
            index=self.index_name,
            body=body
        )
        
        return response.body["count"]
    
    async def refresh(self):
        """Refresh the index."""
        if self.client:
            await self.client.indices.refresh(index=self.index_name)

