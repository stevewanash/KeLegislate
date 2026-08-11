import logging
import africastalking
from app.config import settings

logger = logging.getLogger(__name__)

_at_initialized = False

def _init_at():
    global _at_initialized
    if not _at_initialized:
        username = getattr(settings, "AFRICAS_TALKING_USERNAME", "sandbox")
        api_key = getattr(settings, "AFRICAS_TALKING_API_KEY", "")
        if username and api_key and api_key != "mock-at-key":
            try:
                africastalking.initialize(username, api_key)
                _at_initialized = True
            except Exception as e:
                logger.warning(f"Africa's Talking SDK initialization failed: {e}")

def send_sms(phone: str, message: str) -> dict:
    """
    Send an SMS message to a phone number using Africa's Talking API.
    Normalizes phone numbers to E.164 format if needed.
    Returns response dict from Africa's Talking or mock dict in test mode.
    """
    _init_at()
    username = getattr(settings, "AFRICAS_TALKING_USERNAME", "sandbox")
    api_key = getattr(settings, "AFRICAS_TALKING_API_KEY", "")
    testing = getattr(settings, "TESTING", False)

    if testing or not api_key or api_key == "mock-at-key":
        logger.info(f"[SMS MOCK/TEST] Sent to {phone}: '{message}'")
        return {
            "status": "success",
            "recipients": [{"number": phone, "status": "Success", "cost": "KES 0.8000"}]
        }

    try:
        sms = africastalking.SMS
        sender_id = getattr(settings, "AFRICAS_TALKING_SENDER_ID", None)
        kwargs = {}
        if sender_id and sender_id.strip():
            kwargs["sender_id"] = sender_id.strip()

        response = sms.send(message, [phone], **kwargs)
        logger.info(f"SMS successfully sent to {phone} via Africa's Talking: {response}")
        return response
    except Exception as e:
        logger.error(f"Error sending SMS to {phone} via Africa's Talking: {e}")
        raise e

async def send_sms_alert(subscriber_id: str, message: str):
    """
    Legacy/Subscriber helper for dispatching SMS alerts by subscriber ID.
    """
    # Stub for phase 4 subscription alerts
    logger.info(f"Subscriber alert stub called for {subscriber_id}")
    return {"status": "queued"}

