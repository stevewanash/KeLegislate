from fastapi import APIRouter, HTTPException, Header
from app.models.schemas import DeliveryReceiptRequest, SupabaseSmsWebhookPayload
from typing import Dict, Any

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/at-delivery")
async def at_delivery_webhook(receipt: DeliveryReceiptRequest):
    """
    Africa's Talking delivery receipts webhook.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.post("/auth/send-sms")
async def supabase_auth_send_sms(
    payload: SupabaseSmsWebhookPayload,
    x_supabase_webhook_secret: str = Header(None, alias="x-supabase-webhook-secret")
):
    """
    Custom SMS OTP gateway webhook invoked by Supabase Auth.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

# ==========================================
# Tasks / Admin Stub routes
# ==========================================
@router.post("/tasks/scrape")
async def trigger_scraper(authorization: str = Header(None)):
    """
    Trigger parliamentary bill scraping.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.post("/admin/run-pipeline/{bill_id}")
async def run_admin_pipeline(bill_id: str):
    """
    Manual pipeline run for a specific bill.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")
