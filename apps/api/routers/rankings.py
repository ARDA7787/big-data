"""
Rankings endpoints for papers and authors.
"""

from typing import Optional, List

from fastapi import APIRouter, Request, Query
from pydantic import BaseModel

router = APIRouter()


class RankedPaper(BaseModel):
    """Paper with ranking metrics."""
    work_id: str
    title: str
    year: Optional[int] = None
    primary_field: Optional[str] = None
    pagerank: float
    citation_count: int
    community_id: Optional[int] = None


class RankedAuthor(BaseModel):
    """Author with ranking metrics."""
    author_id: str
    name: str
    affiliation: Optional[str] = None
    total_pagerank: float
    total_citations: int
    paper_count: int


class ComparisonPaper(BaseModel):
    """Paper for PageRank vs citation comparison."""
    work_id: str
    title: str
    year: Optional[int] = None
    primary_field: Optional[str] = None
    pagerank: float
    citation_count: int


class ComparisonStats(BaseModel):
    """Statistics for comparison analysis."""
    correlation: float
    avg_pagerank: float
    avg_citations: float
    total_papers: int


@router.get("/papers", response_model=List[RankedPaper])
async def get_top_papers(
    request: Request,
    sort_by: str = Query("pagerank", description="Sort by: pagerank or citations"),
    year_from: Optional[int] = Query(None, ge=1900, le=2100),
    year_to: Optional[int] = Query(None, ge=1900, le=2100),
    field: Optional[str] = Query(None, description="Filter by field/category"),
    limit: int = Query(50, ge=1, le=500)
):
    """
    Get top-ranked papers by influence metrics.
    
    Supports sorting by PageRank or raw citation count.
    """
    data_service = request.app.state.data_service
    
    papers = data_service.get_top_papers(
        sort_by=sort_by,
        year_from=year_from,
        year_to=year_to,
        field=field,
        limit=limit
    )
    
    return [RankedPaper(
        work_id=p.get("work_id", ""),
        title=p.get("title", ""),
        year=p.get("year"),
        primary_field=p.get("primary_field"),
        pagerank=p.get("pagerank", 0.0),
        citation_count=int(p.get("citation_count", 0)),
        community_id=p.get("community_id")
    ) for p in papers]


@router.get("/authors", response_model=List[RankedAuthor])
async def get_top_authors(
    request: Request,
    sort_by: str = Query("pagerank", description="Sort by: pagerank or citations"),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Get top-ranked authors by cumulative influence.
    
    Author influence is computed as sum of paper PageRanks.
    """
    data_service = request.app.state.data_service
    
    authors = data_service.get_top_authors(
        sort_by=sort_by,
        limit=limit
    )
    
    return [RankedAuthor(
        author_id=a.get("author_id", ""),
        name=a.get("name", ""),
        affiliation=a.get("affiliation"),
        total_pagerank=a.get("total_pagerank", 0.0),
        total_citations=int(a.get("total_citations", 0)),
        paper_count=int(a.get("paper_count", 0))
    ) for a in authors]


@router.get("/comparison")
async def get_pr_citation_comparison(
    request: Request,
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get data for PageRank vs citation count comparison.
    
    Returns papers with both metrics for scatter plot visualization.
    Also computes correlation coefficient.
    """
    data_service = request.app.state.data_service
    
    papers = data_service.get_papers_for_comparison(limit=limit)
    correlation = data_service.compute_pr_citation_correlation()
    
    # Compute averages
    if papers:
        avg_pr = sum(p.get("pagerank", 0) for p in papers) / len(papers)
        avg_citations = sum(p.get("citation_count", 0) for p in papers) / len(papers)
    else:
        avg_pr = 0
        avg_citations = 0
    
    return {
        "papers": [ComparisonPaper(
            work_id=p.get("work_id", ""),
            title=p.get("title", ""),
            year=p.get("year"),
            primary_field=p.get("primary_field"),
            pagerank=p.get("pagerank", 0.0),
            citation_count=int(p.get("citation_count", 0))
        ) for p in papers],
        "stats": ComparisonStats(
            correlation=correlation,
            avg_pagerank=avg_pr,
            avg_citations=avg_citations,
            total_papers=len(papers)
        )
    }


@router.get("/communities")
async def get_community_rankings(
    request: Request,
    limit: int = Query(20, ge=1, le=50)
):
    """
    Get community statistics and rankings.
    
    Returns communities ranked by size and average influence.
    """
    data_service = request.app.state.data_service
    
    communities = data_service.get_community_stats(limit=limit)
    
    return {
        "communities": communities,
        "total_communities": len(communities)
    }


@router.get("/hidden-gems")
async def get_hidden_gems(
    request: Request,
    limit: int = Query(20, ge=1, le=100)
):
    """
    Find papers with high PageRank but relatively low citation count.
    
    These are "hidden gems" - papers that are structurally important
    but may be undervalued by raw citation metrics.
    """
    data_service = request.app.state.data_service
    
    # Get papers with both metrics
    papers = data_service.get_papers_for_comparison(limit=500)
    
    if not papers:
        return {"hidden_gems": []}
    
    # Compute median citations
    citations = sorted(p.get("citation_count", 0) for p in papers)
    median_citations = citations[len(citations) // 2]
    
    # Compute median pagerank
    pageranks = sorted(p.get("pagerank", 0) for p in papers)
    median_pr = pageranks[len(pageranks) // 2]
    
    # Find papers with high PR but below-median citations
    hidden_gems = [
        p for p in papers
        if p.get("pagerank", 0) > median_pr
        and p.get("citation_count", 0) < median_citations
    ]
    
    # Sort by pagerank descending
    hidden_gems.sort(key=lambda x: x.get("pagerank", 0), reverse=True)
    
    return {
        "hidden_gems": [ComparisonPaper(
            work_id=p.get("work_id", ""),
            title=p.get("title", ""),
            year=p.get("year"),
            primary_field=p.get("primary_field"),
            pagerank=p.get("pagerank", 0.0),
            citation_count=int(p.get("citation_count", 0))
        ) for p in hidden_gems[:limit]],
        "median_citations": median_citations,
        "median_pagerank": median_pr
    }
