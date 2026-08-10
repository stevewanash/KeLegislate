import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_bills_offline_mock():
    with patch("app.api.bills.supabase_admin", None):
        response = client.get("/api/bills")
        assert response.status_code == 200
        data = response.json()
        assert "bills" in data
        assert "total" in data
        assert data["total"] == 2
        assert len(data["bills"]) == 2
        assert data["bills"][0]["title"] == "The Finance Bill, 2024"


def test_get_bills_with_supabase_mock():
    mock_bills_query = MagicMock()
    mock_bills_query.eq.return_value = mock_bills_query
    mock_bills_query.order.return_value = mock_bills_query
    mock_bills_query.range.return_value = mock_bills_query
    mock_bills_query.execute.return_value = MagicMock(
        data=[
            {
                "id": "bill-100",
                "title": "Test Bill 100",
                "bill_type": "financial",
                "created_at": "2026-08-09T23:00:00Z",
                "ai_status": "translated"
            }
        ],
        count=1
    )

    mock_tags_query = MagicMock()
    mock_tags_query.in_.return_value = mock_tags_query
    mock_tags_query.execute.return_value = MagicMock(
        data=[
            {"bill_id": "bill-100", "industry_tag": "Transport & Logistics"}
        ]
    )

    mock_supabase = MagicMock()
    def table_router(name):
        if name == "bills":
            mock_t = MagicMock()
            mock_t.select.return_value = mock_bills_query
            return mock_t
        elif name == "bill_tags":
            mock_t = MagicMock()
            mock_t.select.return_value = mock_tags_query
            return mock_t
        return MagicMock()

    mock_supabase.table.side_effect = table_router

    with patch("app.api.bills.supabase_admin", mock_supabase):
        response = client.get("/api/bills?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["bills"]) == 1
        assert data["bills"][0]["id"] == "bill-100"
        assert data["bills"][0]["tags"] == ["Transport & Logistics"]


def test_get_bills_industry_filter_empty():
    mock_supabase = MagicMock()
    mock_tag_query = MagicMock()
    mock_tag_query.eq.return_value = mock_tag_query
    mock_tag_query.execute.return_value = MagicMock(data=[])

    mock_supabase.table.return_value.select.return_value = mock_tag_query

    with patch("app.api.bills.supabase_admin", mock_supabase):
        response = client.get("/api/bills?industry=NonExistentIndustry")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["bills"] == []


def test_get_bill_detail_success():
    mock_supabase = MagicMock()
    
    mock_bills_table = MagicMock()
    mock_bills_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "bill-100",
                "title": "Test Bill 100",
                "bill_type": "financial",
                "ai_summary_en": "English summary here.",
                "ai_summary_sw": "Kiswahili summary here.",
                "regex_extractions": [{"value": "16%"}],
                "source_url": "https://parliament.go.ke/bill.pdf",
                "created_at": "2026-08-09T23:00:00Z"
            }
        ]
    )

    mock_tags_table = MagicMock()
    mock_tags_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"industry_tag": "Transport & Logistics"}]
    )

    def table_router(name):
        if name == "bills":
            return mock_bills_table
        elif name == "bill_tags":
            return mock_tags_table
        return MagicMock()

    mock_supabase.table.side_effect = table_router

    with patch("app.api.bills.supabase_admin", mock_supabase):
        response = client.get("/api/bills/bill-100")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "bill-100"
        assert data["title"] == "Test Bill 100"
        assert data["ai_summary_en"] == "English summary here."
        assert data["tags"] == ["Transport & Logistics"]


def test_get_bill_detail_404():
    mock_supabase = MagicMock()
    mock_bills_table = MagicMock()
    mock_bills_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = mock_bills_table

    with patch("app.api.bills.supabase_admin", mock_supabase):
        response = client.get("/api/bills/non-existent-bill")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


