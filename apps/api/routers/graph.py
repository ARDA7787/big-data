"""
Graph exploration endpoints.
"""

from typing import Optional, List

from fastapi import APIRouter, Request, Query, HTTPException
from pydantic import BaseModel

router = APIRouter()


class GraphNode(BaseModel):
    """Node in the citation graph."""
    id: str
    title: str
    year: Optional[int] = None
    pagerank: Optional[float] = None
    citation_count: Optional[int] = None
    community_id: Optional[int] = None


class GraphEdge(BaseModel):
    """Edge in the citation graph."""
    source: str
    target: str


class GraphStats(BaseModel):
    """Graph statistics."""
    total_nodes: int
    total_edges: int
    hops: int
    truncated: bool


class GraphNeighborhood(BaseModel):
    """Citation neighborhood of a paper."""
    center: GraphNode
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: GraphStats


@router.get("/neighborhood/{work_id}", response_model=GraphNeighborhood)
async def get_citation_neighborhood(
    request: Request,
    work_id: str,
    hops: int = Query(1, ge=1, le=3, description="Number of hops from center"),
    max_nodes: int = Query(50, ge=10, le=200, description="Maximum nodes to return"),
    direction: str = Query("both", description="Direction: both, citing, cited"),
    year_from: Optional[int] = Query(None, ge=1900, le=2100),
    year_to: Optional[int] = Query(None, ge=1900, le=2100)
):
    """
    Get the citation neighborhood of a paper.
    
    Returns nodes and edges for force-directed graph visualization.
    The center node is the queried paper.
    """
    data_service = request.app.state.data_service
    
    # Get center node
    center = data_service.get_work_by_id(work_id)
    if not center:
        raise HTTPException(status_code=404, detail="Work not found")
    
    # Get neighborhood
    neighborhood = data_service.get_citation_neighborhood(
        work_id=work_id,
        hops=hops,
        max_nodes=max_nodes,
        direction=direction,
        year_from=year_from,
        year_to=year_to
    )
    
    # Build response
    nodes = [GraphNode(
        id=n.get("work_id", ""),
        title=n.get("title", ""),
        year=n.get("year"),
        pagerank=n.get("pagerank"),
        citation_count=n.get("citation_count"),
        community_id=n.get("community_id")
    ) for n in neighborhood.get("nodes", [])]
    
    edges = [GraphEdge(
        source=e.get("source", ""),
        target=e.get("target", "")
    ) for e in neighborhood.get("edges", [])]
    
    return GraphNeighborhood(
        center=GraphNode(
            id=center.get("work_id", work_id),
            title=center.get("title", ""),
            year=center.get("year"),
            pagerank=center.get("pagerank"),
            citation_count=center.get("citation_count"),
            community_id=center.get("community_id")
        ),
        nodes=nodes,
        edges=edges,
        stats=GraphStats(
            total_nodes=len(nodes),
            total_edges=len(edges),
            hops=hops,
            truncated=neighborhood.get("truncated", False)
        )
    )


@router.get("/community/{community_id}")
async def get_community_subgraph(
    request: Request,
    community_id: int,
    max_nodes: int = Query(100, ge=10, le=500),
    sample_method: str = Query("pagerank", description="Sampling method: pagerank or random")
):
    """
    Get the subgraph of a specific community.
    
    Returns top nodes within the community and edges between them.
    """
    data_service = request.app.state.data_service
    
    result = data_service.get_community_subgraph(
        community_id=community_id,
        max_nodes=max_nodes,
        sample_method=sample_method
    )
    
    nodes = [GraphNode(
        id=n.get("work_id", ""),
        title=n.get("title", ""),
        year=n.get("year"),
        pagerank=n.get("pagerank"),
        citation_count=n.get("citation_count")
    ) for n in result.get("nodes", [])]
    
    edges = [GraphEdge(
        source=e.get("source", ""),
        target=e.get("target", "")
    ) for e in result.get("edges", [])]
    
    return {
        "community_id": community_id,
        "nodes": nodes,
        "edges": edges,
        "stats": result.get("stats", {})
    }


@router.get("/path")
async def find_citation_path(
    request: Request,
    source_id: str = Query(..., description="Starting paper ID"),
    target_id: str = Query(..., description="Target paper ID"),
    max_depth: int = Query(5, ge=1, le=10, description="Maximum path length")
):
    """
    Find the shortest citation path between two papers.
    
    Returns the path if one exists within max_depth hops.
    """
    data_service = request.app.state.data_service
    
    # Verify both papers exist
    source = data_service.get_work_by_id(source_id)
    target = data_service.get_work_by_id(target_id)
    
    if not source:
        raise HTTPException(status_code=404, detail="Source paper not found")
    if not target:
        raise HTTPException(status_code=404, detail="Target paper not found")
    
    # Find path
    path = data_service.find_citation_path(
        source_id=source_id,
        target_id=target_id,
        max_depth=max_depth
    )
    
    if path is None:
        return {
            "found": False,
            "source": source_id,
            "target": target_id,
            "message": f"No path found within {max_depth} hops"
        }
    
    # Get details for each paper in path
    path_details = []
    for work_id in path:
        work = data_service.get_work_by_id(work_id)
        if work:
            path_details.append({
                "work_id": work_id,
                "title": work.get("title", ""),
                "year": work.get("year")
            })
    
    return {
        "found": True,
        "path_length": len(path) - 1,
        "path": path_details
    }


@router.get("/stats")
async def get_graph_stats(request: Request):
    """
    Get overall graph statistics.
    
    Returns node count, edge count, density, and community info.
    """
    data_service = request.app.state.data_service
    
    stats = data_service.get_graph_stats()
    
    return {
        "nodes": stats.get("total_nodes", 0),
        "edges": stats.get("total_edges", 0),
        "communities": stats.get("num_communities", 0),
        "avg_degree": round(stats.get("avg_degree", 0), 2),
        "density": stats.get("density", 0)
    }


@router.get("/sample")
async def get_random_sample(
    request: Request,
    size: int = Query(20, ge=5, le=100),
    min_citations: int = Query(0, ge=0)
):
    """
    Get a random sample of papers for exploration.
    
    Useful for getting starting points for graph exploration.
    """
    data_service = request.app.state.data_service
    
    papers = data_service.get_top_papers(
        sort_by="pagerank",
        limit=size * 2  # Get more and sample
    )
    
    # Filter by min citations and take first N
    filtered = [
        p for p in papers 
        if p.get("citation_count", 0) >= min_citations
    ][:size]
    
    return {
        "papers": [
            {
                "work_id": p.get("work_id"),
                "title": p.get("title"),
                "year": p.get("year"),
                "citation_count": p.get("citation_count"),
                "pagerank": p.get("pagerank")
            }
            for p in filtered
        ]
    }
