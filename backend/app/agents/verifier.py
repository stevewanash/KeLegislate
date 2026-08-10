import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.agents.llm_client import call_llm as call_gemini
call_llm = call_gemini
from app.agents.summarizer import summarize_bill_text
from app.database import supabase_admin

logger = logging.getLogger(__name__)


class DiscrepancyItem(BaseModel):
    """Detailed breakdown of a single numerical or citation discrepancy."""
    claim: str = Field(
        description="The claim from the English summary being audited."
    )
    claim_value: Optional[str] = Field(
        default=None,
        description="The specific numeric, monetary, or percentage value claimed in the summary."
    )
    extracted_value: Optional[str] = Field(
        default=None,
        description="The corresponding regex-extracted value for comparison."
    )
    section_ref: Optional[str] = Field(
        default=None,
        description="Relevant legal section or clause citation if available."
    )
    severity: str = Field(
        default="minor",
        description="Severity level: 'minor', 'major', or 'critical'."
    )


class VerificationResult(BaseModel):
    """Structured Pydantic model for Verification Agent audit result."""
    verified: bool = Field(
        description="True if all numeric, monetary, and percentage claims in the summary accurately match regex extractions."
    )
    issues: List[str] = Field(
        default_factory=list,
        description="List of specific discrepancies, hallucinated numbers, or unverified claims flagged."
    )
    confidence: float = Field(
        description="Overall verification confidence score between 0.0 and 1.0."
    )
    discrepancies: List[DiscrepancyItem] = Field(
        default_factory=list,
        description="Detailed list of flagged discrepancy items."
    )


VERIFIER_SYSTEM_INSTRUCTION = """
You are a meticulous legal audit assistant for KeLegislate.
Your job is to audit an AI-generated English bill summary against pre-extracted regex values (percentages, monetary amounts, fees, dates) from the original bill text.

STRICT AUDIT RULES:
1. Examine every percentage (%), monetary figure (KES/Ksh/shillings), date, and numeric fee stated in the English Summary.
2. Cross-reference these figures against the provided pre-extracted regex values.
3. If a figure in the summary contradicts or is missing from the regex extractions (and cannot be verified), flag it as a discrepancy in `issues` and `discrepancies`.
4. If ALL numeric claims match the regex extractions accurately, set `verified = True` and `confidence >= 0.90`.
5. If there are minor ambiguous figures, set `verified = True` with a lower `confidence` (e.g. 0.70 to 0.85).
6. If there are major contradictions or false numeric figures, set `verified = False` and `confidence < 0.60`.
"""


def verify_summary_claims(
    summary_en: str,
    regex_extractions: Optional[List[Dict[str, Any]]] = None,
    model: str = "gemini-3.5-flash",
) -> VerificationResult:
    """
    Verify numerical claims in an English summary against regex-extracted values using Gemini 3.5 Flash.

    Args:
        summary_en: English summary text to audit.
        regex_extractions: List of regex extraction dicts (percentages, KES amounts, dates).
        model: Target Gemini model name (default: gemini-3.5-flash).

    Returns:
        VerificationResult Pydantic object.
    """
    if not summary_en or not summary_en.strip():
        raise ValueError("English summary text is empty or missing for verification.")

    if not regex_extractions:
        logger.warning("No regex extractions provided for verification. Audit relies entirely on LLM internal consistency.")

    prompt_content = [
        f"ENGLISH SUMMARY TO AUDIT:\n{summary_en}",
        f"REGEX-EXTRACTED VALUES FROM ORIGINAL BILL:\n{regex_extractions or []}",
        "Audit every numeric, percentage, and monetary claim. Output structured JSON matching the VerificationResult schema."
    ]

    full_prompt = "\n\n".join(prompt_content)

    response = call_gemini(
        prompt=full_prompt,
        system_instruction=VERIFIER_SYSTEM_INSTRUCTION,
        model=model,
        temperature=0.1,  # Low temperature for strict audit consistency
        response_schema=VerificationResult,
        response_mime_type="application/json",
    )

    if response.parsed and isinstance(response.parsed, VerificationResult):
        result = response.parsed
    elif response.parsed and isinstance(response.parsed, dict):
        result = VerificationResult(**response.parsed)
    else:
        try:
            data = json.loads(response.text)
            result = VerificationResult(**data)
        except Exception as e:
            logger.error(f"Failed to parse VerificationResult JSON from response text: {e}")
            raise ValueError(f"Gemini response could not be parsed as VerificationResult: {response.text}") from e

    # Clamp confidence between 0.0 and 1.0
    result.confidence = max(0.0, min(1.0, float(result.confidence)))
    return result


