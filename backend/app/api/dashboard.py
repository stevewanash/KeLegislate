from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import DashboardStatsResponse
from typing import Optional

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(bill_id: Optional[str] = Query(None)):
    """
    Get aggregated dashboard stats for a bill or global stats.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")
