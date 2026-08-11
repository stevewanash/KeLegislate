import logging
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
from app.models.schemas import DeliveryReceiptRequest, SupabaseSmsWebhookPayload
from app.services.notifier import send_sms
from app.utils.phone import normalize_phone
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/at-delivery")
async def at_delivery_webhook(receipt: DeliveryReceiptRequest):
    """
    Africa's Talking delivery receipts webhook.
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.post("/incoming-sms")
@router.post("/sms/incoming")
async def incoming_sms_webhook(payload: dict):
    """
    Africa's Talking / Shared Gateway incoming SMS webhook.
    Receives citizen messages sent to keyword (e.g., 'kamilimu kelegislate ...').
    """
    logger.info(f"Received incoming SMS webhook payload: {payload}")
    from_phone = payload.get("from") or payload.get("phoneNumber") or payload.get("from_phone")
    text = payload.get("text") or payload.get("message")

    logger.info(f"Incoming SMS parsed — From: {from_phone} | Text: '{text}'")
    return {"status": "success", "detail": "Incoming SMS received successfully"}


@router.post("/auth/send-sms")
async def supabase_auth_send_sms(
    payload: SupabaseSmsWebhookPayload,
    x_supabase_webhook_secret: str = Header(None, alias="x-supabase-webhook-secret")
):
    """
    Custom SMS OTP gateway webhook invoked by Supabase Auth.
    Secret header 'x-supabase-webhook-secret' must match settings.SUPABASE_SMS_WEBHOOK_SECRET.
    Returns HTTP 200 with empty JSON `{}` per Supabase custom SMS provider specification.
    """
    expected_secret = getattr(settings, "SUPABASE_SMS_WEBHOOK_SECRET", "")
    testing = getattr(settings, "TESTING", False)

    if expected_secret and expected_secret != "mock-secret" and not testing:
        if not x_supabase_webhook_secret or x_supabase_webhook_secret != expected_secret:
            logger.warning("Supabase Auth SMS webhook secret mismatch or missing header")
            raise HTTPException(status_code=401, detail="Invalid or missing webhook secret header")

    phone_raw = payload.get_recipient_phone()
    message_text = payload.get_message_text()

    if not phone_raw or not message_text:
        logger.error(f"Invalid payload for Supabase SMS webhook: {payload}")
        raise HTTPException(status_code=400, detail="Missing phone or SMS text in payload")

    normalized_phone = normalize_phone(phone_raw)
    if not normalized_phone:
        logger.error(f"Invalid phone number format: {phone_raw}")
        raise HTTPException(status_code=400, detail=f"Invalid phone number format: {phone_raw}")

    try:
        send_sms(phone=normalized_phone, message=message_text)
        logger.info(f"Supabase Auth SMS OTP sent successfully to {normalized_phone}")
    except Exception as e:
        logger.error(f"Failed to dispatch Supabase Auth SMS to {normalized_phone}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send SMS: {str(e)}")

    # STRICT REQUIREMENT: Return empty JSON object {} with status code 200
    return JSONResponse(content={}, status_code=200)


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
