from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from typing import Dict, Any

from app.agents.orchestrator import run_pipeline, run_pipeline_async, PipelineState

router = APIRouter(tags=["Admin"])


@router.post("/admin/run-pipeline/{bill_id}")
async def trigger_pipeline(
    bill_id: str,
    force: bool = Query(False, description="Force re-run all pipeline steps"),
    background: bool = Query(False, description="Run pipeline asynchronously in background"),
    background_tasks: BackgroundTasks = None
) -> Dict[str, Any]:
    """
    Temporary admin endpoint to trigger the DAG orchestrator pipeline for a bill.
    """
    if background and background_tasks:
        background_tasks.add_task(run_pipeline_async, bill_id, force)
        return {
            "status": "queued",
            "bill_id": bill_id,
            "message": f"Pipeline execution queued in background for bill '{bill_id}'"
        }

    state: PipelineState = await run_pipeline_async(bill_id, force=force)
    
    if state.status == "failed":
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline execution failed for bill '{bill_id}': {state.error_message}"
        )

    return {
        "status": state.status,
        "bill_id": state.bill_id,
        "step_results": state.step_results,
        "updated_at": state.updated_at
    }