def test_post_impact_success():
    mock_supabase = MagicMock()
    mock_bills_table = MagicMock()
    mock_bills_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "bill-100",
                "title": "Finance Bill 2024",
                "bill_type": "financial",
                "ai_summary_en": "Summary text",
                "regex_extractions": [],
                "extracted_text": "Extracted text"
            }
        ]
    )
    mock_supabase.table.return_value = mock_bills_table

    payload = {
        "bill_id": "bill-100",
        "industry": "Transport & Logistics",
        "tier": "Tier 1 — BodaBoda Rider (Motorcycle)",
        "use_custom_profile": False
    }

    with patch("app.api.impact.supabase_admin", mock_supabase), \
         patch("app.api.impact.compute_financial_impact_analysis") as mock_compute:
        
        mock_compute.return_value = {
            "impact_table": [
                {
                    "description": "Fuel Levy Increase",
                    "base_kes": 12000.0,
                    "change_kes": 1200.0,
                    "period": "monthly",
                    "section_ref": "Section 42",
                    "math_breakdown": "12000 * 0.10 = 1200"
                }
            ],
            "net_monthly_impact": -1200.0,
            "compliance_checklist": [],
            "compliance_cost_total": 0.0,
            "penalty_risks": [],
            "bill_type": "financial",
            "risk_level": "MEDIUM",
            "verified": True,
            "disclaimer": "Test calculation"
        }

        response = client.post("/api/impact", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["bill_type"] == "financial"
        assert data["net_monthly_impact"] == -1200.0
        assert len(data["impact_table"]) == 1


def test_post_impact_bill_not_found_404():
    mock_supabase = MagicMock()
    mock_bills_table = MagicMock()
    mock_bills_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_supabase.table.return_value = mock_bills_table

    payload = {
        "bill_id": "missing-bill",
        "industry": "Transport & Logistics",
        "tier": "Tier 1",
        "use_custom_profile": False
    }

    with patch("app.api.impact.supabase_admin", mock_supabase):
        response = client.post("/api/impact", json=payload)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


def test_post_impact_unknown_industry_400():
    payload = {
        "bill_id": "bill-100",
        "industry": "Invalid Crypto Industry",
        "tier": "Tier 1",
        "use_custom_profile": False
    }
    response = client.post("/api/impact", json=payload)
    assert response.status_code == 400
    assert "unknown industry" in response.json()["detail"].lower()


def test_post_impact_timeout_504():
    import asyncio
    mock_supabase = MagicMock()
    mock_bills_table = MagicMock()
    mock_bills_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "bill-100", "title": "Bill", "bill_type": "financial", "ai_summary_en": "Summary", "regex_extractions": [], "extracted_text": "Text"}]
    )
    mock_supabase.table.return_value = mock_bills_table

    payload = {
        "bill_id": "bill-100",
        "industry": "Transport & Logistics",
        "tier": "Tier 1 — BodaBoda Rider (Motorcycle)",
        "use_custom_profile": False
    }

    with patch("app.api.impact.supabase_admin", mock_supabase), \
         patch("app.api.impact.asyncio.wait_for", side_effect=asyncio.TimeoutError):
        response = client.post("/api/impact", json=payload)
        assert response.status_code == 504
        assert "busy" in response.json()["detail"].lower()


def test_post_impact_db_unavailable_503():
    payload = {
        "bill_id": "production-bill-999",
        "industry": "Transport & Logistics",
        "tier": "Tier 1",
        "use_custom_profile": False
    }
    with patch("app.api.impact.supabase_admin", None), \
         patch("app.api.impact.settings.TESTING", False):
        response = client.post("/api/impact", json=payload)
        assert response.status_code == 503
        assert "not available" in response.json()["detail"].lower()


def test_post_impact_custom_profile_scoped():
    mock_supabase = MagicMock()
    mock_user = MagicMock()
    mock_user.user.id = "user-uuid-123"
    mock_supabase.auth.get_user.return_value = mock_user

    mock_profile_table = MagicMock()
    mock_profile_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "user_id": "user-uuid-123",
                "tier_label": "Custom Tier",
                "custom_metrics": {"vehicle_value_kes": 200000}
            }
        ]
    )
    mock_bills_table = MagicMock()
    mock_bills_table.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "bill-100", "title": "Bill", "bill_type": "financial", "ai_summary_en": "Summary", "regex_extractions": [], "extracted_text": "Text"}]
    )

    def table_router(name):
        if name == "user_profiles":
            return mock_profile_table
        elif name == "bills":
            return mock_bills_table
        return MagicMock()

    mock_supabase.table.side_effect = table_router

    payload = {
        "bill_id": "bill-100",
        "industry": "Transport & Logistics",
        "tier": "Tier 1",
        "use_custom_profile": True
    }
    headers = {"Authorization": "Bearer valid-user-jwt-token"}

    with patch("app.api.impact.supabase_admin", mock_supabase), \
         patch("app.api.impact.compute_financial_impact_analysis") as mock_compute:
        mock_compute.return_value = {
            "impact_table": [],
            "net_monthly_impact": 0.0,
            "compliance_checklist": [],
            "compliance_cost_total": 0.0,
            "penalty_risks": [],
            "bill_type": "financial",
            "risk_level": "LOW",
            "verified": True
        }
        response = client.post("/api/impact", json=payload, headers=headers)
        assert response.status_code == 200
        mock_supabase.auth.get_user.assert_called_once_with("valid-user-jwt-token")

