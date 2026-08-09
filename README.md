# KeLegislate
> Built during the **Democracy & AI Hackathon** — July 4th, 2026 Hosted by **Mozilla Foundation** & **KamiLimu**

---
# Team
| Name            | Role        | GitHub    |
|---------------  |-------------|-----------|
| Maryanne Farida | Frontend    | @MaryanneFarida |
| Steve Wanangwe  | Backend     | @SteveWanash |

**Team Name**: Techies          University: JKUAT & USIU

---
## Problem & User

### **Problem Statement**
> Bodaboda riders and transport micro-enterprises in Kenya face routine financial blindsiding from national tax bills and county regulations that pass without their knowledge or meaningful input. The Finance Bill 2024 introduced a motor vehicle value tax affecting motorists, while the Motorcycle Taxi (Boda Boda) Permit Regulations 2025 introduced new permit requirements, safety mandates, and operating zone restrictions — yet most riders only learn of these when enforcement begins. This problem is primarily caused by the absence of a mobile-native tool that proactively alerts transport workers, in plain language, of both the financial implications and regulatory compliance requirements of new legislation. A tool that delivers financial impact analysis and compliance checklists in shillings and cents could enable structured civic input during open participation windows and improve regulatory compliance, while ensuring no business revenue data is stored to protect users from inadvertent KRA exposure.

### Target User

| Dimension | Detail |
|---|---|
| **Primary user** | A bodaboda rider or transport micro-enterprise operator in Nairobi who relies on daily cash income and has no fixed accountant or legal advisor |
| **Tech comfort** | Comfortable with Web-App and SMS; not comfortable navigating government websites or PDF documents |
| **Language** | Swahili, English |
| **Current workflow** | Hears about new taxes and regulations only when they hit — e.g., learning about new permit requirements at a police checkpoint, or discovering the motor vehicle value tax at insurance renewal, with no advance warning or compliance guidance |

### The Specific Gap

1. **What's already there:** Mzalendo Trust's Dokeza platform offers bill annotation and summaries of Kenyan legislation.
2. **Why it falls short:** Dokeza is a *pull* model, it requires users to actively seek it out, offers no push notifications, no local-language translation, and its user base remains concentrated in major urban centres, leaving rural and semi-literate informal workers almost entirely excluded.
3. **The gap we fill:** A mobile-native tool that *proactively* alerts bodaboda riders and transport operators, via Web App and SMS, in English and Swahili, of exactly how a new bill will hit their pocket in shillings (financial impact) and what regulatory steps they need to take (compliance advice), before enforcement begins.

### Why It Matters

- **83.8% of Kenya's workforce (18.1 million people) works informally as of 2025** (Kenya Economic Survey 2026, KNBS)
- The informal sector generated **716,800 new jobs in 2025**, accounting for **87.2% of all new non-agricultural employment** — meaning this "informal majority" isn't shrinking, it's the engine of Kenya's job growth.
- When financial bills pass unnoticed, informal workers absorb sudden, undebated costs, for example with the 2.5% motor vehicle circulation tax, a boda rider suddenly owes an extra Ksh 5,000 at insurance renewal, or an Uber driver faces a Ksh 17,500 lump-sum hit with no forewarning and no seat at the table that shaped the policy.

---

## Run Instructions

### Prerequisites

- **Python 3.10+**
- **Tesseract OCR** (for scanned PDF extraction: `apt-get install tesseract-ocr` or Windows binary)
- **Google Firebase Firestore** (database for bill cache, citizen feedback, and SMS subscribers)
- **DeepSeek API Key** (for AI bill summarization & financial impact modeling)
- **Africa's Talking API Credentials** (for SMS alert delivery — Sandbox or Live)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/stevewanash/KeLegislate.git
cd KeLegislate

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install required Python packages
pip install -r requirements.txt

# 4. Configure application secrets
# Create the file src/.streamlit/secrets.toml with your API credentials:
cat << 'EOF' > src/.streamlit/secrets.toml
DEEPSEEK_API_KEY = "your-deepseek-api-key"
AFRICASTALKING_USERNAME = "sandbox"
AFRICASTALKING_API_KEY = "your-africastalking-api-key"
FIREBASE_SERVICE_ACCOUNT = """{
  ... your firebase service account JSON string ...
}"""
EOF

# 5. Seed demo bill data (Optional but recommended for offline testing)
python src/seed_demo.py

# 6. Launch the Streamlit web application
streamlit run src/main.py
```

---

## 📁 Project Structure

```
.
├── README.md                           ← You are here
├── LICENSE                             ← MIT License
├── requirements.txt                    ← Python package dependencies
├── packages.txt                        ← Linux system packages (Tesseract OCR)
├── docs/
│   └── problemstatement.md             ← Detailed problem statement & target personas
└── src/
    ├── main.py                         ← Streamlit application entry point (Tabs 1-4 UI)
    ├── llm_utils.py                    ← DeepSeek LLM prompts, summarizer, & impact modeler
    ├── feedback_utils.py               ← Firestore DB CRUD (Bills, Citizen Feedback, Subscribers)
    ├── hustle_profiles.py              ← Business profiles & KES metrics (BodaBoda, Uber/Bolt, Fleets)
    ├── sms_utils.py                    ← Africa's Talking SMS integration & notification dispatcher
    ├── scraper.py                      ← Scrapes active bill PDFs from parliament.go.ke
    ├── pdf_utils.py                    ← PDF text extraction with PyTesseract OCR fallback
    └── seed_demo.py                    ← Demo bill seeder (Motor Vehicle Circulation Tax Bill 2026)
```

## Approach & Architecture
<img width="2760" height="2120" alt="kelegislate_architecture_simple_white" src="https://github.com/user-attachments/assets/97d4df9b-3ac9-4f15-a1d5-9c5750b7e90a" />


**Presentation layer** — this is the only thing users actually see, that is, the Streamlit web interface. Users interact with the system through this one screen: selecting a Bill, filling out feedback, or viewing the dashboard.

**Application & logic layer** — this is the engine room. It's where five backend jobs happen: scraping the Bill off the National Assembly website, extracting text from the PDF (digitally or via OCR if it's scanned), sending that text to Gemini for summarization, saving citizen feedback, and querying data for the dashboard. This layer talks to the presentation layer above it, the data layer below it, and two outside services; National Assembly site and Gemini.

**Data layer** — where things get stored. Firestore holds everything permanent (summaries, impact analyses, feedback), while Streamlit's session memory holds the raw Bill text temporarily, just for the current session.

**External Services**
National Assembly site is where Bill PDFs come from.
Gemini is the AI that does the actual summarizing.

**The curved arrow on the right** shows data looping back up from storage to the screen. Once a Bill has been processed once, the summary is cached in Firestore, so the next person who selects that same Bill gets it instantly, no re-scraping, no re-OCR, no new Gemini call. That's the efficiency payoff of the three-tier design.

