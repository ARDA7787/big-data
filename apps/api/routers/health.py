"""
Health check endpoint.
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    elasticsearch: str
    data: str


@router.get("", response_model=HealthResponse)
async def health_check(request: Request):
    """
    Check the health of all services.
    
    Returns status of:
    - API service
    - Elasticsearch connection
    - Data availability
    """
    es_status = "unknown"
    data_status = "unknown"
    
    # Check Elasticsearch
    try:
        es_service = request.app.state.es_service
        if await es_service.health_check():
            es_status = "healthy"
        else:
            es_status = "unhealthy"
    except Exception as e:
        es_status = f"error: {str(e)[:50]}"
    
    # Check data availability
    try:
        data_service = request.app.state.data_service
        if data_service.health_check():
            data_status = "healthy"
        else:
            data_status = "no data"
    except Exception as e:
        data_status = f"error: {str(e)[:50]}"
    
    overall_status = "healthy" if es_status == "healthy" or data_status == "healthy" else "degraded"
    
    return HealthResponse(
        status=overall_status,
        elasticsearch=es_status,
        data=data_status
    )


@router.get("/ready")
async def readiness_check(request: Request):
    """
    Kubernetes-style readiness probe.
    Returns 200 if service is ready to accept traffic.
    """
    try:
        data_service = request.app.state.data_service
        if data_service.health_check():
            return {"ready": True}
    except Exception:
        pass
    
    return {"ready": False}


@router.get("/live")
async def liveness_check():
    """
    Kubernetes-style liveness probe.
    Returns 200 if service is alive.
    """
    return {"alive": True}
