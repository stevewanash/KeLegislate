from fastapi import APIRouter, HTTPException
from app.models.schemas import ImpactRequest, ImpactResponse

router = APIRouter(prefix="/impact", tags=["Impact"])

@router.post("", response_model=ImpactResponse)
async def calculate_impact(request: ImpactRequest):
    """
    Calculate the personalized financial impact of a bill.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")
