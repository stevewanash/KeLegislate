import json
import pytest
from unittest.mock import patch, MagicMock

from app.agents.impact_agent import (
    compute_financial_impact_analysis,
    compute_financial_impact,
    _verify_and_recalculate_math,
)
from app.agents.gemini_client import GeminiResponse
from app.models.schemas import ImpactResponse, ImpactItem, ComplianceItem, PenaltyRisk
from app.models.hustle_profiles import HUSTLE_PROFILES


@pytest.fixture
def sample_financial_bill():
    return {
        "id": "bill-101",
        "title": "Finance Bill 2024",
        "bill_type": "financial",
        "ai_summary_en": "Introduces a 2.5% motor vehicle circulation tax based on vehicle value.",
        "regex_extractions": [
            {
                "type": "percentage",
                "value": 2.5,
                "raw": "2.5%",
                "context": "motor vehicle circulation tax at 2.5%",
            }
        ],
    }


@pytest.fixture
def sample_regulatory_bill():
    return {
        "id": "bill-102",
        "title": "Nairobi Boda Boda Permit Regulations 2025",
        "bill_type": "regulatory",
        "ai_summary_en": "Mandates annual county operating permit (KES 3000) and mandatory safety training.",
        "regex_extractions": [
            {
                "type": "currency",
                "value": 3000.0,
                "raw": "3,000 shillings",
                "context": "annual permit fee of KES 3,000",
            }
        ],
    }


@pytest.fixture
def sample_bodaboda_profile():
    return HUSTLE_PROFILES["Transport & Logistics"][0]


def test_compute_financial_impact_financial_bill(sample_financial_bill, sample_bodaboda_profile):
    """Test computing financial impact analysis for a financial bill."""
    mock_impact = ImpactResponse(
        bill_type="financial",
        impact_table=[
            ImpactItem(
                description="Motor Vehicle Tax (2.5% of KES 150,000)",
                base_kes=150000.0,
                change_kes=3750.0,
                period="annual",
                section_ref="Section 42",
                math_breakdown="150000 * 0.025",
            )
        ],
        net_monthly_impact=312.5,
        risk_level="MEDIUM",
        verified=True,
        disclaimer="Test disclaimer",
    )

    with patch("app.agents.impact_agent.call_gemini") as mock_call:
        mock_call.return_value = GeminiResponse(
            text="Mock text",
            parsed=mock_impact,
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
            latency_ms=250.0,
            model_name="gemini-3.5-flash",
        )

        res = compute_financial_impact_analysis(sample_financial_bill, sample_bodaboda_profile)

        assert isinstance(res, ImpactResponse)
        assert res.bill_type == "financial"
        assert res.risk_level == "MEDIUM"
        assert len(res.impact_table) == 1
        assert res.impact_table[0].change_kes == 3750.0
        assert res.net_monthly_impact == 312.5


def test_compute_financial_impact_regulatory_bill(sample_regulatory_bill, sample_bodaboda_profile):
    """Test computing compliance advice for a regulatory bill."""
    mock_impact = ImpactResponse(
        bill_type="regulatory",
        compliance_checklist=[
            ComplianceItem(
                requirement="Obtain annual boda boda operating permit",
                status="required",
                deadline="2026-06-30",
                estimated_cost_kes=3000.0,
                penalty_for_non_compliance="Impoundment of motorcycle and KES 10,000 fine",
            )
        ],
        compliance_cost_total=3000.0,
        penalty_risks=[
            PenaltyRisk(
                violation="Operating without valid county permit badge",
                penalty="KES 10,000 fine",
                severity="HIGH",
            )
        ],
        risk_level="HIGH",
        verified=True,
    )

    with patch("app.agents.impact_agent.call_gemini") as mock_call:
        mock_call.return_value = GeminiResponse(
            text="Mock text",
            parsed=mock_impact,
            prompt_tokens=120,
            completion_tokens=60,
            total_tokens=180,
            latency_ms=300.0,
            model_name="gemini-3.5-flash",
        )

        res = compute_financial_impact_analysis(sample_regulatory_bill, sample_bodaboda_profile)

        assert isinstance(res, ImpactResponse)
        assert res.bill_type == "regulatory"
        assert len(res.compliance_checklist) == 1
        assert res.compliance_checklist[0].estimated_cost_kes == 3000.0
        assert res.compliance_cost_total == 3000.0
        assert len(res.penalty_risks) == 1


