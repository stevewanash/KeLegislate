import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

TEST_SECRET = "test-webhook-secret-123"

def test_supabase_auth_send_sms_flat_payload_success():
    payload = {
        "type": "sms",
        "phone": "+254712345678",
        "text": "Your Hustle Yetu verification code is: 123456"
    }
    headers = {"x-supabase-webhook-secret": TEST_SECRET}

    with patch("app.api.webhooks.settings.SUPABASE_SMS_WEBHOOK_SECRET", TEST_SECRET), \
         patch("app.api.webhooks.settings.TESTING", False), \
         patch("app.api.webhooks.send_sms") as mock_send_sms:
        
        mock_send_sms.return_value = {"status": "success"}

        response = client.post("/api/webhooks/auth/send-sms", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json() == {}
        mock_send_sms.assert_called_once_with(phone="+254712345678", message="Your Hustle Yetu verification code is: 123456")


def test_supabase_auth_send_sms_nested_payload_success():
    payload = {
        "type": "sms",
        "user": {"phone": "0712345678"},
        "sms": {"otp": "654321"}
    }
    headers = {"x-supabase-webhook-secret": TEST_SECRET}

    with patch("app.api.webhooks.settings.SUPABASE_SMS_WEBHOOK_SECRET", TEST_SECRET), \
         patch("app.api.webhooks.settings.TESTING", False), \
         patch("app.api.webhooks.send_sms") as mock_send_sms:

        mock_send_sms.return_value = {"status": "success"}

        response = client.post("/api/webhooks/auth/send-sms", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json() == {}
        mock_send_sms.assert_called_once_with(phone="+254712345678", message="Your Hustle Yetu verification code is: 654321")


def test_supabase_auth_send_sms_unauthorized():
    payload = {
        "phone": "+254712345678",
        "text": "Your code is 123456"
    }
    headers = {"x-supabase-webhook-secret": "wrong-secret"}

    with patch("app.api.webhooks.settings.SUPABASE_SMS_WEBHOOK_SECRET", TEST_SECRET), \
         patch("app.api.webhooks.settings.TESTING", False):

        response = client.post("/api/webhooks/auth/send-sms", json=payload, headers=headers)
        assert response.status_code == 401
        assert "invalid or missing" in response.json()["detail"].lower()


def test_supabase_auth_send_sms_invalid_phone():
    payload = {
        "phone": "not-a-phone-number",
        "text": "Your code is 123456"
    }
    headers = {"x-supabase-webhook-secret": TEST_SECRET}

    with patch("app.api.webhooks.settings.SUPABASE_SMS_WEBHOOK_SECRET", TEST_SECRET), \
         patch("app.api.webhooks.settings.TESTING", False):

        response = client.post("/api/webhooks/auth/send-sms", json=payload, headers=headers)
        assert response.status_code == 400
        assert "invalid phone" in response.json()["detail"].lower()


def test_supabase_auth_send_sms_direct_alias_route():
    payload = {
        "phone": "+254700000000",
        "text": "Verification code: 123456"
    }
    headers = {"x-supabase-webhook-secret": TEST_SECRET}

    with patch("app.api.webhooks.settings.SUPABASE_SMS_WEBHOOK_SECRET", TEST_SECRET), \
         patch("app.api.webhooks.settings.TESTING", False), \
         patch("app.api.webhooks.send_sms") as mock_send_sms:

        mock_send_sms.return_value = {"status": "success"}

        response = client.post("/api/auth/send-sms", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json() == {}
        mock_send_sms.assert_called_once_with(phone="+254700000000", message="Verification code: 123456")


def test_supabase_auth_send_sms_bearer_token():
    payload = {
        "phone": "+254711223344",
        "text": "Verification code: 888888"
    }
    headers = {"Authorization": f"Bearer {TEST_SECRET}"}

    with patch("app.api.webhooks.settings.SUPABASE_SMS_WEBHOOK_SECRET", TEST_SECRET), \
         patch("app.api.webhooks.settings.TESTING", False), \
         patch("app.api.webhooks.send_sms") as mock_send_sms:

        mock_send_sms.return_value = {"status": "success"}

        response = client.post("/api/webhooks/auth/send-sms", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json() == {}
        mock_send_sms.assert_called_once_with(phone="+254711223344", message="Verification code: 888888")


def test_supabase_auth_send_sms_svix_signature():
    import hmac
    import hashlib
    import base64
    import json

    raw_secret_b64 = "c29tZXNlY3JldGtleWZvcnRlc3Rpbmc="  # base64 encoded secret
    full_secret = f"v1,whsec_{raw_secret_b64}"
    msg_id = "msg_test_12345"
    msg_timestamp = "1785148000"
    payload = {
        "phone": "+254711998877",
        "text": "Verification code: 999999"
    }
    raw_body = json.dumps(payload).encode("utf-8")
    
    secret_bytes = base64.b64decode(raw_secret_b64)
    to_sign = f"{msg_id}.{msg_timestamp}.".encode("utf-8") + raw_body
    sig = base64.b64encode(hmac.new(secret_bytes, to_sign, hashlib.sha256).digest()).decode("utf-8")

    headers = {
        "webhook-id": msg_id,
        "webhook-timestamp": msg_timestamp,
        "webhook-signature": f"v1,{sig}",
        "Content-Type": "application/json"
    }

    with patch("app.api.webhooks.settings.SUPABASE_SMS_WEBHOOK_SECRET", full_secret), \
         patch("app.api.webhooks.settings.TESTING", False), \
         patch("app.api.webhooks.send_sms") as mock_send_sms:

        mock_send_sms.return_value = {"status": "success"}

        response = client.post("/api/webhooks/auth/send-sms", content=raw_body, headers=headers)
        assert response.status_code == 200
        assert response.json() == {}
        mock_send_sms.assert_called_once_with(phone="+254711998877", message="Verification code: 999999")

