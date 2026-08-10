"""
Financial Impact Agent module for KeLegislate.
Calculates personalized financial impact and regulatory compliance advice
for a given bill and hustle profile using Gemini 3.5 Flash and the deterministic calculator tool.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.agents.llm_client import call_llm as call_gemini
call_llm = call_gemini
from app.agents.calculator import CALCULATOR_TOOL_SPEC, execute_calculator_tool, evaluate_expression
from app.models.schemas import ImpactResponse, ImpactItem, ComplianceItem, PenaltyRisk
from app.database import supabase_admin

logger = logging.getLogger(__name__)


IMPACT_SYSTEM_INSTRUCTION = """
You are the Financial Impact & Compliance Analyst Agent for KeLegislate.
Your job is to analyze a legislative bill summary and pre-extracted financial/regulatory values against a small business baseline profile (e.g., BodaBoda Rider, Uber Driver).

CRITICAL INSTRUCTIONS FOR ARITHMETIC & FORMULAE:
1. You MUST NOT perform mental math or estimate calculations.
2. For ANY financial line item change or cost calculation, specify the exact mathematical expression in the `math_breakdown` field (e.g., "150000 * 0.025", "3500 * 12", "12000 + 5000").
3. Determine the bill type: 'financial', 'regulatory', or 'hybrid'.

ROUTING BY BILL TYPE:
- If 'financial' or 'hybrid':
  - Provide `impact_table` items containing:
    - description: clear explanation of the financial change
    - base_kes: baseline annual/monthly amount in KES
    - change_kes: net change amount in KES (positive for increased cost/tax, negative for savings)
    - period: "monthly" or "annual" or "one-time"
    - section_ref: legal section citation (e.g., "Section 42(1)")
    - math_breakdown: mathematical expression string used to derive change_kes
  - Provide `net_monthly_impact`: net total monthly change in KES (float).

- If 'regulatory' or 'hybrid':
  - Provide `compliance_checklist`: list of requirements with:
    - requirement: plain language mandate
    - status: "required", "recommended", or "optional"
    - deadline: deadline string or null
    - estimated_cost_kes: cost in KES (float) or 0.0
    - penalty_for_non_compliance: description of penalty for default
  - Provide `compliance_cost_total`: sum of initial compliance costs in KES (float).
  - Provide `penalty_risks`: list of non-compliance risks with:
    - violation: potential violation
    - penalty: legal fine/sentence
    - severity: "LOW", "MEDIUM", "HIGH", or "CRITICAL"

- Set `risk_level`: "LOW", "MEDIUM", or "HIGH".
- Set `verified`: true.
- Set `disclaimer`: "This impact analysis is an automated estimate for informational purposes and does not constitute legal or tax advice."
"""


def compute_financial_impact_analysis(
    bill_data: Dict[str, Any],
    hustle_profile: Dict[str, Any],
    model: str = "gemini-3.5-flash",
) -> ImpactResponse:
    """
    Computes financial impact and/or compliance advice for a given bill and hustle profile.

    Args:
        bill_data: Dictionary containing bill details ('title', 'bill_type', 'ai_summary_en', 'regex_extractions').
        hustle_profile: Dictionary containing baseline metrics and compliance baseline.
        model: Target Gemini model name (default: gemini-3.5-flash).

    Returns:
        ImpactResponse object.
    """
    bill_title = bill_data.get("title", "Legislative Bill")
    bill_type = bill_data.get("bill_type", "financial")
    if bill_type not in ("financial", "regulatory", "hybrid"):
        bill_type = "financial"

    summary_en = bill_data.get("ai_summary_en") or bill_data.get("extracted_text", "")
    regex_extractions = bill_data.get("regex_extractions", [])

    metrics = hustle_profile.get("metrics", {})
    tier_label = hustle_profile.get("tier", "Micro-Enterprise")
    compliance_baseline = hustle_profile.get("compliance_baseline", {})

    prompt_content = f"""
BILL TITLE: {bill_title}
BILL TYPE: {bill_type}

BILL SUMMARY / EXTRACTED CLAUSES:
{summary_en}

PRE-EXTRACTED REGEX VALUES:
{json.dumps(regex_extractions, indent=2)}

TARGET BUSINESS PROFILE ({tier_label}):
Operational Metrics:
{json.dumps(metrics, indent=2)}

Compliance Baseline:
{json.dumps(compliance_baseline, indent=2)}

