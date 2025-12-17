"""
Scholarly Knowledge Graph - FastAPI Backend

Provides REST API endpoints for:
- Search (Elasticsearch-powered)
- Statistics and aggregations
- Topic analysis
- Rankings (papers, authors)
- Graph exploration
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routers import search, stats, topics, rankings, graph, health
from services.data_service import DataService
from services.elasticsearch_service import ElasticsearchService

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Scholarly Knowledge Graph API...")
    
    # Initialize services
    app.state.data_service = DataService(settings.data_path)
    app.state.es_service = ElasticsearchService(
        settings.elasticsearch_url,
        settings.elasticsearch_index
    )
    
    # Test connections
    try:
        await app.state.es_service.connect()
        logger.info("Connected to Elasticsearch")
    except Exception as e:
        logger.warning(f"Elasticsearch not available: {e}")
    
    logger.info("API startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down API...")
    await app.state.es_service.close()


# Create FastAPI app
app = FastAPI(
    title="Scholarly Knowledge Graph API",
    description="""
    API for exploring the Scholarly Knowledge Graph - a unified dataset of 
    research papers from arXiv, PubMed, and OpenAlex with citation analysis,
    topic modeling, and influence metrics.
    
    ## Features
    
    - **Search**: Full-text search with filtering by year, source, and field
    - **Statistics**: Aggregate metrics and trends
    - **Topics**: Topic modeling results and trends
    - **Rankings**: Papers and authors by PageRank and citations
    - **Graph**: Citation network exploration
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(search.router, prefix="/search", tags=["Search"])
app.include_router(stats.router, prefix="/stats", tags=["Statistics"])
app.include_router(topics.router, prefix="/topics", tags=["Topics"])
app.include_router(rankings.router, prefix="/rankings", tags=["Rankings"])
app.include_router(graph.router, prefix="/graph", tags=["Graph"])


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

