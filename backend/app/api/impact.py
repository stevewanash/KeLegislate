import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, status

from app.models.schemas import ImpactRequest, ImpactResponse
from app.models.hustle_profiles import INDUSTRIES, get_hustle_profile
from app.agents.impact_agent import compute_financial_impact_analysis
from app.database import supabase_admin
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/impact", tags=["Impact"])


@router.post("", response_model=ImpactResponse)
async def calculate_impact(
    request: ImpactRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Calculate the personalized financial & compliance impact of a bill.
    Loads the target bill from Supabase, resolves the business profile,
    and returns a unified impact analysis. Does not persist calculated results.
    Includes a 90-second execution timeout and thread pool offloading.
    """
    # 0. Validate industry input
    if request.industry not in INDUSTRIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown industry '{request.industry}'. Must be one of: {', '.join(INDUSTRIES)}"
        )

    # 1. Resolve business profile (custom profile scoped to authenticated user, else predefined baseline)
    profile = None
    if request.use_custom_profile:
        if authorization and supabase_admin:
            token = authorization.replace("Bearer ", "").strip()
            try:
                user_res = supabase_admin.auth.get_user(token)
                if user_res and user_res.user:
                    user_id = user_res.user.id
                    res = supabase_admin.table("user_profiles").select("*").eq("user_id", user_id).execute()
                    if res.data and len(res.data) > 0:
                        user_prof = res.data[0]
                        profile = {
                            "tier": user_prof.get("tier_label") or request.tier,
                            "description": "Custom business profile",
                            "metrics": user_prof.get("custom_metrics", {}),
                            "compliance_baseline": user_prof.get("custom_metrics", {}).get("compliance_baseline", {})
                        }
            except Exception as err:
                logger.warning(f"Failed to query custom profile for user token: {err}")

        if not profile:
            logger.warning(
                f"Custom profile requested for bill '{request.bill_id}', but custom profile was not found "
                "or valid authorization token was missing. Falling back to predefined tier baseline."
            )

    if not profile:
        profile = get_hustle_profile(request.industry, request.tier)

    # 2. Query bill from database
    bill_data = None
    if supabase_admin:
        try:
            res = supabase_admin.table("bills").select("id, title, bill_type, ai_summary_en, regex_extractions, extracted_text").eq("id", request.bill_id).execute()
            if res.data and len(res.data) > 0:
                bill_data = res.data[0]
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Bill '{request.bill_id}' not found"
                )
        except HTTPException:
            raise
        except Exception as err:
            logger.error(f"Error querying bill '{request.bill_id}' from database: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while querying bill '{request.bill_id}'"
            )
    else:
        # Offline/mock test mode fallback gated by settings.TESTING or mock bill_id prefix
        if getattr(settings, "TESTING", False) or request.bill_id.startswith("mock-"):
            bill_data = {
                "id": request.bill_id,
                "title": "Mock Legislative Bill 2026",
                "bill_type": "financial",
                "ai_summary_en": "Mock summary for offline testing.",
                "regex_extractions": [],
                "extracted_text": "Mock extracted text."
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection not available"
            )

    # 3. Compute impact analysis with 90-second timeout & event loop thread offloading
    try:
        impact_result = await asyncio.wait_for(
            asyncio.to_thread(compute_financial_impact_analysis, bill_data, profile),
            timeout=90.0
        )
        return impact_result
    except asyncio.TimeoutError:
        logger.error(f"Financial impact analysis timed out after 90s for bill '{request.bill_id}'")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Our analysis engine is busy — please try again in a moment"
        )
    except Exception as err:
        logger.error(f"Error computing impact analysis for bill '{request.bill_id}': {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate financial impact analysis"
        )