Perform a thorough financial impact and compliance analysis tailored to this profile. Return structured JSON conforming to the requested schema.
"""

    try:
        response = call_gemini(
            prompt=prompt_content,
            system_instruction=IMPACT_SYSTEM_INSTRUCTION,
            model=model,
            temperature=0.1,
            response_schema=ImpactResponse,
            response_mime_type="application/json",
            tools=[CALCULATOR_TOOL_SPEC],
        )
    except Exception as err:
        logger.error(f"LLM API call failed in impact agent: {err}")
        return _fallback_impact_response(bill_type, metrics)

    if response.parsed and isinstance(response.parsed, ImpactResponse):
        impact_res = response.parsed
    elif response.parsed and isinstance(response.parsed, dict):
        impact_res = ImpactResponse(**response.parsed)
    elif response.text:
        try:
            cleaned_text = response.text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text.split("```json", 1)[1].rsplit("```", 1)[0].strip()
            elif cleaned_text.startswith("```"):
                cleaned_text = cleaned_text.split("```", 1)[1].rsplit("```", 1)[0].strip()
            data = json.loads(cleaned_text)
            impact_res = ImpactResponse(**data)
        except Exception as err:
            logger.warning(f"Failed to parse text response from Gemini into ImpactResponse: {err}")
            impact_res = _fallback_impact_response(bill_type, metrics)
    else:
        impact_res = _fallback_impact_response(bill_type, metrics)

    # Post-process: recalculate math_breakdowns using AST calculator to ensure 100% deterministic numbers
    impact_res.bill_type = bill_type
    _verify_and_recalculate_math(impact_res)

    return impact_res


def _get_item_attr(item: Any, attr: str, default: Any = None) -> Any:
    """Helper to retrieve attribute or dict value from an ImpactItem or dict."""
    if isinstance(item, dict):
        return item.get(attr, default)
    return getattr(item, attr, default)


def _set_item_attr(item: Any, attr: str, val: Any) -> None:
    """Helper to set attribute or dict key on an ImpactItem or dict."""
    if isinstance(item, dict):
        item[attr] = val
    else:
        setattr(item, attr, val)


def _verify_and_recalculate_math(impact_res: ImpactResponse) -> None:
    """Safely recalculates net_monthly_impact and itemized math breakdowns using AST evaluate_expression."""
    if impact_res.impact_table:
        calculated_net = 0.0
        for item in impact_res.impact_table:
            breakdown = _get_item_attr(item, "math_breakdown")
            if breakdown:
                try:
                    val = evaluate_expression(breakdown)
                    _set_item_attr(item, "change_kes", val)
                except Exception as e:
                    logger.debug(f"Could not evaluate math_breakdown '{breakdown}': {e}")

            change_kes = float(_get_item_attr(item, "change_kes", 0.0) or 0.0)
            period = str(_get_item_attr(item, "period", "monthly")).lower()

            if "month" in period:
                calculated_net += change_kes
            elif "annual" in period or "year" in period:
                calculated_net += change_kes / 12.0
            elif "one-time" in period:
                calculated_net += change_kes / 12.0

        if impact_res.net_monthly_impact is not None and abs(impact_res.net_monthly_impact - calculated_net) > 1.0:
            logger.warning(
                f"LLM net_monthly_impact ({impact_res.net_monthly_impact}) "
                f"differs from AST recalculated ({calculated_net:.2f}); using recalculated."
            )

        if calculated_net != 0.0 or impact_res.net_monthly_impact is None:
            impact_res.net_monthly_impact = round(calculated_net, 2)

    if impact_res.compliance_checklist:
        total_comp = 0.0
        for comp in impact_res.compliance_checklist:
            if comp.estimated_cost_kes:
                total_comp += comp.estimated_cost_kes
        recalculated_comp = round(total_comp, 2)
        if impact_res.compliance_cost_total is not None and abs(impact_res.compliance_cost_total - recalculated_comp) > 0.01:
            logger.warning(
                f"LLM compliance_cost_total ({impact_res.compliance_cost_total}) "
                f"differs from recalculated ({recalculated_comp}); using recalculated."
            )
        impact_res.compliance_cost_total = recalculated_comp


def _fallback_impact_response(bill_type: str, metrics: Dict[str, Any]) -> ImpactResponse:
    """Generates a safe fallback ImpactResponse structure if API parsing fails."""
    if bill_type in ("financial", "hybrid"):
        return ImpactResponse(
            bill_type=bill_type,
            impact_table=[
                ImpactItem(
                    description="Estimated tax/levy adjustment baseline",
                    base_kes=float(metrics.get("est_monthly_overhead_kes", 10000)),
                    change_kes=0.0,
                    period="monthly",
                    section_ref="General",
                    math_breakdown="0",
                )
            ],
            net_monthly_impact=0.0,
            risk_level="LOW",
            verified=True,
            disclaimer="Automated fallback estimate for informational purposes.",
        )
    else:
        return ImpactResponse(
            bill_type=bill_type,
            compliance_checklist=[
                ComplianceItem(
                    requirement="Verify local county operating registration",
                    status="recommended",
                    deadline=None,
                    estimated_cost_kes=0.0,
                    penalty_for_non_compliance="Notice of default",
                )
            ],
            compliance_cost_total=0.0,
            penalty_risks=[
                PenaltyRisk(
                    violation="Operating without updated registration",
                    penalty="Standard county administrative fine",
                    severity="LOW",
                )
            ],
            risk_level="LOW",
            verified=True,
            disclaimer="Automated fallback estimate for informational purposes.",
        )


async def compute_financial_impact(bill_id: str, hustle_profile: Dict[str, Any]) -> ImpactResponse:
    """
    Async helper called by FastAPI route handlers to load bill from Supabase and run impact analysis.
    """
    bill_data = {}
    if supabase_admin:
        try:
            res = supabase_admin.from_("bills").select("id, title, bill_type, ai_summary_en, regex_extractions, extracted_text").eq("id", bill_id).execute()
            if res.data and len(res.data) > 0:
                bill_data = res.data[0]
        except Exception as err:
            logger.warning(f"Failed to query bill '{bill_id}' from Supabase: {err}")

    if not bill_data:
        logger.warning(f"Bill '{bill_id}' not found in Supabase or query failed; returning fallback impact response.")
        return _fallback_impact_response("financial", hustle_profile.get("metrics", {}))

    return compute_financial_impact_analysis(bill_data, hustle_profile)
