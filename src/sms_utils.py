"""
SMS integration module for KeLegislate v2 using Africa's Talking (Sandbox).
Handles phone validation, subscriber alerts, and broadcast dispatch.
"""

import re
import streamlit as st


# ---------------------------------------------------------------------------
# Phone Number Validation & Normalisation (W8)
# ---------------------------------------------------------------------------

def normalize_phone(raw: str) -> str | None:
    """
    Normalize a Kenyan phone number to E.164 format (+254XXXXXXXXX).
    Accepts: +254XXXXXXXXX, 0XXXXXXXXX, 254XXXXXXXXX
    Returns None if the number is invalid.
    """
    cleaned = re.sub(r'[\s\-().]', '', raw.strip())

    if re.match(r'^\+254\d{9}$', cleaned):
        return cleaned
    if re.match(r'^0\d{9}$', cleaned):
        return '+254' + cleaned[1:]
    if re.match(r'^254\d{9}$', cleaned):
        return '+' + cleaned

    return None  # Invalid


# ---------------------------------------------------------------------------
# Africa's Talking SDK Initialisation
# ---------------------------------------------------------------------------

def _get_sms_service():
    """
    Initialise the Africa's Talking SDK and return the SMS service object.
    Reads credentials from Streamlit secrets.
    Returns (sms_service, error_message) — error_message is None on success.
    """
    try:
        username = st.secrets["AFRICASTALKING_USERNAME"]
        api_key = st.secrets["AFRICASTALKING_API_KEY"]
    except KeyError as e:
        return None, f"Missing Africa's Talking secret: {e}. Add it to .streamlit/secrets.toml."

    try:
        import africastalking
        africastalking.initialize(username, api_key)
        sms = africastalking.SMS
        return sms, None
    except Exception as e:
        return None, f"Africa's Talking SDK initialisation failed: {e}"


# ---------------------------------------------------------------------------
# Message Formatting
# ---------------------------------------------------------------------------

_MAX_SMS_CHARS = 480  # 3 SMS segments @ 160 chars each


def _format_alert(bill_title: str, impact_snippet: str, language: str) -> str:
    """
    Format an SMS-friendly alert.
    Keeps it under 480 chars (3 segments) so costs stay predictable.
    """
    if language == "Swahili":
        header = f"🚨 KeLegislate Tahadhari:\n*{bill_title}*\n"
        footer = "\nTembelea app kwa maelezo zaidi: KeLegislate.app"
    else:
        header = f"🚨 KeLegislate Alert:\n*{bill_title}*\n"
        footer = "\nSee full analysis at: KeLegislate.app"

    max_body = _MAX_SMS_CHARS - len(header) - len(footer)
    body = impact_snippet[:max_body].strip()

    return header + body + footer


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_impact_alert(phone_number: str, bill_title: str, impact_snippet: str, language: str = "English") -> dict:
    """
    Send a single SMS impact alert to one subscriber.

    Args:
        phone_number:   E.164 formatted number (+254XXXXXXXXX)
        bill_title:     Title of the bill being alerted
        impact_snippet: Short plain-text description of the financial impact
        language:       "English" or "Swahili"

    Returns:
        dict with keys: success (bool), message (str), at_response (dict|None)
    """
    sms, error = _get_sms_service()
    if error:
        return {"success": False, "message": error, "at_response": None}

    body = _format_alert(bill_title, impact_snippet, language)

    try:
        response = sms.send(body, [phone_number])
        # AT returns: {"SMSMessageData": {"Recipients": [{"status": "Success", ...}]}}
        recipients = response.get("SMSMessageData", {}).get("Recipients", [])
        if recipients and recipients[0].get("status") == "Success":
            return {"success": True, "message": "SMS sent successfully.", "at_response": response}
        else:
            status = recipients[0].get("status", "Unknown") if recipients else "No recipients returned"
            return {"success": False, "message": f"AT API returned non-success status: {status}", "at_response": response}
    except Exception as e:
        return {"success": False, "message": f"SMS send error: {e}", "at_response": None}


def broadcast_to_subscribers(bill_title: str, bill_tags: list, subscribers: list, impact_snippet: str) -> dict:
    """
    Send an alert to all subscribers whose industry_tag matches one of the bill's tags.

    Args:
        bill_title:     Title of the bill
        bill_tags:      List of canonical industry tags on the bill
        subscribers:    List of subscriber dicts from Firestore
        impact_snippet: Short plain-text summary of the financial impact

    Returns:
        dict: {"sent": int, "failed": int, "skipped": int, "errors": list[str]}
    """
    results = {"sent": 0, "failed": 0, "skipped": 0, "errors": []}
    bill_tag_set = set(bill_tags)

    for sub in subscribers:
        # Match: subscriber's industry must overlap with bill's tags
        if sub.get("industry_tag") not in bill_tag_set:
            results["skipped"] += 1
            continue

        phone = sub.get("phone_number")
        language = sub.get("preferred_language", "English")

        if not phone:
            results["skipped"] += 1
            continue

        result = send_impact_alert(phone, bill_title, impact_snippet, language)
        if result["success"]:
            results["sent"] += 1
        else:
            results["failed"] += 1
            results["errors"].append(f"{phone}: {result['message']}")

    return results
