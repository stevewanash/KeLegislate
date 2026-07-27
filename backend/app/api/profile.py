from fastapi import APIRouter, HTTPException
from app.models.schemas import ProfileRequest, ProfileResponse

router = APIRouter(prefix="/profile", tags=["Custom Profiles"])

@router.post("", response_model=ProfileResponse)
async def create_or_update_profile(request: ProfileRequest):
    """
    Create or update user's business profile (Authentication required).
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.get("", response_model=ProfileResponse)
async def get_profile():
    """
    Retrieve user's custom business profile (Authentication required).
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")

@router.delete("")
async def delete_profile():
    """
    Delete custom business profile permanently (Authentication required).
    """
    raise HTTPException(status_code=501, detail="Endpoint not implemented yet")
