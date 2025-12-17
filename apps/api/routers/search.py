"""
Search endpoints powered by Elasticsearch.
"""

from typing import Optional, List

from fastapi import APIRouter, Request, Query, HTTPException
from pydantic import BaseModel

from config import settings

router = APIRouter()


class SearchResult(BaseModel):
    """Search result item."""
    work_id: str
    title: str
    abstract: Optional[str] = None
    year: Optional[int] = None
    source: Optional[str] = None
    primary_field: Optional[str] = None
    doi: Optional[str] = None
    pagerank: Optional[float] = None
    citation_count: Optional[int] = None
    authors: Optional[List[str]] = None
    venue_name: Optional[str] = None
    score: float


class SearchResponse(BaseModel):
    """Search response with results and metadata."""
    query: str
    total: int
    page: int
    page_size: int
    results: List[SearchResult]
    facets: Optional[dict] = None


@router.get("", response_model=SearchResponse)
async def search_works(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query"),
    year_from: Optional[int] = Query(None, ge=1900, le=2100, description="Start year"),
    year_to: Optional[int] = Query(None, ge=1900, le=2100, description="End year"),
    source: Optional[str] = Query(None, description="Source filter (arxiv, pubmed, openalex)"),
    field: Optional[str] = Query(None, description="Field/category filter"),
    sort_by: str = Query("relevance", description="Sort by: relevance, year, citations, pagerank"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Results per page")
):
    """
    Search for works by query with optional filters.
    
    Searches across title and abstract with support for:
    - Year range filtering
    - Source filtering (arXiv, PubMed, OpenAlex)
    - Field/topic filtering
    - Multiple sort options
    """
    es_service = request.app.state.es_service
    
    # Build Elasticsearch query
    must_clauses = [
        {
            "multi_match": {
                "query": q,
                "fields": ["title^3", "abstract", "primary_field^2"],
                "type": "best_fields",
                "fuzziness": "AUTO"
            }
        }
    ]
    
    filter_clauses = []
    
    # Year range filter
    if year_from or year_to:
        range_filter = {"range": {"year": {}}}
        if year_from:
            range_filter["range"]["year"]["gte"] = year_from
        if year_to:
            range_filter["range"]["year"]["lte"] = year_to
        filter_clauses.append(range_filter)
    
    # Source filter
    if source:
        filter_clauses.append({"term": {"source": source.lower()}})
    
    # Field filter
    if field:
        filter_clauses.append({"term": {"primary_field.keyword": field}})
    
    # Build sort
    sort_options = {
        "relevance": [{"_score": "desc"}],
        "year": [{"year": "desc"}, {"_score": "desc"}],
        "citations": [{"citation_count": "desc"}, {"_score": "desc"}],
        "pagerank": [{"pagerank": "desc"}, {"_score": "desc"}]
    }
    sort = sort_options.get(sort_by, sort_options["relevance"])
    
    # Execute search
    try:
        results = await es_service.search(
            query={
                "bool": {
                    "must": must_clauses,
                    "filter": filter_clauses
                }
            },
            sort=sort,
            from_=(page - 1) * page_size,
            size=page_size,
            aggs={
                "years": {"terms": {"field": "year", "size": 20}},
                "sources": {"terms": {"field": "source", "size": 10}},
                "fields": {"terms": {"field": "primary_field.keyword", "size": 20}}
            },
            _source=["work_id", "title", "abstract", "year", "source", 
                     "primary_field", "doi", "pagerank", "citation_count",
                     "authors", "venue_name"]
        )
    except Exception as e:
        # Fallback to data service if ES is unavailable
        data_service = request.app.state.data_service
        results = data_service.search_works(
            query=q,
            year_from=year_from,
            year_to=year_to,
            source=source,
            page=page,
            page_size=page_size
        )
        return SearchResponse(
            query=q,
            total=results["total"],
            page=page,
            page_size=page_size,
            results=[SearchResult(**r) for r in results["results"]],
            facets=None
        )
    
    # Parse results
    hits = results.get("hits", {})
    total = hits.get("total", {}).get("value", 0)
    
    search_results = []
    for hit in hits.get("hits", []):
        source_data = hit.get("_source", {})
        # Parse authors - can be list of dicts or strings
        authors_raw = source_data.get("authors", [])
        authors = []
        if authors_raw:
            for a in authors_raw[:5]:  # Limit to 5 authors
                if isinstance(a, dict):
                    authors.append(a.get("name", str(a)))
                else:
                    authors.append(str(a))
        search_results.append(SearchResult(
            work_id=source_data.get("work_id", hit.get("_id")),
            title=source_data.get("title", ""),
            abstract=source_data.get("abstract"),
            year=source_data.get("year"),
            source=source_data.get("source"),
            primary_field=source_data.get("primary_field"),
            doi=source_data.get("doi"),
            pagerank=source_data.get("pagerank"),
            citation_count=source_data.get("citation_count"),
            authors=authors if authors else None,
            venue_name=source_data.get("venue_name"),
            score=hit.get("_score", 0)
        ))
    
    # Parse facets
    aggs = results.get("aggregations", {})
    facets = {
        "years": [
            {"value": b["key"], "count": b["doc_count"]}
            for b in aggs.get("years", {}).get("buckets", [])
        ],
        "sources": [
            {"value": b["key"], "count": b["doc_count"]}
            for b in aggs.get("sources", {}).get("buckets", [])
        ],
        "fields": [
            {"value": b["key"], "count": b["doc_count"]}
            for b in aggs.get("fields", {}).get("buckets", [])
        ]
    }
    
    return SearchResponse(
        query=q,
        total=total,
        page=page,
        page_size=page_size,
        results=search_results,
        facets=facets
    )


@router.get("/suggest")
async def suggest(
    request: Request,
    q: str = Query(..., min_length=2, description="Partial query for suggestions")
):
    """Get search suggestions based on partial query."""
    es_service = request.app.state.es_service
    
    try:
        results = await es_service.search(
            query={
                "multi_match": {
                    "query": q,
                    "fields": ["title^2", "primary_field"],
                    "type": "phrase_prefix"
                }
            },
            size=10,
            _source=["title", "primary_field"]
        )
        
        suggestions = []
        seen = set()
        
        for hit in results.get("hits", {}).get("hits", []):
            title = hit.get("_source", {}).get("title", "")
            if title and title not in seen:
                suggestions.append(title[:100])
                seen.add(title)
        
        return {"suggestions": suggestions[:5]}
        
    except Exception:
        return {"suggestions": []}

