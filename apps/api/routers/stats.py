"""
Statistics and overview endpoints.
"""

from typing import Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class OverviewStats(BaseModel):
    """Overall dataset statistics."""
    total_works: int
    total_authors: int
    total_citations: int
    years_covered: int
    sources: int
    topics: int


class YearlyStats(BaseModel):
    """Statistics per year."""
    year: int
    paper_count: int
    field_count: Optional[int] = None


class SourceStats(BaseModel):
    """Statistics per source."""
    source: str
    paper_count: int
    percentage: float


class FieldStats(BaseModel):
    """Statistics per field/category."""
    field: str
    paper_count: int


class EmergingTopic(BaseModel):
    """Emerging topic with growth rate."""
    topic_id: int
    label: str
    paper_count: int
    topic_share: float
    growth_rate: float


@router.get("/overview", response_model=OverviewStats)
async def get_overview(request: Request):
    """
    Get overall dataset statistics.
    
    Returns high-level KPIs:
    - Total works, authors, citations
    - Years covered
    - Number of sources and topics
    """
    data_service = request.app.state.data_service
    stats = data_service.get_overall_stats()
    
    return OverviewStats(
        total_works=stats.get("total_works", 0),
        total_authors=stats.get("total_authors", 0),
        total_citations=stats.get("total_citations", 0),
        years_covered=stats.get("years_covered", 0),
        sources=stats.get("sources", 3),
        topics=stats.get("topics", 0)
    )


@router.get("/yearly", response_model=list[YearlyStats])
async def get_yearly_stats(request: Request):
    """
    Get publication statistics by year.
    
    Returns papers and fields per year for trend visualization.
    """
    data_service = request.app.state.data_service
    stats = data_service.get_yearly_stats()
    
    return [YearlyStats(**s) for s in stats]


@router.get("/sources")
async def get_source_stats(request: Request):
    """
    Get publication statistics by source.
    
    Returns distribution across arXiv, PubMed, and OpenAlex.
    """
    data_service = request.app.state.data_service
    stats = data_service.get_source_stats()
    
    return {"sources": [SourceStats(**s) for s in stats]}


@router.get("/fields")
async def get_field_stats(request: Request):
    """
    Get publication statistics by field/category.
    
    Returns top 20 fields by paper count.
    """
    data_service = request.app.state.data_service
    stats = data_service.get_field_stats()
    
    return {"fields": [FieldStats(**s) for s in stats]}


@router.get("/emerging")
async def get_emerging_topics(request: Request, limit: int = 10):
    """
    Get emerging topics based on growth rate.
    
    Returns topics with highest year-over-year growth.
    """
    data_service = request.app.state.data_service
    topics = data_service.get_emerging_topics(limit=limit)
    
    return {"emerging_topics": [EmergingTopic(**t) for t in topics]}


@router.get("/pipeline")
async def get_pipeline_stats(request: Request):
    """
    Get data pipeline statistics and health.
    
    Returns ingestion metrics, data quality, and last run times.
    """
    data_service = request.app.state.data_service
    quality = data_service.get_data_quality_metrics()
    
    return {
        "ingestion": {
            "last_run": quality.get("last_ingestion"),
            "records_by_source": quality.get("records_by_source", {})
        },
        "quality": {
            "missing_abstract_rate": quality.get("missing_abstract_rate", 0),
            "missing_doi_rate": quality.get("missing_doi_rate", 0),
            "missing_authors_rate": quality.get("missing_authors_rate", 0),
            "duplicate_rate": quality.get("duplicate_rate", 0)
        },
        "status": "healthy"
    }