def verify_bill_claims(
    bill_id: str,
    force: bool = False,
    max_retries: int = 2,
    model: str = "gemini-3.5-flash",
) -> VerificationResult:
    """
    Fetch a bill from Supabase, run the Verification Agent with a max-2-retries feedback loop,
    and update the verification score and ai_status='verified'.

    Args:
        bill_id: UUID of the bill in Supabase `bills` table.
        force: If True, re-runs verification even if already verified.
        max_retries: Maximum number of re-summarization feedback retries if verification fails.
        model: Target Gemini model name.

    Returns:
        VerificationResult object.
    """
    # 1. Fetch bill record
    res = supabase_admin.table("bills").select("id, extracted_text, ai_summary_en, regex_extractions, ai_status, bill_type, verification_score").eq("id", bill_id).execute()
    if not res.data:
        raise ValueError(f"Bill with ID '{bill_id}' not found in database.")

    bill_data = res.data[0]
    ai_status = bill_data.get("ai_status", "")

    # Idempotency check: skip verification if already verified/translated unless force=True
    if not force and ai_status in ("verified", "translated"):
        logger.info(f"Bill '{bill_id}' is already verified (ai_status='{ai_status}'). Skipping Gemini API call.")
        existing_score = bill_data.get("verification_score") or 1.00
        return VerificationResult(
            verified=True,
            issues=[],
            confidence=float(existing_score),
            discrepancies=[],
        )

    summary_en = bill_data.get("ai_summary_en")
    regex_extractions = bill_data.get("regex_extractions") or []

    if not summary_en:
        raise ValueError(f"Bill '{bill_id}' does not have an English summary to verify.")

    result: Optional[VerificationResult] = None

    # 2. Feedback loop: verify summary and retry summarizer if verification fails (up to max_retries)
    for retry in range(max_retries + 1):
        result = verify_summary_claims(
            summary_en=summary_en,
            regex_extractions=regex_extractions,
            model=model,
        )

        if result.verified or retry >= max_retries:
            if not result.verified:
                logger.warning(
                    f"Bill '{bill_id}' verification failed after {retry + 1} attempts. "
                    f"Storing bill with verification_score={result.confidence} and issues={result.issues}."
                )
            break

        logger.info(
            f"Verification attempt {retry + 1}/{max_retries + 1} failed for bill '{bill_id}' with issues: {result.issues}. "
            f"Triggering re-summarization feedback loop..."
        )
        try:
            revised_summary = summarize_bill_text(
                extracted_text=bill_data.get("extracted_text") or "",
                regex_extractions=regex_extractions,
                bill_type=bill_data.get("bill_type") or "financial",
                model=model,
            )
            summary_en = revised_summary.summary_en
            # Update database with revised summary before re-verifying
            supabase_admin.table("bills").update({
                "ai_summary_en": summary_en,
                "ai_status": "summarized",
            }).eq("id", bill_id).execute()
        except Exception as e:
            logger.error(f"Failed to re-summarize bill '{bill_id}' during verification retry loop: {e}")
            break

    if result is None:
        raise RuntimeError(f"Verification loop failed to produce a result for bill '{bill_id}'.")

    # 3. Update verification score and set ai_status='verified' in database
    new_status = "verified" if result.verified else "summarized"
    supabase_admin.table("bills").update({
        "verification_score": round(result.confidence, 2),
        "ai_status": new_status,
        "ai_error": None if result.verified else f"Verification flagged issues: {result.issues}",
    }).eq("id", bill_id).execute()

    logger.info(f"Successfully verified bill {bill_id}. Verified={result.verified}, Score={result.confidence}, Status={new_status}")
    return result


