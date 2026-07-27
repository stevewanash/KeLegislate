from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["Feedback"])

@router.post("", response_model=FeedbackResponse)
async def submit_feedback(request: FeedbackRequest):
    """
    Submit citizen feedback on a bill (Authentication required).
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")