def test_verify_and_recalculate_math():
    """Test AST math breakdown recalculation helper."""
    impact_obj = ImpactResponse(
        bill_type="financial",
        impact_table=[
            ImpactItem(
                description="Item 1",
                base_kes=100.0,
                change_kes=0.0,
                period="monthly",
                section_ref="Sec 1",
                math_breakdown="12000 / 12",
            ),
            ImpactItem(
                description="Item 2",
                base_kes=500.0,
                change_kes=0.0,
                period="annual",
                section_ref="Sec 2",
                math_breakdown="6000 * 0.1",
            ),
        ],
        net_monthly_impact=0.0,
        risk_level="LOW",
        verified=True,
    )

    _verify_and_recalculate_math(impact_obj)

    # Item 1: 12000 / 12 = 1000.0 monthly
    assert impact_obj.impact_table[0].change_kes == 1000.0
    # Item 2: 6000 * 0.1 = 600.0 annual -> 50.0 monthly
    assert impact_obj.impact_table[1].change_kes == 600.0

    # Total net monthly = 1000.0 + 50.0 = 1050.0
    assert impact_obj.net_monthly_impact == 1050.0


def test_compute_financial_impact_call_gemini_exception(sample_financial_bill, sample_bodaboda_profile):
    """Test handling when call_gemini raises an exception (Issue 1 fix)."""
    with patch("app.agents.impact_agent.call_gemini", side_effect=RuntimeError("API 403 Forbidden")):
        res = compute_financial_impact_analysis(sample_financial_bill, sample_bodaboda_profile)
        assert isinstance(res, ImpactResponse)
        assert res.bill_type == "financial"
        assert res.risk_level == "LOW"
        assert res.verified is True


def test_compute_financial_impact_text_json_fallback(sample_financial_bill, sample_bodaboda_profile):
    """Test JSON text parsing fallback when response.parsed is None (Issue 5 fix)."""
    raw_json = json.dumps({
        "bill_type": "financial",
        "impact_table": [
            {
                "description": "Tax change",
                "base_kes": 1000.0,
                "change_kes": 200.0,
                "period": "monthly",
                "section_ref": "Section 3",
                "math_breakdown": "1000 * 0.2"
            }
        ],
        "net_monthly_impact": 200.0,
        "risk_level": "MEDIUM",
        "verified": True,
        "disclaimer": "JSON text test"
    })
    fenced_text = f"```json\n{raw_json}\n```"

    with patch("app.agents.impact_agent.call_gemini") as mock_call:
        mock_call.return_value = GeminiResponse(
            text=fenced_text,
            parsed=None,
        )

        res = compute_financial_impact_analysis(sample_financial_bill, sample_bodaboda_profile)
        assert isinstance(res, ImpactResponse)
        assert res.bill_type == "financial"
        assert res.net_monthly_impact == 200.0
        assert res.risk_level == "MEDIUM"


def test_compute_financial_impact_malformed_json(sample_financial_bill, sample_bodaboda_profile):
    """Test fallback when response.parsed is None and response.text is malformed JSON (Issue 5 fix)."""
    with patch("app.agents.impact_agent.call_gemini") as mock_call:
        mock_call.return_value = GeminiResponse(
            text="Invalid JSON String {bad",
            parsed=None,
        )

        res = compute_financial_impact_analysis(sample_financial_bill, sample_bodaboda_profile)
        assert isinstance(res, ImpactResponse)
        assert res.bill_type == "financial"
        assert res.risk_level == "LOW"


def test_verify_and_recalculate_math_discrepancy_warnings(caplog):
    """Test warning logging when LLM values differ from recalculated values (Issues 2 & 3 fix)."""
    impact_obj = ImpactResponse(
        bill_type="regulatory",
        compliance_checklist=[
            ComplianceItem(
                requirement="Safety training",
                status="required",
                estimated_cost_kes=1500.0,
            )
        ],
        compliance_cost_total=5000.0,  # Hallucinated LLM value vs 1500.0 recalculated
        risk_level="MEDIUM",
        verified=True,
    )

    with caplog.at_level("WARNING"):
        _verify_and_recalculate_math(impact_obj)

    assert impact_obj.compliance_cost_total == 1500.0
    assert "LLM compliance_cost_total (5000.0) differs from recalculated (1500.0)" in caplog.text


def test_compute_financial_impact_fallback(sample_financial_bill, sample_bodaboda_profile):
    """Test fallback response generation when Gemini call fails or returns empty."""
    with patch("app.agents.impact_agent.call_gemini") as mock_call:
        mock_call.return_value = GeminiResponse(text="", parsed=None)

        res = compute_financial_impact_analysis(sample_financial_bill, sample_bodaboda_profile)

        assert isinstance(res, ImpactResponse)
        assert res.bill_type == "financial"
        assert res.verified is True
        assert res.risk_level == "LOW"


@pytest.mark.asyncio
async def test_async_compute_financial_impact(sample_bodaboda_profile):
    """Test async compute_financial_impact wrapper."""
    mock_impact = ImpactResponse(
        bill_type="financial",
        impact_table=[],
        net_monthly_impact=0.0,
        risk_level="LOW",
        verified=True,
    )

    with patch("app.agents.impact_agent.call_gemini") as mock_call:
        mock_call.return_value = GeminiResponse(parsed=mock_impact)
        res = await compute_financial_impact("bill-test-async", sample_bodaboda_profile)
        assert isinstance(res, ImpactResponse)
        assert res.bill_type == "financial"
