"""
Seed script for KeLegislate v2 demo.
Inserts a sample Motor Vehicle Circulation Tax bill into Firestore
so the impact modeling workflow can be demonstrated without scraping.

Usage: python seed_demo.py
Run from the src/ directory (or adjust path to secrets.toml).
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import hashlib
import json
import os
import re
import sys


def _url_to_doc_id(url: str) -> str:
    """Same hashing logic as feedback_utils.py"""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def load_secrets():
    """
    Load secrets from .streamlit/secrets.toml.
    Uses tomllib (Python 3.11+) or falls back to regex for multi-line strings.
    """
    secrets_path = os.path.join(os.path.dirname(__file__), '.streamlit', 'secrets.toml')
    
    if not os.path.exists(secrets_path):
        print(f"❌ secrets.toml not found at: {secrets_path}")
        sys.exit(1)

    # Try tomllib (built-in Python 3.11+) first
    try:
        import tomllib
        with open(secrets_path, 'rb') as f:
            return tomllib.load(f)
    except ImportError:
        pass

    # Try tomli (pip install tomli) as a fallback
    try:
        import toml
        with open(secrets_path, 'rb') as f:
            return tomli.load(f)
    except ImportError:
        pass

    # Last resort: regex-based parser that handles multi-line triple-quoted strings
    with open(secrets_path, 'r', encoding='utf-8') as f:
        content = f.read()

    secrets = {}

    # Match triple-quoted multi-line values: KEY = """..."""
    for match in re.finditer(r'(\w+)\s*=\s*"""(.*?)"""', content, re.DOTALL):
        secrets[match.group(1)] = match.group(2).strip()

    # Match single-quoted values: KEY = "value"
    for match in re.finditer(r'(\w+)\s*=\s*"([^"]*)"', content):
        if match.group(1) not in secrets:
            secrets[match.group(1)] = match.group(2)

    return secrets


def initialize_firebase(secrets):
    """Initialize Firebase from secrets."""
    if not firebase_admin._apps:
        json_string = secrets.get("FIREBASE_SERVICE_ACCOUNT", "")
        if not json_string:
            print("❌ FIREBASE_SERVICE_ACCOUNT not found in secrets.toml")
            sys.exit(1)
        
        key_dict = json.loads(json_string)
        cred = credentials.Certificate(key_dict)
        firebase_admin.initialize_app(cred)
    
    return firestore.client(database_id='legislation')


def seed_motor_vehicle_circulation_tax(db):
    """Insert the Motor Vehicle Circulation Tax bill."""
    
    bill_url = "https://www.parliament.go.ke/sites/default/files/2026-06/Motor_Vehicle_Circulation_Tax_Bill_2026.pdf"
    doc_id = _url_to_doc_id(bill_url)
    
    ai_summary = """## Simple English Summary
The Motor Vehicle Circulation Tax Bill, 2026 proposes a new annual tax of **2.5% on the assessed value** of every motor vehicle in Kenya. This tax is charged **on top of existing insurance premiums** — it is NOT a replacement for insurance but an additional levy. The tax is collected at the point of insurance renewal and must be paid before a vehicle can be legally insured or its insurance renewed. 

The assessed value is determined by the Kenya Revenue Authority (KRA) based on the vehicle's make, model, year of manufacture, and depreciation schedule. Failure to pay attracts a penalty of 5% per month on the outstanding amount.

## 1. Key Implications for Citizens
* Every vehicle owner must now pay an additional 2.5% of their vehicle's value annually, on top of insurance costs
* A boda boda worth KES 150,000 will pay an extra KES 3,750 per year
* A family car worth KES 1,200,000 will pay an extra KES 30,000 per year
* The tax is collected at insurance renewal — you cannot renew insurance without paying it
* Late payment attracts a 5% monthly penalty, compounding the cost for low-income earners

## 2. Key Implications for Businesses/Government
* Transport businesses (boda boda, Uber/Bolt, matatu) face increased operating costs across their fleets
* A fleet of 5 vehicles valued at KES 4,000,000 would pay KES 100,000 annually in new taxes
* Insurance companies become de facto tax collectors, adding administrative burden
* KRA is mandated to maintain a vehicle valuation database
* Revenue is earmarked for road infrastructure and accident victim compensation fund

---

## Muhtasari
Sheria ya Kodi ya Usafiri wa Magari, 2026 inapendekeza kodi mpya ya kila mwaka ya **asilimia 2.5 ya thamani** ya kila gari nchini Kenya. Kodi hii inalipwa **pamoja na bima ya kawaida** — si badala yake bali ni malipo ya ziada. Kodi hii inakusanywa wakati wa kuhuisha bima na lazima ilipwe kabla gari halijaruhusiwa kisheria kuwa na bima.

## 1. Athari kwa Wananchi
* Kila mmiliki wa gari atalipa kodi ya ziada ya 2.5% ya thamani ya gari lake kila mwaka
* Bodaboda yenye thamani ya KES 150,000 italipa KES 3,750 za ziada kwa mwaka
* Gari la familia lenye thamani ya KES 1,200,000 litalipa KES 30,000 za ziada kwa mwaka
* Kodi inakusanywa wakati wa kuhuisha bima — huwezi kuhuisha bima bila kulipa
* Ucheleweshaji wa malipo unavutia adhabu ya 5% kwa mwezi

## 2. Athari kwa Biashara/Serikali
* Biashara za usafiri (bodaboda, Uber/Bolt, matatu) zinakabiliwa na gharama zaidi za uendeshaji
* Kampuni za bima zinakuwa wakusanyaji wa kodi, kuongeza mzigo wa utawala
* KRA imepewa jukumu la kudumisha hifadhi ya thamani ya magari
* Mapato yanalenga miundombinu ya barabara na mfuko wa fidia kwa waathirika wa ajali

---

## Industry Tags
- Transport & Logistics
- Finance & Mobile Money"""

    data = {
        "bill_title": "The Motor Vehicle Circulation Tax Bill, 2026",
        "bill_url": bill_url,
        "extracted_text": "[Seeded demo bill — full text not available]",
        "ai_summary": ai_summary,
        "tags": ["Transport & Logistics", "Finance & Mobile Money"],
        "timestamp": datetime.now()
    }

    db.collection("bills").document(doc_id).set(data, merge=True)
    print(f"✅ Seeded bill: '{data['bill_title']}'")
    print(f"   Document ID: {doc_id}")
    print(f"   Tags: {data['tags']}")
    print(f"   URL hash source: {bill_url}")


def main():
    print("=" * 50)
    print("KeLegislate v2 — Demo Seed Script")
    print("=" * 50)
    
    secrets = load_secrets()
    print("📂 Loaded secrets.toml")
    
    db = initialize_firebase(secrets)
    print("🔥 Firebase initialized")
    
    seed_motor_vehicle_circulation_tax(db)
    
    print("\n✅ Seeding complete! You can now run the app and test Tab 4.")
    print("   Run: streamlit run main.py")


if __name__ == "__main__":
    main()
