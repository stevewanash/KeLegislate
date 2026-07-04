import firebase_admin
from firebase_admin import credentials, firestore
import streamlit as st
from datetime import datetime
import json
import hashlib


def _url_to_doc_id(url: str) -> str:
    """Deterministic document ID from URL. Prevents duplicate bill records (W1)."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


@st.cache_resource
def get_db():
    """
    Initializes Firebase safely (prevents double init error).
    Cached with @st.cache_resource so the client is reused across reruns (W10).
    """
    if not firebase_admin._apps:
        try:
            json_string = st.secrets["FIREBASE_SERVICE_ACCOUNT"]
            key_dict = json.loads(json_string)
            cred = credentials.Certificate(key_dict)
            firebase_admin.initialize_app(cred)
        except KeyError:
            st.error("Firebase Init Error: Secret FIREBASE_SERVICE_ACCOUNT not found. Please check .streamlit/secrets.toml or Streamlit Cloud Secrets.")
            return None
        except Exception as e:
            st.error(f"Firebase Init Error: {e}")
            return None
    return firestore.client(database_id='legislation')


# ==========================================
# BILL CRUD (New for v2)
# ==========================================

def save_bill(bill_title, bill_url, extracted_text, ai_summary, tags):
    """
    Saves a bill to Firestore with a deterministic document ID based on URL hash.
    Uses set() with merge=True so concurrent writes are idempotent (W1).
    """
    db = get_db()
    if not db:
        return False

    doc_id = _url_to_doc_id(bill_url)
    data = {
        "bill_title": bill_title,
        "bill_url": bill_url,
        "extracted_text": extracted_text[:50000],  # Cap storage size
        "ai_summary": ai_summary,
        "tags": tags,
        "timestamp": datetime.now()
    }
    try:
        db.collection("bills").document(doc_id).set(data, merge=True)
        return True
    except Exception as e:
        st.error(f"Error saving bill: {e}")
        return False


def get_bill(bill_url):
    """
    Retrieves a cached bill from Firestore by URL.
    Returns the bill dict if found, None otherwise.
    """
    db = get_db()
    if not db:
        return None

    doc_id = _url_to_doc_id(bill_url)
    try:
        doc = db.collection("bills").document(doc_id).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        st.error(f"Error fetching bill: {e}")
        return None


def get_all_bills():
    """
    Fetches all cached bills from Firestore.
    Returns a list of bill dicts ordered by timestamp (newest first).
    """
    db = get_db()
    if not db:
        return []

    try:
        docs = db.collection("bills").order_by(
            "timestamp", direction=firestore.Query.DESCENDING
        ).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        st.error(f"Error fetching bills: {e}")
        return []


# ==========================================
# SUBSCRIBER CRUD (New for SMS branch)
# ==========================================

def _phone_to_doc_id(phone: str) -> str:
    """Deterministic document ID from phone number. Prevents duplicate subscriptions."""
    return hashlib.sha256(phone.encode()).hexdigest()[:16]


def save_subscriber(phone_number, industry_tag, profile_tier, operational_metrics, preferred_language):
    """
    Saves an SMS subscriber to Firestore.
    Uses phone-hash as document ID — idempotent (re-subscribing updates the record).
    """
    db = get_db()
    if not db:
        return False

    doc_id = _phone_to_doc_id(phone_number)
    data = {
        "phone_number": phone_number,
        "industry_tag": industry_tag,
        "profile_tier": profile_tier,
        "operational_metrics": operational_metrics,
        "preferred_language": preferred_language,
        "timestamp": datetime.now()
    }
    try:
        db.collection("subscribers").document(doc_id).set(data, merge=True)
        return True
    except Exception as e:
        st.error(f"Error saving subscriber: {e}")
        return False


def get_subscribers_by_tag(industry_tag):
    """
    Fetches all subscribers whose industry_tag matches the given tag.
    Used by SMS broadcast to find who to notify about a new bill.
    """
    db = get_db()
    if not db:
        return []

    try:
        docs = db.collection("subscribers").where("industry_tag", "==", industry_tag).stream()
        return [doc.to_dict() for doc in docs]
    except Exception as e:
        st.error(f"Error fetching subscribers: {e}")
        return []


# ==========================================
# FEEDBACK CRUD (Existing — preserved)
# ==========================================


def save_feedback(bill_title, support, rating, concerns):
    db = get_db()
    if db:
        data = {
            "bill_title": bill_title,
            "support": support,
            "rating": int(rating),
            "concerns": concerns,
            "timestamp": datetime.now()
        }
        db.collection("bill_feedback").add(data)
        return True
    return False

def fetch_feedback(bill_title=None):
    db = get_db()
    if not db:
        return []
    
    collection = db.collection("bill_feedback")
    
    if bill_title:
        # Filter by specific bill
        docs = collection.where("bill_title", "==", bill_title).stream()
    else:
        docs = collection.stream()
        
    return [doc.to_dict() for doc in docs]