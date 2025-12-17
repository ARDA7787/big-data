"""
Topic analysis endpoints.
"""

from typing import Optional, List

from fastapi import APIRouter, Request, Query, HTTPException
from pydantic import BaseModel

router = APIRouter()


class TopicTerm(BaseModel):
    """A term in a topic."""
    term: str
    weight: float


class Topic(BaseModel):
    """Topic definition."""
    topic_id: int
    label: str
    top_terms: Optional[List[TopicTerm]] = None
    paper_count: Optional[int] = None


class TopicTrend(BaseModel):
    """Topic share at a point in time."""
    year: int
    topic_id: int
    label: str
    paper_count: int
    total_papers: Optional[int] = None
    topic_share: float


class EmergingTopic(BaseModel):
    """Topic with high growth rate."""
    topic_id: int
    label: str
    paper_count: int
    topic_share: float
    growth_rate: float


class TopicPaper(BaseModel):
    """Paper in a topic."""
    work_id: str
    title: str
    year: Optional[int] = None
    primary_field: Optional[str] = None


@router.get("", response_model=List[Topic])
async def list_topics(request: Request):
    """
    List all discovered topics.
    
    Returns topics with their top terms and labels.
    """
    data_service = request.app.state.data_service
    topics = data_service.get_topics()
    
    result = []
    for t in topics:
        top_terms = t.get("top_terms", [])
        if isinstance(top_terms, str):
            # Handle serialized JSON
            import json
            try:
                top_terms = json.loads(top_terms)
            except:
                top_terms = []
        
        result.append(Topic(
            topic_id=t.get("topic_id"),
            label=t.get("label", f"Topic {t.get('topic_id')}"),
            top_terms=[TopicTerm(**term) for term in top_terms] if top_terms else None,
            paper_count=t.get("paper_count")
        ))
    
    return result


@router.get("/trends")
async def get_topic_trends(
    request: Request,
    topic_id: Optional[int] = Query(None, description="Filter by topic ID"),
    year_from: Optional[int] = Query(None, ge=1900, le=2100),
    year_to: Optional[int] = Query(None, ge=1900, le=2100)
):
    """
    Get topic share trends over time.
    
    Returns topic proportions per year for trend visualization.
    """
    data_service = request.app.state.data_service
    trends = data_service.get_topic_trends(
        topic_id=topic_id,
        year_from=year_from,
        year_to=year_to
    )
    
    return {"trends": [TopicTrend(**t) for t in trends]}


@router.get("/emerging", response_model=List[EmergingTopic])
async def get_emerging_topics(
    request: Request,
    limit: int = Query(10, ge=1, le=50, description="Number of topics to return")
):
    """
    Get emerging topics with highest growth rate.
    
    Returns topics that have grown significantly in recent periods.
    """
    data_service = request.app.state.data_service
    topics = data_service.get_emerging_topics(limit=limit)
    
    return [EmergingTopic(**t) for t in topics]


@router.get("/{topic_id}")
async def get_topic_details(
    request: Request,
    topic_id: int,
    limit: int = Query(20, ge=1, le=100, description="Papers to return")
):
    """
    Get detailed information about a topic.
    
    Returns topic definition with top papers and authors.
    """
    data_service = request.app.state.data_service
    
    # Get topic info
    topic = data_service.get_topic_by_id(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get papers in topic
    papers = data_service.get_papers_by_topic(topic_id, limit=limit)
    
    # Get authors in topic
    authors = data_service.get_authors_by_topic(topic_id, limit=10)
    
    # Parse top_terms
    top_terms = topic.get("top_terms", [])
    if isinstance(top_terms, str):
        import json
        try:
            top_terms = json.loads(top_terms)
        except:
            top_terms = []
    
    return {
        "topic": Topic(
            topic_id=topic.get("topic_id"),
            label=topic.get("label"),
            top_terms=[TopicTerm(**t) for t in top_terms] if top_terms else None
        ),
        "papers": [TopicPaper(**p) for p in papers],
        "paper_count": len(papers),
        "top_authors": authors
    }


@router.get("/{topic_id}/papers")
async def get_topic_papers(
    request: Request,
    topic_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """
    Get papers for a specific topic with pagination.
    """
    data_service = request.app.state.data_service
    
    # Verify topic exists
    topic = data_service.get_topic_by_id(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get papers (simplified - in production would use proper pagination)
    papers = data_service.get_papers_by_topic(topic_id, limit=page_size)
    
    return {
        "topic_id": topic_id,
        "page": page,
        "page_size": page_size,
        "papers": papers
    }
