"""
DAG Orchestrator module for KeLegislate.
Manages the end-to-end bill processing pipeline: Extraction -> Regex -> Summarization -> Verification -> Translation.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional

from app.agents.summarizer import summarize_bill
from app.agents.verifier import verify_bill_claims
from app.agents.translator import translate_bill
from app.utils.regex_extractor import extract_financial_values
from app.database import supabase_admin

logger = logging.getLogger(__name__)


@dataclass
class PipelineState:
    """Dataclass holding execution metrics and status for a bill pipeline run."""
    bill_id: str
    status: str = "pending"  # pending, extracted, summarized, verified, translated, failed
    step_results: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    retry_count: int = 0
    updated_at: Optional[str] = None


def run_pipeline(bill_id: str, force: bool = False) -> PipelineState:
    """
    Executes the full DAG pipeline for a bill:
    1. Regex Extraction (from pre-extracted bill text in database)
    2. Summarization Agent
    3. Verification Agent
    4. Translation Agent

    Note: Text extraction (PDF -> text) is handled upstream by seed_bill.py (Step 2.1)
    and will be integrated into the DAG pipeline in Phase 5 (Scraper Automation).

    Args:
        bill_id: ID of the bill to process in Supabase.
        force: If True, re-runs all stages regardless of current ai_status.

    Returns:
        PipelineState dataclass instance.
    """
    state = PipelineState(
        bill_id=bill_id,
        updated_at=datetime.now(timezone.utc).isoformat()
    )

    logger.info(f"Starting DAG pipeline run for bill_id: {bill_id} (force={force})")

    # 1. Fetch bill record from Supabase
    bill = None
    if supabase_admin:
        try:
            res = supabase_admin.from_("bills").select("*").eq("id", bill_id).execute()
            if res.data and len(res.data) > 0:
                bill = res.data[0]
        except Exception as e:
            logger.error(f"Error fetching bill {bill_id} from Supabase: {e}")

        if not bill:
            state.status = "failed"
            state.error_message = f"Bill with id '{bill_id}' not found in database."
            logger.error(state.error_message)
            return state
    else:
        # Offline/testing mode fallback when supabase_admin is explicitly None
        bill = {
            "id": bill_id,
            "title": "Mock Bill (offline fallback)",
            "extracted_text": "Sample text for bill testing.",
            "ai_status": "ingested",
            "regex_extractions": [],
        }

    current_status = bill.get("ai_status", "ingested")

    try:
        # Step 1: Regex Extraction
        extracted_text = bill.get("extracted_text", "")
        existing_regex = bill.get("regex_extractions")

        if force or not existing_regex or current_status == "ingested":
            logger.info(f"Pipeline Stage 1 [Regex Extraction] executing for bill_id: {bill_id}")
            if not extracted_text:
                logger.warning(f"No extracted_text for bill {bill_id}; skipping regex extraction.")
                state.step_results["regex_extraction"] = {
                    "status": "skipped",
                    "reason": "no extracted text"
                }
            else:
                regex_results = extract_financial_values(extracted_text)

                if supabase_admin:
                    supabase_admin.from_("bills").update({
                        "regex_extractions": regex_results,
                        "ai_status": "extracted"
                    }).eq("id", bill_id).execute()

                state.step_results["regex_extraction"] = {
                    "count": len(regex_results),
                    "status": "success"
                }
                state.status = "extracted"
        else:
            logger.info(f"Pipeline Stage 1 [Regex Extraction] skipped (already extracted)")
            state.step_results["regex_extraction"] = {"status": "skipped"}
            state.status = "extracted"

        # Step 2: Summarization Agent
        logger.info(f"Pipeline Stage 2 [Summarization] executing for bill_id: {bill_id}")
        sum_res = summarize_bill(bill_id, force=force)
        state.step_results["summarization"] = sum_res
        if sum_res.get("status") == "error":
            logger.error(f"Summarization failed for bill {bill_id}; aborting pipeline.")
            state.status = "failed"
            state.error_message = f"Summarization failed: {sum_res.get('error', 'unknown error')}"
            _update_failed_status_in_db(bill_id)
            return state

        state.status = "summarized"

        # Step 3: Verification Agent
        logger.info(f"Pipeline Stage 3 [Verification] executing for bill_id: {bill_id}")
        ver_res = verify_bill_claims(bill_id, force=force)
        state.step_results["verification"] = ver_res
        if ver_res.get("status") == "error":
            logger.error(f"Verification failed for bill {bill_id}; aborting pipeline.")
            state.status = "failed"
            state.error_message = f"Verification failed: {ver_res.get('error', 'unknown error')}"
            _update_failed_status_in_db(bill_id)
            return state

        state.status = "verified"

        # Step 4: Translation Agent
        logger.info(f"Pipeline Stage 4 [Translation] executing for bill_id: {bill_id}")
        trans_res = translate_bill(bill_id, force=force)
        state.step_results["translation"] = trans_res
        if trans_res.get("status") == "error":
            logger.error(f"Translation failed for bill {bill_id}; aborting pipeline.")
            state.status = "failed"
            state.error_message = f"Translation failed: {trans_res.get('error', 'unknown error')}"
            _update_failed_status_in_db(bill_id)
            return state

        state.status = "translated"
        state.updated_at = datetime.now(timezone.utc).isoformat()
        logger.info(f"DAG pipeline run completed successfully for bill_id: {bill_id} with status: {state.status}")
        return state

    except Exception as e:
        logger.error(f"Pipeline failure for bill_id {bill_id}: {e}", exc_info=True)
        state.status = "failed"
        state.error_message = str(e)
        state.updated_at = datetime.now(timezone.utc).isoformat()
        _update_failed_status_in_db(bill_id)
        return state


def _update_failed_status_in_db(bill_id: str) -> None:
    """Helper function to set bill ai_status to 'failed' in Supabase."""
    if supabase_admin:
        try:
            supabase_admin.from_("bills").update({
                "ai_status": "failed"
            }).eq("id", bill_id).execute()
        except Exception as db_err:
            logger.error(f"Failed to update bill status to 'failed' in Supabase: {db_err}")


async def run_pipeline_async(bill_id: str, force: bool = False) -> PipelineState:
    """Async wrapper around run_pipeline using thread pool to avoid blocking the event loop."""
    return await asyncio.to_thread(run_pipeline, bill_id, force=force)
