from fastapi import APIRouter, HTTPException
from app.models.schemas import SubscribeRequest, SubscribeResponse, SubscriptionStatusResponse
from typing import Dict, Any

router = APIRouter(prefix="/subscribe", tags=["Subscription"])

@router.post("", response_model=SubscribeResponse)
async def subscribe_alerts(request: SubscribeRequest):
    """
    Subscribe phone alerts for industry tags.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.delete("")
async def unsubscribe_alerts():
    """
    Unsubscribe from all alerts.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_subscription_status():
    """
    Check subscription status.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")
