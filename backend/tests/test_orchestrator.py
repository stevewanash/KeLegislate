import pytest
from unittest.mock import patch, MagicMock

from app.agents.orchestrator import run_pipeline, run_pipeline_async, PipelineState


@pytest.fixture
def mock_supabase():
    mock_db = MagicMock()
    mock_db.from_.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "bill-dag-101",
                "title": "Finance Bill 2024",
                "extracted_text": "Section 1. A tax of 2.5% on motor vehicles.",
                "ai_status": "ingested",
                "regex_extractions": [],
            }
        ]
    )
    mock_db.from_.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    return mock_db


def test_run_pipeline_success(mock_supabase):
    """Test full successful pipeline execution."""
    with patch("app.agents.orchestrator.supabase_admin", mock_supabase), \
         patch("app.agents.orchestrator.extract_financial_values") as mock_regex, \
         patch("app.agents.orchestrator.summarize_bill") as mock_sum, \
         patch("app.agents.orchestrator.verify_bill_claims") as mock_ver, \
         patch("app.agents.orchestrator.translate_bill") as mock_trans:

        mock_regex.return_value = [{"type": "percentage", "value": 2.5}]
        mock_sum.return_value = {"status": "success", "summary_en": "Summary text"}
        mock_ver.return_value = {"status": "success", "verified": True}
        mock_trans.return_value = {"status": "success", "summary_sw": "Swahili text"}

        state = run_pipeline("bill-dag-101", force=True)

        assert isinstance(state, PipelineState)
        assert state.bill_id == "bill-dag-101"
        assert state.status == "translated"
        assert "regex_extraction" in state.step_results
        assert "summarization" in state.step_results
        assert "verification" in state.step_results
        assert "translation" in state.step_results

        # Verify agent functions were called
        mock_regex.assert_called_once()
        mock_sum.assert_called_once_with("bill-dag-101", force=True)
        mock_ver.assert_called_once_with("bill-dag-101", force=True)
        mock_trans.assert_called_once_with("bill-dag-101", force=True)


def test_run_pipeline_bill_not_found():
    """Test that pipeline fails cleanly when a bill is not found in Supabase (Issue 4 & 5 fix)."""
    mock_db = MagicMock()
    mock_db.from_.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    with patch("app.agents.orchestrator.supabase_admin", mock_db):
        state = run_pipeline("bill-nonexistent", force=True)
        assert state.status == "failed"
        assert "not found" in state.error_message.lower()


def test_run_pipeline_short_circuits_on_stage_error(mock_supabase):
    """Test that pipeline aborts immediately when a stage returns status 'error' (Issue 1 fix)."""
    with patch("app.agents.orchestrator.supabase_admin", mock_supabase), \
         patch("app.agents.orchestrator.extract_financial_values") as mock_regex, \
         patch("app.agents.orchestrator.summarize_bill") as mock_sum, \
         patch("app.agents.orchestrator.verify_bill_claims") as mock_ver, \
         patch("app.agents.orchestrator.translate_bill") as mock_trans:

        mock_regex.return_value = []
        mock_sum.return_value = {"status": "error", "error": "Gemini API limit exceeded"}

        state = run_pipeline("bill-dag-101", force=True)

        assert state.status == "failed"
        assert "Summarization failed" in state.error_message
        mock_ver.assert_not_called()
        mock_trans.assert_not_called()


def test_run_pipeline_failure_handling(mock_supabase):
    """Test pipeline handling when a stage raises an exception."""
    with patch("app.agents.orchestrator.supabase_admin", mock_supabase), \
         patch("app.agents.orchestrator.extract_financial_values", side_effect=ValueError("Extraction failed")):

        state = run_pipeline("bill-dag-101", force=True)

        assert isinstance(state, PipelineState)
        assert state.status == "failed"
        assert state.error_message == "Extraction failed"


@pytest.mark.asyncio
async def test_run_pipeline_async_wrapper(mock_supabase):
    """Test async wrapper for DAG orchestrator."""
    with patch("app.agents.orchestrator.supabase_admin", mock_supabase), \
         patch("app.agents.orchestrator.extract_financial_values") as mock_regex, \
         patch("app.agents.orchestrator.summarize_bill") as mock_sum, \
         patch("app.agents.orchestrator.verify_bill_claims") as mock_ver, \
         patch("app.agents.orchestrator.translate_bill") as mock_trans:

        mock_regex.return_value = []
        mock_sum.return_value = {"status": "success"}
        mock_ver.return_value = {"status": "success"}
        mock_trans.return_value = {"status": "success"}

        state = await run_pipeline_async("bill-dag-101", force=False)

        assert isinstance(state, PipelineState)
        assert state.status == "translated"
