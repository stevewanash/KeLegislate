from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime

# ==========================================
# BILL SCHEMAS
# ==========================================
class BillBrief(BaseModel):
    id: str
    title: str
    tags: List[str]
    created_at: datetime
    ai_status: str

class BillListResponse(BaseModel):
    bills: List[BillBrief]
    total: int
    page: int
    limit: int

class BillDetailResponse(BaseModel):
    id: str
    title: str
    ai_summary_en: Optional[str] = None
    ai_summary_sw: Optional[str] = None
    tags: List[str]
    regex_extractions: Optional[List[Dict[str, Any]]] = None
    source_url: str
    created_at: datetime

# ==========================================
# FINANCIAL IMPACT SCHEMAS
# ==========================================
class ImpactRequest(BaseModel):
    bill_id: str
    industry: str
    tier: str
    use_custom_profile: bool = False

class ImpactResponse(BaseModel):
    impact_table: List[Dict[str, Any]]
    net_monthly_impact: float
    compliance_checklist: List[str]
    risk_level: str  # 'LOW', 'MEDIUM', 'HIGH'
    verified: bool
    disclaimer: Optional[str] = None

# ==========================================
# FEEDBACK SCHEMAS
# ==========================================
class FeedbackRequest(BaseModel):
    bill_id: str
    support: str  # 'support', 'oppose', 'neutral'
    rating: int  # 1 to 5
    concerns: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: str
    created_at: datetime

# ==========================================
# SUBSCRIPTION SCHEMAS
# ==========================================
class SubscribeRequest(BaseModel):
    phone: str  # E.164 format
    industries: List[str]
    language: str = "en"  # 'en' or 'sw'
    channels: List[str] = ["sms"]  # 'sms', 'whatsapp'

class SubscribeResponse(BaseModel):
    subscriber_id: str
    status: str

class SubscriptionStatusResponse(BaseModel):
    is_active: bool
    industries: List[str]
    preferred_language: str
    channels: List[str]

# ==========================================
# CUSTOM PROFILE SCHEMAS
# ==========================================
class ProfileRequest(BaseModel):
    industry: str
    tier_label: Optional[str] = None
    custom_metrics: Dict[str, Any]

class ProfileResponse(BaseModel):
    id: str
    user_id: str
    industry: str
    tier_label: Optional[str] = None
    custom_metrics: Dict[str, Any]
    consent_given_at: datetime
    created_at: datetime
    updated_at: datetime

# ==========================================
# DASHBOARD SCHEMAS
# ==========================================
class DashboardStatsResponse(BaseModel):
    total_feedback: int
    support_pct: Dict[str, float]  # e.g., {"support": 60.0, "oppose": 30.0, "neutral": 10.0}
    avg_rating: float
    top_concerns: List[str]

# ==========================================
# WEBHOOK SCHEMAS
# ==========================================
class DeliveryReceiptRequest(BaseModel):
    messageId: str
    status: str
    phoneNumber: Optional[str] = None
    retryCount: Optional[int] = None
    networkCode: Optional[str] = None

class SupabaseSmsWebhookPayload(BaseModel):
    type: str  # "sms" or similar
    phone: str
    text: str
