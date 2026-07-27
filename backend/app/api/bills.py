from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import BillListResponse, BillDetailResponse
from typing import Optional

router = APIRouter(prefix="/bills", tags=["Bills"])

@router.get("", response_model=BillListResponse)
async def get_bills(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    industry: Optional[str] = None
):
    """
    Get a paginated list of bills.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.get("/{bill_id}", response_model=BillDetailResponse)
async def get_bill(bill_id: str):
    """
    Get full details of a specific bill.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")
