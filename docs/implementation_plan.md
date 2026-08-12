# KeLegislate — Project Implementation Plan

> **Version**: 1.3 — Updated to redesign Impact page (example scenarios + interactive calculator instead of personalized impact), defer custom profiles and login to post-buildathon, reduce auth scope to feedback-only OTP gating. Retains LlamaParse extraction and phase ordering from v1.2.

> **Philosophy**: Get a working end-to-end system first, then harden it. A base product that ingests a bill, summarizes it, sends alerts, takes feedback, and shows insights — running on the new tech stack — is worth more than a half-built perfect architecture. The Impact page communicates the math through hypothetical example scenarios and an interactive calculator, avoiding the need for user data collection while still delivering practical value.

---

## Branching & Documentation Rules

### Branch Strategy

```
main (protected — always deployable)
 └── develop (integration branch — all phases merge here first)
      ├── phase-1/foundation          ← Database, project scaffolds, environment
      ├── phase-2/core-pipeline       ← Bill ingestion → AI summary → storage
      ├── phase-3/core-webapp-auth    ← Next.js frontend + Supabase Auth (feedback OTP only)
      ├── phase-4/alerts-feedback     ← SMS alerts, auth-gated feedback, example scenarios, dashboard
      ├── phase-5/scraper-automation  ← Automated scraping, Pub/Sub pipeline
      ├── phase-6/security-hardening  ← RLS, Vault encryption, CORS, audit logs
      ├── phase-7/rag-verification    ← pgvector embeddings, Verification Agent
      ├── phase-8/production-hardening← Circuit breakers, DLQ, monitoring, PWA
      └── hotfix/*                    ← Emergency fixes branched from main
```

### Rules

| Rule | Detail |
|---|---|
| **One branch per phase** | Each phase gets its own branch off `develop`. No mixing phase work across branches. |
| **Merge to `develop` at phase end** | When a phase is complete and tested, merge to `develop` via pull request. |
| **Tag on `main` merge** | When `develop` is merged to `main`, tag it: `v0.1.0` (Phase 1-2), `v0.2.0` (Phase 3-4 — working baseline), `v0.3.0` (Phase 5-6), `v1.0.0` (Phase 7-8 — production). |
| **Feature sub-branches** | If a phase is large, create feature branches off the phase branch: `phase-3/core-webapp/bill-list-page`. Merge back to the phase branch before merging phase to `develop`. |
| **No direct commits to `main`** | All code reaches `main` through `develop`. Exception: `hotfix/*` branches can go directly to `main` (then merge back to `develop`). |
| **Commit messages** | Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Prefix with phase: `feat(phase-2): add summarization agent`. |

### Documentation Rules

| Document | When to Update | Location |
|---|---|---|
| **`CHANGELOG.md`** | On every merge to `develop`. Summarize what changed. | Repo root |
| **`README.md`** | On every merge to `main`. Update setup instructions, architecture overview, and deployment steps. | Repo root |
| **`docs/api-contracts.md`** | Whenever an API endpoint is added or changed. | `docs/` |
| **`docs/environment-setup.md`** | Whenever a new service, secret, or dependency is introduced. | `docs/` |
| **Code docstrings** | Every public function must have a docstring. No exceptions. | Inline |
| **Architectural design** | Only updated when a structural decision changes. Not for minor code tweaks. | Repo root |
| **Phase completion notes** | Each phase branch should have a short `PHASE_NOTES.md` at the repo root summarizing what was built, what was deferred, and any known issues. Deleted after merge. | Repo root (temporary) |

---

## Phase Overview

```
Phase 1: Foundation                    ── Scaffolding, database, environment
Phase 2: Core Pipeline                 ── Bill ingestion → AI agents → stored results (incl. LlamaParse)
Phase 3: Core Web App + Feedback Auth  ── Next.js frontend + Supabase Auth (feedback OTP only)
Phase 4: Alerts, Feedback & Dashboard  ── SMS alerts, auth-gated feedback, example scenarios, interactive calculator, dashboard
────────────────────────────────────────────────────────────────────────
   ▲ MILESTONE: Working Baseline (v0.2.0) — end-to-end system works
────────────────────────────────────────────────────────────────────────
Phase 5: Scraper Automation & Pipeline ── Automated scraping, Pub/Sub event pipeline
Phase 6: Security Hardening            ── RLS, Vault encryption, CORS, audit logs
Phase 7: RAG & Verification           ── pgvector embeddings, Verification Agent
Phase 8: Production Hardening         ── Circuit breakers, DLQ, monitoring, PWA, optimization
────────────────────────────────────────────────────────────────────────
   ▲ MILESTONE: Production System (v1.0.0) — full architecture realized
────────────────────────────────────────────────────────────────────────
```

---

## Phase 1: Foundation

**Goal**: Set up the project structure, database schema, development environment, and deployment scaffolds so that all subsequent phases have solid ground to build on.

**Branch**: `phase-1/foundation`

### Step 1.1 — Supabase Project Setup

- Create the Supabase project (free tier).
- Set the database region (pick one close to East Africa — `ap-south-1` or `eu-west-1`).
- Record the project URL, anon key, and service role key.
- Enable the `pgvector` extension (needed later, but enable now to avoid migration issues).

### Step 1.2 — Database Schema (Core Tables Only)

Create only the tables needed for the baseline. The full ERD (Section 5 of architectural design) has 10 tables — implement these 6 now, defer `user_profiles`, `bill_chunks`, `llm_usage_log`, and `audit_log` to later phases:

| Table | Why Now |
|---|---|
| `bills` | Core — stores everything from ingestion to translation |
| `bill_tags` | Core — needed for subscriber matching and filtering |
| `subscribers` | Core — needed for SMS alerts |
| `feedback` | Core — needed for citizen feedback and dashboard. Includes `user_id` FK and `UNIQUE(bill_id, user_id)` constraint |
| `notifications` | Core — needed for delivery tracking |
| `tier_impact_cache` | Core — caches pre-computed predefined hustle tier impact results to bypass proxy timeouts and stores pre-generated example scenarios |

> [!NOTE]
> `user_profiles` is deferred to post-buildathon. Custom business profiles are not needed for the buildathon — the Impact page uses AI-generated example scenarios with hypothetical personas (based on predefined hustle profiles) instead of personalized impact calculations.

Write the SQL migration script. Include:
- All columns as defined in the ERD.
- Primary keys, foreign keys, unique constraints.
- Core indexes (`idx_bills_url_hash`, `idx_bills_ai_status`, `idx_bill_tags_industry`, `idx_subscribers_phone_hash`, `idx_subscribers_industry`, `idx_feedback_bill_id`, `idx_feedback_user_bill`, `idx_notifications_status`, `idx_tier_impact_lookup`).
- The `updated_at` auto-update trigger on `bills` and `subscribers`.
- **Skip for now**: RLS policies (Phase 6), Vault encryption (Phase 6), `bill_chunks` table (Phase 7), `user_profiles` table (post-buildathon).
- **Enable Supabase Auth** — needed from Phase 3 onward for feedback submission.

### Step 1.3 — FastAPI Backend Scaffold

Create the backend project structure:

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, CORS, lifespan
│   ├── config.py             # Environment variables, settings
│   ├── database.py           # Supabase client initialization
│   ├── api/
│   │   ├── __init__.py
│   │   ├── bills.py          # GET /api/bills, GET /api/bills/{id}
│   │   ├── impact.py         # GET /api/impact/{bill_id} (example scenario + compliance)
│   │   ├── feedback.py       # POST /api/feedback (auth required)
│   │   ├── subscribe.py      # POST/DELETE /api/subscribe
│   │   ├── dashboard.py      # GET /api/dashboard/stats
│   │   └── webhooks.py       # POST /api/webhooks/at-delivery
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestrator.py   # The DAG state machine
│   │   ├── summarizer.py     # Summarization Agent
│   │   ├── verifier.py       # Verification Agent
│   │   ├── translator.py     # Translation Agent
│   │   ├── impact_agent.py   # Financial Impact Agent (example scenario generation)
│   │   └── calculator.py     # Deterministic calculator tool (used by agent + interactive frontend)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── scraper.py        # Bill scraping (parliament.go.ke)
│   │   ├── extractor.py      # PDF text extraction + regex
│   │   ├── notifier.py       # SMS/WhatsApp dispatch via Africa's Talking
│   │   └── embedder.py       # Embedding generation (Phase 7)
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py        # Pydantic models for API requests/responses
│   └── utils/
│       ├── __init__.py
│       ├── phone.py          # Phone normalization (port from prototype)
│       └── regex_extractor.py # Financial value regex extraction
├── requirements.txt
├── Dockerfile
└── .env.example
```

- Initialize FastAPI with CORS (allow `localhost:3000` for dev).
- Set up Supabase Python client (`supabase-py`).
- Create `config.py` with all environment variables.
- Create the Pydantic schemas for the API contracts defined in Section 15 of the architectural design.
- Add a health check endpoint: `GET /health`.
- **Stub all routers** — they return placeholder 501 responses. Actual logic is added in subsequent phases.

### Step 1.4 — Next.js Frontend Scaffold

Create the frontend project structure:

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.js
│   │   ├── page.js           # Landing page
│   │   ├── bills/
│   │   │   ├── page.js       # Bill list — browse & filter all analyzed bills
│   │   │   └── [id]/
│   │   │       └── page.js   # Bill summary + feedback form
│   │   ├── impact/
│   │   │   ├── page.js       # Impact bill list — browse bills with financial/regulatory filter
│   │   │   └── [id]/
│   │   │       └── page.js   # Impact detail — example scenario (financial) or compliance checklist (regulatory) + feedback form
│   │   ├── dashboard/
│   │   │   └── page.js       # Insights dashboard — aggregated feedback & sentiment
│   │   └── subscribe/
│   │       └── page.js       # Alert subscription — phone, industry, language
│   ├── components/           # Reusable UI components (BillCard, SummaryView, ExampleScenario, ComplianceChecklist, InteractiveCalculator, FeedbackForm, etc.)
│   ├── lib/
│   │   ├── api.js            # FastAPI client wrapper
│   │   └── supabase.js       # Supabase browser client
│   └── styles/
│       └── globals.css       # Design system, CSS variables
├── public/
├── package.json
└── next.config.js
```

> **Page purpose clarity**: The `/bills` page is where citizens **browse and read** bill summaries — it's the core content page. The `/bills/[id]` page shows the full AI-generated summary with a feedback form at the bottom. The `/impact` page is a **separate top-level section** where citizens explore the practical impact of bills — it displays a bill list (identical to `/bills`) with a dropdown filter for "Financial" vs "Regulatory" bills. The `/impact/[id]` page shows a concise bill summary and, depending on bill type: an AI-generated **example scenario** with a hypothetical person (financial bills) or a **compliance checklist** (regulatory bills), plus a feedback form. The `/dashboard` page shows aggregated citizen sentiment. The `/subscribe` page handles SMS alert opt-in. **Note**: Only two bills are seeded initially (Finance Bill 2024 and Boda Boda Permit Regulations 2025) to demonstrate functionality; the corpus will be expanded as the system scales.

- Initialize Next.js (App Router).
- Set up the design system in `globals.css` — color palette, typography (Google Fonts), spacing scale, dark mode variables.
- Create the shell layout with navigation (Bills, Impact, Dashboard, Subscribe).
- All pages render placeholder content. Actual UI is built in Phase 3.
- Set up the API client wrapper (`lib/api.js`) that points to the FastAPI backend.

### Step 1.5 — Port Reusable Prototype Code

Some prototype code can be directly ported to the new structure:

| Prototype File | Port To | What Changes |
|---|---|---|
| `hustle_profiles.py` | `backend/app/models/hustle_profiles.py` | Remove Streamlit imports, keep data as-is |
| `sms_utils.py` → `normalize_phone()` | `backend/app/utils/phone.py` | Remove Streamlit imports |
| `pdf_utils.py` → text extraction logic | `backend/app/services/extractor.py` | Remove Streamlit caching/imports, adapt for FastAPI |
| `scraper.py` → scraping logic | `backend/app/services/scraper.py` | Remove Streamlit caching, adapt for FastAPI |

### Step 1.6 — Local Development Environment

- Create `.env.example` with all required variables (Supabase URL, Supabase keys, Gemini API key, Africa's Talking credentials).
- Write `docs/environment-setup.md` with step-by-step setup instructions.
- Verify: `uvicorn app.main:app --reload` starts the backend on `localhost:8000`.
- Verify: `npm run dev` starts the frontend on `localhost:3000`.
- Verify: Backend can connect to Supabase and read/write to the `bills` table.

### Phase 1 Exit Criteria

- [ ] Supabase project created with 5 core tables and indexes.
- [ ] FastAPI backend runs locally with stubbed routes and Supabase connection.
- [ ] Next.js frontend runs locally with shell layout and placeholder pages.
- [ ] Prototype utility code ported (hustle profiles, phone normalization, PDF extraction).
- [ ] `.env.example` and setup docs written.
- [ ] Merge `phase-1/foundation` → `develop`.

---

## Phase 2: Core Pipeline

**Goal**: A bill goes in, AI processes it, and a verified summary (English + Swahili) comes out and is stored in Supabase. This is the heart of the system — if this doesn't work, nothing else matters.

**Branch**: `phase-2/core-pipeline`

**Depends on**: Phase 1

### Step 2.1 — Seed a Test Bill (Simulated Ingestion)

Rather than building the full scraper automation first, simulate bill ingestion:

- Write a seed script (`backend/scripts/seed_bill.py`) that:
  1. Takes the Finance Bill 2024 PDF URL and Nairobi Motorcycle Taxi (Boda Boda) Permit Regulations 2025 PDF URL.
  2. Downloads the PDFs.
  3. Extracts text using **LlamaParse (Agentic Mode)** or falls back to the ported `extractor.py` (pdfplumber + OCR fallback).
  4. Inserts records into the `bills` table with `ai_status = 'ingested'`, `url_hash`, `title`, `source_url`, `bill_type` ('financial' and 'regulatory' respectively), and `extracted_text`.
  5. Optionally stores the PDFs in Supabase Storage.
- Run the seed script. Verify both bill records exist in Supabase with extracted text.
- This gives all subsequent steps real bills to work with.

> [!NOTE]
> LlamaParse is used here for the initial bill corpus only. The automated pipeline (Phase 5) uses pdfplumber with a quality-gate fallback to LlamaParse for poor extractions.

### Step 2.2 — Regex Value Extraction

- Implement `utils/regex_extractor.py`:
  - Extract percentages (`X%`, `X per cent`).
  - Extract monetary amounts (`KES X`, `Ksh X`, `X shillings`).
  - Extract dates.
  - For each match, capture: value, raw match text, ±200 characters of surrounding context.
- Run it against the seeded bill's extracted text.
- Store results in `bills.regex_extractions` (JSONB).
- Update `bills.ai_status` to `'extracted'`.

### Step 2.3 — Gemini Client Setup

- Set up the Google Generative AI Python SDK (`google-genai`).
- Create `backend/app/agents/gemini_client.py`:
  - Initialize the Gemini client with the API key.
  - Create wrapper functions for calling Gemini 2.5 Flash and Gemini 3.5 Flash.
  - Include token counting and latency measurement in the response.
  - Add basic error handling (retry on transient errors, raise on permanent).

### Step 2.4 — Summarization Agent

- Implement `agents/summarizer.py`:
  - Input: Extracted bill text + regex extractions.
  - LLM: Gemini 2.5 Flash.
  - Prompt: Request structured output — English summary with section citations, key implications, and industry tags (from the canonical `INDUSTRIES` list).
  - Output: Pydantic model (`BillSummary`) with fields: `summary_en`, `implications_citizens`, `implications_business`, `industry_tags`, `source_citations`.
  - Use Gemini's structured output / JSON mode to enforce the schema.
- Run against the seeded bill. Verify the summary is coherent and tags are from the canonical list.
- Store `ai_summary_en` in the `bills` table. Insert tags into `bill_tags`.
- Update `bills.ai_status` to `'summarized'`.

### Step 2.5 — Translation Agent

- Implement `agents/translator.py`:
  - Input: Verified English summary.
  - LLM: Gemini 2.5 Flash.
  - Prompt: Translate to Swahili, preserve all numerical values exactly, preserve section citations, maintain structure.
  - Output: Swahili summary text.
- Run against the summarized bill. Verify Swahili output preserves numbers and citations.
- Store `ai_summary_sw` in the `bills` table.
- Update `bills.ai_status` to `'translated'`.

> [!NOTE]
> The Verification Agent (Step 2.6 below) is built in this phase but kept **optional** for the baseline. During Phase 2, summarization goes directly to translation. Full verification (with RAG grounding) is wired in during Phase 7 after pgvector is set up. However, the basic verification logic (checking regex values against summary claims) is implemented here as a foundation.

### Step 2.6 — Verification Agent (Basic — Without RAG)

- Implement `agents/verifier.py`:
  - Input: AI summary + regex-extracted values.
  - LLM: Gemini 3.5 Flash.
  - Prompt: Check every numerical claim in the summary against the regex-extracted values. Flag discrepancies.
  - Output: `VerificationResult` with `verified: bool`, `issues: list`, `confidence: float`.
  - Max 2 retries (if not verified, feed issues back to summarizer).
- For now, this runs as a **validation step** — if verification fails after 2 retries, the bill is still stored but flagged with a low `verification_score`.
- Full RAG-grounded verification (checking section citations against embedded chunks) is deferred to Phase 7.

### Step 2.7 — Calculator Tool

- Implement `agents/calculator.py`:
  - A safe Python calculator that evaluates mathematical expressions using **`ast`-based node whitelisting** — not raw `eval()`, but not a from-scratch parser either. The approach: parse the expression string with `ast.parse()`, walk the AST tree, and only allow nodes for numbers (`ast.Constant`), binary operators (`ast.BinOp`: `+`, `-`, `*`, `/`, `%`, `**`), unary operators (`ast.UnaryOp`: negation), and parenthesized grouping. Reject anything else (function calls, attribute access, imports, string operations). This gives the safety of a sandboxed evaluator with the simplicity of Python's built-in parser.
  - Supports: `+`, `-`, `*`, `/`, `%`, `**`, parentheses, decimals, negative numbers.
  - Exposed as a Gemini function calling definition.
- Write tests. This is deterministic code — 100% test coverage is expected.

### Step 2.8 — Financial Impact Agent (Example Scenario Generation)

- Implement `agents/impact_agent.py`:
  - Input: Bill summary, regex extractions, bill type (`financial` or `regulatory`), representative hustle profile metrics (from predefined profiles).
  - LLM: Gemini 3.5 Flash with the calculator tool available via function calling.
  - **For financial bills**: Prompt the agent to generate an **Example Scenario** — a worked financial impact breakdown for a **hypothetical person** (e.g., "Mama Njeri, a matatu operator with a vehicle worth KES 800,000"). The scenario must include:
    - Key numbers and percentages from the bill
    - Who is affected
    - Where values were sourced (sections, clauses — best effort; full accuracy depends on RAG in Phase 7)
    - Step-by-step math breakdown using the calculator tool (not LLM math)
    - A `calculator_formula` — the deterministic formula that the interactive calculator (Phase 4) will use to let users compute their own values
  - **For regulatory bills**: Prompt the agent to generate a **Compliance Checklist** — an actionable guide for what the user needs to do to comply. Each item includes: action required, deadline (if applicable), relevant bill section reference.
  - Output (financial): `ExampleScenario` with `scenario_persona`, `concise_summary`, `key_figures`, `math_breakdown`, `sources`, `calculator_formula`, `risk_level`.
  - Output (regulatory): `ComplianceGuide` with `concise_summary`, `compliance_checklist[]`, `sources`, `regulatory_changes`.
  - The predefined hustle profiles (e.g., BodaBoda Rider with vehicle_value: 150,000 KES) are used as the basis for the hypothetical persona. The AI picks the most representative profile for each bill.
- Run for one bill (e.g., Finance Bill 2024 with BodaBoda Rider profile) against the seeded bill. Verify the calculator tool is being called (not LLM math).
- Run for the regulatory bill (Boda Boda Permit Regulations 2025). Verify compliance checklist is generated.

### Step 2.9 — DAG Orchestrator

- Implement `agents/orchestrator.py`:
  - The `PipelineState` dataclass (as defined in Section 13.3 of the architectural design).
  - The `run_pipeline(bill_id)` function that runs: Extract → Regex → Summarize → (Verify) → Translate.
  - Each step updates the state and persists to Supabase.
  - If any step fails, status is set to `'failed'` and the error is logged.
- Wire the orchestrator to a **manual trigger endpoint**: `POST /api/admin/run-pipeline/{bill_id}`.
  - This is a temporary admin endpoint (no auth) for testing. Removed in Phase 6.
- Run the full pipeline end-to-end on the seeded bill. Verify the bill transitions through all statuses and the final summary + translation is stored.

### Step 2.10 — Impact API Endpoint

- Implement `api/impact.py`:
  - `GET /api/impact/{bill_id}` — returns the pre-generated example scenario (financial bills) or compliance guide (regulatory bills).
  - Loads the bill metadata and type from Supabase.
  - For financial bills: invokes the Financial Impact Agent to generate the example scenario. The agent uses predefined hustle profile metrics to construct the hypothetical persona.
  - For regulatory bills: invokes the Financial Impact Agent to generate the compliance guide.
  - Returns the structured JSON response including `concise_summary`, `example_scenario` or `compliance_checklist`, `pdf_url`, and `sources`.
  - **No user data is needed** — the example scenario uses a hypothetical persona, not the user's personal information.
- Test: Call the endpoint with the seeded financial bill. Verify example scenario JSON response with math breakdown.
- Test: Call the endpoint with the seeded regulatory bill. Verify compliance checklist JSON response.

### Step 2.11 — Bills API Endpoints

- Implement `api/bills.py`:
  - `GET /api/bills` — paginated list of bills with `ai_status = 'translated'`, sorted by `created_at DESC`. Returns: `id`, `title`, `tags`, `created_at`, `ai_status`.
  - `GET /api/bills/{id}` — full bill detail including `ai_summary_en`, `ai_summary_sw`, `regex_extractions`, `source_url`.
- Test: Both endpoints return data for the seeded bill.

### Phase 2 Exit Criteria

- [x] Seed script inserts a real bill into Supabase with extracted text.
- [x] Regex extraction finds values in the bill text and stores them as JSONB.
- [x] Summarization Agent produces an English summary with citations and industry tags.
- [x] Translation Agent produces a Swahili translation.
- [x] Verification Agent performs basic numeric claim checking (without RAG).
- [x] Calculator tool is deterministic and tested.
- [x] Financial Impact Agent produces example scenario with KES-denominated math breakdown using the calculator.
- [x] Financial Impact Agent produces compliance checklist for regulatory bills.
- [x] DAG orchestrator runs the full pipeline end-to-end.
- [x] `GET /api/bills`, `GET /api/bills/{id}`, and `GET /api/impact/{bill_id}` return correct data.
- [ ] Merge `phase-2/core-pipeline` → `develop`. (need to fix gemini api client first, currently using deepseek fallback)

---

## Phase 3: Core Web App + Feedback Auth

**Goal**: A citizen can open the web app, see a list of analyzed bills, read a bill summary (in English or Swahili) with a feedback form, and explore the practical impact of bills on a separate top-level Impact page — viewing example scenarios (financial) or compliance checklists (regulatory). Phone OTP login is available for feedback submission (one-person-one-vote integrity). Only two demo bills are seeded initially to demonstrate end-to-end functionality.

**Branch**: `phase-3/core-webapp-auth`

**Depends on**: Phase 2

### Step 3.1 — Design System & Global Styles

- Finalize the CSS design system in `globals.css`:
  - Color palette (Light mode primary), typography (Inter or Outfit from Google Fonts), spacing scale.
  - Component-level styles: cards, buttons, badges, form inputs, tables, loading spinners.
  - Responsive breakpoints (mobile-first: 375px, tablet: 768px, desktop: 1024px).
- This is the visual foundation. All subsequent UI work uses these styles.

### Step 3.2 — Supabase Auth Setup

- Enable Phone OTP authentication in the Supabase project.
- Set up **Africa's Talking Custom SMS Webhook** in the Supabase dashboard under Auth -> Providers -> Phone -> SMS Provider -> Custom SMS Webhook. Write a FastAPI backend endpoint (`POST /api/auth/send-sms`) to handle this:
  - **Secret Header Verification**: Require and verify the `x-supabase-webhook-secret` header against a shared configuration secret (`SUPABASE_SMS_WEBHOOK_SECRET`) to prevent unauthorized SMS balance draining.
  - **Strict Response Schema**: The endpoint **must** return an empty JSON object `{}` with an HTTP 200 status code (`JSONResponse(content={}, status_code=200)`). Returning custom status keys like `{"status": "success"}` causes Supabase to register a webhook failure and retry, exhausting SMS credit.
  - On validation, dispatch the OTP SMS text to Africa's Talking SMS API.
- Set up a local test bypass phone number in the Supabase Auth dashboard (e.g., `+254700000000` with verification code `123456`) to ensure testing/demo resilience without carrier network issues.
- Set up the Supabase Auth client in the Next.js frontend (`lib/supabase.js`).
- Create the login flow:
  - Phone number input → `supabase.auth.signInWithOtp({phone})` → OTP sent via Africa's Talking webhook → OTP input → `supabase.auth.verifyOtp({phone, token, type: 'sms'})` → JWT issued.
  - Store JWT in browser session.
  - Show auth state in the navigation (logged in/out indicator, "Sign In" button).
- Create `backend/app/middleware/auth.py`:
  - Verify Supabase JWTs using the Supabase public key.
  - Support **optional auth** (public endpoints work without JWT; authenticated endpoints return richer data or enable gated features).
  - Extract `user_id` from JWT for authenticated requests.
  - Apply auth to: `POST /api/feedback`, `POST /api/subscribe`, `DELETE /api/subscribe`.
  - Keep public: `GET /api/bills`, `GET /api/bills/{id}`, `GET /api/impact/{bill_id}`, `GET /api/dashboard/stats`.

### Step 3.3 — Landing Page

- Build the `/` landing page:
  - Hero section explaining what KeLegislate does.
  - Call-to-action: "Browse Bills" → navigates to `/bills`.
  - "See Impact" → navigates to `/impact`.
  - "Get Alerts" → navigates to `/subscribe`.
- Mobile-optimized layout.

### Step 3.4 — Bill List Page (The Browsing Experience)

This is the **primary entry point** for most citizens. Users come here to browse and read about bills — not necessarily to calculate financial impact. The page should feel like a clean, scannable news feed of legislation.

- Build `/bills`:
  - Fetches `GET /api/bills` on load.
  - Renders bill cards: title, short summary excerpt (first 150 chars of `ai_summary_en`), industry tag badges, date, status indicator.
  - Pagination (or infinite scroll).
  - Click on a card → navigates to `/bills/{id}`.

### Step 3.5 — Bill Summary Page

This page is dedicated to **reading and understanding** the bill. The user reads the full AI-generated summary with key implications, industry tags, and source citations. A feedback form at the bottom allows authenticated users to submit their stance.

- Build `/bills/[id]`:
  - Fetches `GET /api/bills/{id}` on load.
  - **Summary section (top of page, immediately visible)**:
    - Full AI-generated summary (default: English).
    - Language toggle (EN/SW) — switches between `ai_summary_en` and `ai_summary_sw`.
    - Key implications for citizens (bulleted list).
    - Key implications for businesses/government (bulleted list).
    - Industry tag badges.
    - Source citations (linked to bill sections if available).
    - Link to the original bill PDF.
  - **Feedback form (bottom of page)**:
    - Support stance radio (Support/Oppose/Neutral).
    - Star rating (1-10).
    - Concerns text area.
    - Show a prompt — "Please verify your phone number to submit feedback. This ensures one-person-one-vote integrity." with a "Sign In" button that triggers the OTP flow.
    - On HTTP 409 (duplicate): show "You've already submitted feedback for this bill."
    - Success toast.

### Step 3.6 — Impact Bill List Page

The **Impact section** is a top-level area where citizens explore the practical effects of bills. It presents the same bills as `/bills`, but with a filter dropdown to focus on financial or regulatory bills and links to dedicated impact detail pages.

- Build `/impact`:
  - Fetches `GET /api/bills` on load (same endpoint as `/bills`).
  - Renders bill cards identical to `/bills` page: title, short summary excerpt, tag badges (with `financial` and `regulatory` badge styling), date, status indicator.
  - **Dropdown filter** at top: "All Bills" / "Financial Bills" / "Regulatory Bills" — filters by `bill_type` field.
  - Click on a card → navigates to `/impact/{id}`.

### Step 3.7 — Impact Detail Page (Financial Bills)

When a user clicks on a **financial bill** in the Impact section, they see a concise summary of the bill's financial implications and a worked **Example Scenario** showing the math through a hypothetical person.

- Build `/impact/[id]` (financial bill variant):
  - Fetches `GET /api/impact/{bill_id}` on load.
  - **Concise bill summary (top section)**:
    - More concise than the `/bills/[id]` summary — focused on the major numbers, percentages, who's affected.
    - Where values were sourced (sections, clauses — best effort for now; full accuracy depends on RAG in Phase 7).
  - **Example Scenario section**:
    - Heading: "How this bill could affect a typical [persona name]" (e.g., "How this bill could affect Mama Njeri, a matatu operator").
    - Shows the hypothetical person's profile (e.g., "Vehicle value: KES 800,000, Monthly revenue: KES 60,000").
    - Step-by-step math breakdown: "Under this bill, her annual vehicle circulation tax would be: KES 800,000 × 2.5% = KES 20,000".
    - Sources cited (bill sections, clauses).
    - Risk level badge (LOW/MEDIUM/HIGH).
  - **Interactive Calculator placeholder**:
    - Show text: "Interactive calculator coming soon — input your own values to see your personal impact."
    - Actual calculator implementation is in Step 4.5A (Phase 4, nice-to-have).
  - **Link to original bill PDF**.
  - **Feedback form (bottom of page)**:
    - Same `FeedbackForm` component as the bill summary page (Support/Oppose/Neutral, star rating, concerns).
    - Auth-gated identically — when subscribe is clicked otp authentication prompt if not authenticated, submit after authentication.
    - Shares the same `POST /api/feedback` endpoint and `UNIQUE(bill_id, user_id)` deduplication.

### Step 3.8 — Impact Detail Page (Regulatory Bills)

When a user clicks on a **regulatory bill** in the Impact section, they see a concise summary of the regulatory changes and a **Compliance Checklist** as a guide for what the user ought to do.

- Build `/impact/[id]` (regulatory bill variant — same route, different content based on `bill_type`):
  - Fetches `GET /api/impact/{bill_id}` on load.
  - **Concise bill summary (top section)**:
    - Focused on the major regulatory changes.
    - Where changes were sourced (sections, clauses — best effort for now).
  - **Compliance Checklist section**:
    - A clear, actionable guide detailing what the user needs to do to avoid repercussions.
    - Each item shows: action required, deadline (if applicable), and relevant bill section reference.
    - Styled as an informational checklist (not interactive checkboxes — purely guidance).
  - **Link to original bill PDF**.
  - **Feedback form (bottom of page)**:
    - Same `FeedbackForm` component, auth-gated identically.
    - Shares the same `POST /api/feedback` endpoint and `UNIQUE(bill_id, user_id)` deduplication.

### Step 3.9 — Navigation & Responsive Layout

- Build the app shell:
  - Mobile and desktop top navigation bar.
  - Navigation items: **Home**, **Bills**, **Impact**, **Dashboard**, **Subscribe**.
  - Responsive breakpoints working correctly.
  - Page transitions (subtle fade or slide).

### Phase 3 Exit Criteria

- [x] Phone OTP login works end-to-end (frontend → Supabase Auth → JWT) — triggered from feedback form.
- [x] Auth middleware validates tokens on protected endpoints (`POST /api/feedback`, subscription endpoints).
- [x] Landing page renders with hero, stats, and CTAs (Bills, Impact, Alerts).
- [x] Bill list page fetches and displays two demo bills from the API with tag filtering.
- [x] Bill summary page (`/bills/[id]`) shows English/Swahili summary with language toggle and feedback form.
- [x] Impact bill list page (`/impact`) shows bills with financial/regulatory filter dropdown.
- [x] Impact detail page (`/impact/[id]`) shows example scenario for financial bills with math breakdown.
- [x] Impact detail page (`/impact/[id]`) shows compliance checklist for regulatory bills.
- [x] Both impact detail pages include PDF link and auth-gated feedback form.
- [x] Responsive layout works on mobile (375px) and desktop (1024px).
- [x] Merge `phase-3/core-webapp-auth` → `develop`.

---

## Phase 4: Alerts, Feedback & Dashboard

**Goal**: Complete the civic engagement loop. Citizens can subscribe to SMS alerts, submit feedback on bills, and view aggregated insights. The interactive calculator is added to financial impact pages as a nice-to-have. After this phase, the **working baseline** is complete.

**Branch**: `phase-4/alerts-feedback`

**Depends on**: Phase 3

### Step 4.1 — Subscription API

- Implement `api/subscribe.py`:
  - `POST /api/subscribe`: Accepts `{phone, industries[], language, channels[]}`. Normalizes phone. Computes `phone_hash` (SHA-256). Upserts subscriber record. **For the baseline, phone numbers are stored in plain text** — encryption via Vault is added in Phase 6.
  - `DELETE /api/subscribe`: Marks subscriber as `is_active = FALSE`.
  - Returns confirmation with subscriber ID.
- Wire Africa's Talking SDK for a confirmation SMS on subscribe.

### Step 4.2 — Subscription Page UI

- Build `/subscribe`:
  - Phone number input with E.164 validation (inline).
  - Industry checkboxes (multi-select from 8 options).
  - Language radio (English/Swahili).
  - Channel selection (SMS/WhatsApp/both).
  - Consent dialog with privacy explanation.
  - Submit → calls `POST /api/subscribe`.
  - Success confirmation with "You're subscribed!" message.

### Step 4.3 — Notification Service (Manual Trigger)

- Implement `services/notifier.py`:
  - Accepts a `bill_id`.
  - Fetches the bill's tags from `bill_tags`.
  - Queries `subscribers` for active subscribers whose `industry_tags` overlap with the bill's tags.
  - Groups matched subscribers by hustle tier.
  - For each unique tier, invokes the Financial Impact Agent (from Phase 2) to compute the tier-level impact.
  - Formats SMS messages using the impact result and subscriber's preferred language.
  - Sends via Africa's Talking (single send first — batch sending is Phase 8).
  - Creates `notifications` records with status tracking.
  - Enforces `MAX_SMS_FAN_OUT` (500 default, via env var).
- Wire to a **manual trigger endpoint**: `POST /api/admin/send-alerts/{bill_id}`.
  - This triggers alert fan-out for a specific bill. Temporary admin endpoint.

### Step 4.4 — Delivery Receipt Webhook

- Implement `api/webhooks.py`:
  - `POST /api/webhooks/at-delivery`: Receives Africa's Talking delivery receipts.
  - Minimal work: verify signature (if available), extract `messageId` and `status`, execute a single `UPDATE notifications SET status = $1 WHERE at_message_id = $2`.
  - Return HTTP 200 immediately.

### Step 4.5 — Feedback API (Auth Required)

- Implement `api/feedback.py`:
  - `POST /api/feedback`: Accepts `{bill_id, support, rating, concerns}`.
  - **Requires authentication** — JWT must be present in the Authorization header. Return HTTP 401 if missing.
  - Extracts `user_id` from the verified JWT.
  - Inserts into `feedback` table with `user_id`.
  - The `UNIQUE(bill_id, user_id)` constraint prevents duplicate submissions at the database level.
  - Returns HTTP 201 on success, 401 on missing auth, 409 on duplicate.

### Step 4.6 — Feedback UI (Auth-Gated)

The feedback form component was already built in Phase 3 (Steps 3.5, 3.7, and 3.8) and is present on the bill summary page (`/bills/[id]`) and both impact detail pages (`/impact/[id]`). This step focuses on **polishing and hardening** the feedback experience:

- Ensure the shared `FeedbackForm` component works identically on all pages (bill summary, financial impact, regulatory impact).
- Verify auth-gating behavior: login prompt when unauthenticated, form when authenticated.
- Verify `UNIQUE(bill_id, user_id)` constraint: submitting from any page counts as the same feedback (no double-voting by submitting on multiple pages).
- On HTTP 409 (duplicate): show "You've already submitted feedback for this bill" on whichever page the user is on.
- Success toast animation and state reset after submission.

### Step 4.7 — Interactive Calculator (Nice-to-Have)

After reading the example scenario on the financial impact detail page, users may want to compute their own numbers. The interactive calculator provides this without requiring any user data to be stored or sent to a server.

- Build the `InteractiveCalculator` component for `/impact/[id]` (financial bills only):
  - Appears **below the example scenario section**, replacing the placeholder text.
  - Uses the `calculator_formula` field from the API response (pre-loaded by the Financial Impact Agent).
  - **Input fields** are dynamically generated from the formula's variables (e.g., "Enter your vehicle value", "Enter your monthly revenue").
  - **Deterministic calculation** — pure client-side JavaScript math, no AI calls, no network requests.
  - **Session-based** — no values are stored in any database, cookie, or local storage. Values exist only in component state and are lost on page refresh.
  - Results shown inline below the calculator: "Based on your values, your estimated annual cost would be: KES X".
  - Clear labeling: "This is an estimate based on the bill's provisions. Consult a professional for specific advice."
- This step is **nice-to-have** — if time is tight, the placeholder text from Phase 3 remains.

### Step 4.9 — Dashboard API

- Implement `api/dashboard.py`:
  - `GET /api/dashboard/stats?bill_id={id}`: Returns aggregated feedback for a bill — total feedback count, support percentage breakdown, average rating, top concerns.
  - Global stats (total bills, total feedback) when no `bill_id` is provided.

### Step 4.10 — Insights Dashboard UI

- Build `/dashboard`:
  - Bill selector (dropdown or click from bill list).
  - Pie chart: support distribution (Support/Oppose/Neutral).
  - Bar chart: rating distribution (1-5 stars).
  - Key metrics: total responses, average rating, support percentage.
  - Common concerns list (top extracted keywords/phrases).
  - AI-generated insights button (calls Gemini to analyze aggregated feedback — same as prototype's `generate_insights`).

### Step 4.10 — End-to-End Smoke Test

This is the critical validation. Walk through the entire flow:

1. **Seed a bill** (or use the ones from Phase 2).
2. **Run the pipeline** via `POST /api/admin/run-pipeline/{bill_id}`.
3. **View the bill summary page** (`/bills/[id]`) — verify summary, language toggle, and feedback form render correctly.
4. **Browse the Impact page** (`/impact`) — verify bill list with financial/regulatory filter dropdown.
5. **View a financial bill impact** (`/impact/[id]`) — verify concise summary and example scenario with math breakdown render.
6. **View a regulatory bill impact** (`/impact/[id]`) — verify concise summary and compliance checklist render.
7. **Test the interactive calculator** (if implemented) — enter values, verify deterministic calculation.
8. **Subscribe** a phone number to alerts.
9. **Trigger alerts** via `POST /api/admin/send-alerts/{bill_id}` — verify SMS is received on the test phone.
10. **Log in** via phone OTP (triggered from feedback form).
11. **Submit feedback** on the bill summary page (auth-gated).
12. **Attempt duplicate feedback** on the impact page — verify HTTP 409 (same `bill_id + user_id` constraint).
13. **View the dashboard** — verify the feedback appears in charts and metrics.

If all 13 steps work, the baseline is complete.

### Phase 4 Exit Criteria

- [ ] Subscription API creates/updates subscriber records.
- [ ] Subscription page UI works with phone validation and consent.
- [ ] Notification service matches subscribers to bills by industry, computes tier-level impacts, and sends SMS.
- [ ] Delivery receipt webhook updates notification status.
- [ ] Feedback API requires auth; `UNIQUE(bill_id, user_id)` enforced at database level.
- [ ] Feedback form on bill summary page, financial impact page, and regulatory impact page gates submission behind login.
- [ ] Feedback deduplication works across all pages (same `bill_id + user_id` constraint).
- [ ] Example scenario renders correctly for financial bills on `/impact/[id]`.
- [ ] Compliance checklist renders correctly for regulatory bills on `/impact/[id]`.
- [ ] Interactive calculator works on financial impact pages (if implemented as nice-to-have).
- [ ] Dashboard API returns aggregated feedback stats.
- [ ] Insights dashboard renders charts and metrics.
- [ ] End-to-end smoke test passes (all 13 steps).
- [ ] Merge `phase-4/alerts-feedback` → `develop` → `main`. **Tag: `v0.2.0` (Working Baseline)**.

---

> [!IMPORTANT]
> ### Milestone: Working Baseline (v0.2.0)
> At this point, KeLegislate is a **functional system** on the new tech stack. A bill can be ingested, processed by AI agents, displayed on a web app, trigger SMS alerts to subscribers, accept citizen feedback, and show aggregated insights. The remaining phases harden, automate, and secure this baseline.

---

## Phase 5: Scraper Automation & Background Task Pipeline

**Goal**: Replace manual bill seeding with automated scraping and replace manual pipeline triggers with FastAPI's native in-memory `BackgroundTasks` asynchronous queue inside a single backend container.

**Branch**: `phase-5/scraper-automation`

**Depends on**: Phase 4 (working baseline)

### Step 5.1 — Scraper Enhancement & Fallback

- Enhance the parliament.go.ke BeautifulSoup scraper in `services/scraper.py`:
  - Ensure robust HTML parsing for the bill listing pages.
  - Parse the response: extract `title`, `url` for each bill.
  - **Local Seed/Storage Fallback**: If parliament.go.ke is down or timing out, check a designated local directory (`seed_bills/`) or Supabase Storage bucket for preloaded bill PDFs, processing them in order.
  - **Stale Job Recovery Sweep**: Query Supabase for any bills currently stuck in progress (`ai_status IN ('ingested', 'extracted', 'summarized')`) where `updated_at` is older than 15 minutes (indicating a container crash or recycle). Re-queue each stuck bill: `BackgroundTasks.add_task(process_bill_pipeline, bill_id)`.
  - Compute `url_hash = SHA256(url)[:16]` for each bill.
  - Query Supabase: skip bills where `url_hash` already exists.
  - For new bills: insert metadata as `ingested` and queue the background task: `BackgroundTasks.add_task(process_bill_pipeline, bill_id)`.
  - Add error handling and retry logic for transient HTTP failures.

### Step 5.2 — Backend Task Orchestration

- Implement the `/api/tasks/scrape` endpoint in `api/tasks.py` to trigger the scraper. Authenticate requests using a custom shared secret token (OIDC token/API Secret) set in the headers.
- Write the end-to-end background task orchestrator in `services/orchestrator.py`:
  - `process_bill_pipeline(bill_id)`:
    1. Text extraction (pdfplumber/OCR with LlamaParse fallback).
    2. Structural regex splitting (PART, Section, Schedule) + vector embedding generation.
    3. AI Pipeline DAG (Summarize → Verify with checklist → Translate).
    4. Generate and cache impact content:
       - For **financial bills**: Generate the Example Scenario (hypothetical persona + math breakdown + calculator formula) using the most representative predefined hustle profile. Cache in the `tier_impact_cache` table.
       - For **regulatory bills**: Generate the Compliance Guide (regulatory changes + compliance checklist). Cache in the `tier_impact_cache` table.
       - For **SMS alerts**: Pre-compute tier-level financial impact summaries for all matched predefined hustle tiers. Cache for notification formatting.
    5. Subscriber matching & alert fan-out (reads cached tier impacts, formats and dispatches SMS/WhatsApp alerts via Africa's Talking with a KDPA unsubscribe disclaimer).
- Catch all tracebacks, log them to the database, and set the bill's `ai_status` to `'failed'` with error details persisted in `ai_error` if any stage fails.

### Step 5.3 — Cloud Scheduler Setup

- Create the `scrape-bills` Cloud Scheduler job:
  - HTTP POST to `/api/tasks/scrape` with the API secret token header, every 6 hours (`0 */6 * * *`).
- Create the `supabase-keepalive` job:
  - HTTP GET to the FastAPI `/api/health` endpoint, every 6 hours (offset from scraper). The `/api/health` handler must execute a lightweight query (e.g. `SELECT 1;`) to register activity and prevent the free tier DB from pausing.

### Step 5.4 — Consolidated Cloud Run Deployment

- Build the Docker image for the backend containing all python dependencies and system packages (e.g. `tesseract-ocr`, `ghostscript`).
- Deploy a single consolidated service to Cloud Run (free tier) with always-on CPU allocation and minimum instances set to 1 to prevent GCP's default request-based CPU throttling from freezing FastAPI's asynchronous `BackgroundTasks` mid-execution:
  - **FastAPI Monolith**: 1 vCPU, 1 GB RAM. Deploy using the gcloud CLI command:
    ```bash
    gcloud run deploy kelegislate-api \
      --image [IMAGE_URL] \
      --no-cpu-throttling \
      --min-instances 1
    ```
- Configure environment variables (Supabase keys, Gemini key, AT credentials, Webhook secrets, custom bypass codes).
- Deploy the Next.js frontend to Vercel.
- Update CORS to allow the Vercel domain.

### Step 5.5 — Defer Pub/Sub & DLQ to Post-Buildathon Phase

- Document the migration path to a decoupled multi-service Pub/Sub architecture for post-buildathon scaling (Phase 9). During the buildathon, do not deploy any Pub/Sub topics or Dead Letter Queues to avoid deployment delays.

### Phase 5 Exit Criteria

- [ ] Parliament.go.ke scraper works reliably and falls back to the seed directory if down.
- [ ] In-memory background task queue processes ingest → extract → analyze → categorize → notify end-to-end.
- [ ] Cloud Scheduler triggers scraping endpoint securely every 6 hours.
- [ ] Backend deployed as a single Cloud Run monolith, frontend on Vercel.
- [ ] A new bill published on the Parliament site is automatically detected, processed, and subscribers are alerted.
- [ ] Merge `phase-5/scraper-automation` → `develop`.

---

## Phase 6: Security Hardening

**Goal**: Secure the system with proper data encryption, row-level access control, audit logging, and CORS hardening. Auth was already set up in Phase 3.

**Branch**: `phase-6/security-hardening`

**Depends on**: Phase 5

### Step 6.1 — Phone Number Encryption (Supabase Vault)

- Enable Supabase Vault.
- Modify the subscription flow:
  - Encrypt phone numbers using Supabase Vault before storing.
  - Store `phone_hash` (SHA-256, full hash) for lookups.
  - Store `phone_encrypted` (Vault-encrypted) for decryption at alert send time.
  - Remove plain-text `phone_number` column.
- Update the notifier to decrypt via Vault at send time.

### Step 6.2 — Custom Profile Encryption

- Encrypt the `custom_metrics` JSONB field in `user_profiles` at the application level before writing to Supabase.
- Decrypt on read (in the `GET /api/profile` endpoint and impact calculation flow).
- Log decryption events in the audit log.

### Step 6.3 — Row Level Security (RLS)

- Enable RLS on all user-facing tables.
- Implement policies as defined in Section 16.3 of the architectural design:
  - `bills` / `bill_tags`: SELECT allowed for all.
  - `subscribers`: SELECT/UPDATE/DELETE only where `user_id = auth.uid()`.
  - `feedback`: INSERT where `auth.uid() IS NOT NULL`; SELECT restricted to own records or aggregated.
  - `user_profiles`: SELECT/INSERT/UPDATE/DELETE only where `user_id = auth.uid()`.
  - `notifications`: SELECT only for own subscriber record.
  - `bill_chunks`, `llm_usage_log`, `audit_log`: No public access.

### Step 6.4 — Audit Logging

- Create the `audit_log` table (deferred from Phase 1).
- Log sensitive operations: `phone_decrypt`, `profile_decrypt`, `subscriber_create`, `subscriber_delete`, `profile_delete`, `data_export`.
- Add audit log writes to the notifier (on phone decryption), profile handler (on profile access/deletion), and subscription handler (on create/delete).

### Step 6.5 — CORS Hardening

- Lock CORS to production domains only:
  - `https://kelegislate.vercel.app`
  - `http://localhost:3000` (dev only, removed in production builds)
- No wildcard origins.

### Phase 6 Exit Criteria

- [ ] Phone numbers are encrypted at rest via Supabase Vault.
- [ ] Custom profile metrics are encrypted at application level.
- [ ] RLS policies enforce data isolation per user.
- [ ] Audit log captures sensitive operations.
- [ ] CORS restricted to known domains.
- [ ] Merge `phase-6/security-hardening` → `develop` → `main`. **Tag: `v0.3.0`**.

---

## Phase 7: RAG & Verification Enhancement

**Goal**: Add vector embeddings for RAG retrieval and wire the full Verification Agent with source-grounded fact-checking.

**Branch**: `phase-7/rag-verification`

**Depends on**: Phase 6

### Step 7.1 — Bill Chunks Table & Embeddings

- Create the `bill_chunks` table (deferred from Phase 1).
- Implement `services/embedder.py`:
  - Text chunking: structural regex splitting (splitting at PART, Section, Schedule boundaries) as the primary strategy to preserve legal boundaries. If formatting is corrupt or scanned PDF text lacks structural markup, fall back to recursive character splitting (double-newlines -> single newlines -> character limit of 1,000 with 200-char overlap).
  - Call Gemini `text-embedding-004` to generate 768-dimensional vectors for each chunk. **Prevent Rate Limits (HTTP 429)**: Process chunk embedding calls in batches (e.g., `batch_size = 10` chunks per call) and introduce a micro-throttle delay (`await asyncio.sleep(0.5)`) between batches to avoid AI Studio rate limit spikes.
  - Store chunks in `bill_chunks` with `chunk_text`, `section_ref` (if extractable), `embedding`.
- Create the IVFFlat index on `bill_chunks.embedding`.
- Add the embedding step to the DAG orchestrator (after text extraction, before summarization).

### Step 7.2 — RAG Retrieval

- Implement RAG retrieval in the Summarization Agent:
  - Before summarization, query `bill_chunks` for the top-5 chunks by cosine similarity, filtered by `bill_id`.
  - Include the retrieved chunks in the summarization prompt as grounding context.
- This improves summary accuracy for long bills where the full text would otherwise be truncated.

### Step 7.3 — Full Verification Agent (RAG-Grounded)

- Enhance `agents/verifier.py`:
  - In addition to checking regex values (built in Phase 2), now also:
    - Check every section citation in the summary against the RAG chunks.
    - Check for hallucinated provisions not present in any source chunk.
    - Explicitly verify boundary and edge conditions against the checklist: Min/Max Caps (e.g., KES 5,000 maximum limits), Threshold Triggers (e.g., minimum business revenues required), Temporal Validity (e.g., effective dates checks), and Exemptions (e.g., electric vehicles/agriculture).
  - The verification prompt includes: summary text, top-5 RAG chunks, and regex-extracted values.
  - Wire the verify step as mandatory in the DAG (it was optional in Phase 2).
  - Max 2 retries — if verification fails twice, bill is marked as `'failed'`.

### Step 7.4 — LLM Usage Logging

- Create the `llm_usage_log` table (deferred from Phase 1).
- Instrument all Gemini API calls to log: `agent_name`, `model`, `input_tokens`, `output_tokens`, `latency_ms`, `estimated_cost_usd`.
- This enables cost tracking and budget monitoring.

### Step 7.5 — Re-Process Existing Bills

- Run the updated pipeline (with embeddings + RAG + full verification) on all existing bills.
- Compare the new summaries against the old ones. Verify improved accuracy.

### Phase 7 Exit Criteria

- [ ] Bill chunks are generated and stored with vector embeddings.
- [ ] RAG retrieval returns relevant chunks for summarization grounding.
- [ ] Verification Agent checks both regex values and RAG chunks.
- [ ] LLM usage is logged with cost estimates.
- [ ] Existing bills re-processed with improved quality.
- [ ] Merge `phase-7/rag-verification` → `develop`.

---

## Phase 8: Production Hardening

**Goal**: Add all remaining production-grade features — circuit breakers, dead letter queue handling, batch SMS, monitoring, PWA capabilities, and performance optimization.

**Branch**: `phase-8/production-hardening`

**Depends on**: Phase 7

### Step 8.1 — Circuit Breaker Pattern

- Implement circuit breakers for all external service calls:
  - Parliament.go.ke, Gemini API, Africa's Talking.
  - Three states: Closed → Open (after 3 consecutive failures) → Half-Open (after 60s cooldown).
  - For Gemini: fallback to cached summary or queue for later.
  - For Parliament.go.ke: log failure, fallback to seed directory, or retry on next scheduled run.
  - For Africa's Talking: messages are marked as failed in the database and re-queued for retry by the background task scheduler.

### Step 8.2 — Pipeline Error Dashboard & Defer DLQ

- Google Cloud Pub/Sub and DLQ infrastructure are deferred to post-buildathon deployment.
- In their place, implement a lightweight admin error logging system:
  - Query bills where `ai_status = 'failed'` and display their stored `ai_error` traceback in an administrator dashboard.
  - Provide a "Re-run Pipeline" button that calls `/api/admin/run-pipeline/{id}` to restart the background task for that bill.

### Step 8.3 — Batch SMS Sending

- Refactor the notifier to use Africa's Talking bulk SMS API:
  - Batch subscribers into groups of 20.
  - Send each batch as a single AT API call.
  - 100ms delay between batches to respect rate limits.
  - Retry failed batches (max 3 times, exponential backoff).
- Handle the webhook concurrency concern: verify the delivery receipt handler is minimal-work (just a DB UPDATE).

### Step 8.4 — PWA Features

- Add PWA manifest and service worker to the Next.js frontend:
  - Install prompt.
  - Offline caching of previously viewed bill summaries (Cache API).
  - App icon and splash screen.

### Step 8.5 — Supabase Realtime Integration

- Enable Supabase Realtime on the `feedback` table.
- On the dashboard page, subscribe to real-time WebSocket events.
- When new feedback is submitted, the dashboard charts update live without page refresh.
- This is purely frontend — FastAPI just does a standard INSERT; Supabase Realtime (WAL-driven) handles the broadcast automatically.

### Step 8.6 — Performance Optimization

- Implement response caching for tier-level impacts:
  - After computing a tier-level impact during alert fan-out, cache it in Supabase.
  - On-demand impact requests for the same bill + tier serve from cache (sub-second).
- Next.js ISR (Incremental Static Regeneration) for bill list and detail pages.
- Container optimization: slim Python base image, lazy-load heavy dependencies.

### Step 8.7 — Complete Hustle Profiles

- The prototype only has profiles for "Transport & Logistics" (3 tiers).
- Add profiles for all 8 industries:
  - Digital & Content Creation
  - Agriculture & Farming
  - Retail & Market Trading
  - Hospitality & Food Service
  - Manufacturing & Artisan
  - Finance & Mobile Money
  - Construction & Real Estate

### Step 8.8 — Monitoring & Observability

- Set up structured JSON logging via Cloud Logging.
- Every log entry includes: `bill_id`, `agent_name`, `correlation_id`.
- Cloud Monitoring dashboards:
  - Pipeline health (bills processed per day, failure rate).
  - API latency (p50, p95, p99 for each endpoint).
  - LLM cost burn rate (daily, weekly).
  - SMS delivery rate.
  - **Supabase storage usage** (alert at 400MB / 80% threshold).

### Step 8.9 — Final End-to-End Validation

- Deploy everything to production.
- Since new bills are published by parliament on an unpredictable schedule, use a **simulation harness** to test the full automated flow without depending on parliament's timeline:
  1. **Simulate a "new" bill**: Pick an existing bill that the system has already processed. Delete its record from Supabase (remove from `bills`, `bill_tags`, `bill_chunks`, `notifications`). This makes the scraper "rediscover" it on the next run as if it were newly published.
  2. Wait for Cloud Scheduler to trigger scraping (or trigger manually for the test).
  3. Verify the bill is detected as new, processed through the full pipeline (text extraction → regex → embeddings → summarization → RAG-grounded verification → translation).
  4. Verify subscribers receive SMS/WhatsApp alerts with tier-level impact.
  5. Open the web app — verify bill summary, language toggle, impact calculator.
  6. Submit feedback — verify dashboard updates in real-time via Supabase Realtime.
  7. Check monitoring dashboards for correct data.
  8. Simulate an external service failure (e.g., block Gemini API calls via an environment variable toggle) — verify circuit breaker activates and fallback behavior is used.
  9. Check the DLQ for any failed messages — verify the Cloud Monitoring alert fires.
- **If a genuinely new bill happens to be published during the buildathon**, run the validation again with that bill as a bonus confirmation.

### Phase 8 Exit Criteria

- [ ] Circuit breakers implemented for all external services.
- [ ] DLQ monitoring, alerting, and manual retry working.
- [ ] Batch SMS sending with rate limiting.
- [ ] PWA installable with offline bill caching.
- [ ] Supabase Realtime updates dashboard in real-time.
- [ ] Tier-level impact caching for sub-second repeat requests.
- [ ] All 8 industries have complete hustle profiles.
- [ ] Monitoring dashboards showing pipeline health, API latency, LLM costs.
- [ ] Full end-to-end validation passes (all 8 steps above).
- [ ] Merge `phase-8/production-hardening` → `develop` → `main`. **Tag: `v1.0.0` (Production)**.

---

## Dependency Graph

```
Phase 1 (Foundation)
    │
    ▼
Phase 2 (Core Pipeline + LlamaParse)
    │
    ▼
Phase 3 (Core Web App + Feedback Auth)  ← OTP auth for feedback only (using Africa's Talking OTP Webhook & local bypass)
    │
    ▼
Phase 4 (Alerts, Auth-Gated Feedback, Example Scenarios, Interactive Calculator, Dashboard) ─► v0.2.0 Working Baseline
    │
    ▼
Phase 5 (Scraper Automation & Monolith Background Task Pipeline)
    │
    ▼
Phase 6 (Security Hardening: RLS, Vault, CORS) ─► v0.3.0
    │
    ▼
Phase 7 (RAG & Verification)  ← Prioritizes structural regex splitting & verification checks
    │
    ▼
Phase 8 (Production Hardening: Circuit Breaker, PWA, Realtime) ─► v1.0.0 Production
```

Each phase depends strictly on the previous one. No phase can be started until its predecessor is merged to `develop`. This ensures a stable, incremental build where every merge leaves the system in a working state.

**Key structural changes from v1.2**: (1) Auth scope reduced — phone OTP login is now only for feedback submission gating, not for custom profiles. (2) Impact page redesigned — instead of personalized financial impact calculations, the system generates generic "Example Scenarios" using hypothetical personas (based on predefined hustle profiles) with step-by-step math breakdowns. An interactive deterministic calculator lets users compute their own values client-side. (3) Custom user business profiles and the `/account` page are deferred to post-buildathon. (4) The Impact page is now a top-level route (`/impact`) with its own bill list and financial/regulatory filter, not a sub-page of `/bills/[id]`.

---

## Quick Reference: What's Deferred and When

| Item | Built in Prototype? | Baseline (v0.2.0) | Production (v1.0.0) |
|---|---|---|---|
| Bill scraping (parliament.go.ke) | ✅ | ✅ (ported) | ✅ |
| PDF text extraction (LlamaParse) | ❌ | ✅ (Phase 2, one-time bulk) | ✅ |
| PDF text extraction (pdfplumber + OCR) | ✅ | ✅ (ported, automated fallback) | ✅ |
| Regex value extraction | ❌ | ✅ (Phase 2) | ✅ |
| AI summarization (English) | ✅ (DeepSeek) | ✅ (Gemini 2.5 Flash) | ✅ |
| AI translation (Swahili) | ✅ (DeepSeek, bundled) | ✅ (Gemini 2.5 Flash, separate agent) | ✅ |
| Verification Agent | ❌ | ✅ (basic, regex only) | ✅ (RAG-grounded + Boundary Checklist, Phase 7) |
| Calculator tool | ❌ | ✅ (Phase 2) | ✅ |
| Financial Impact Agent | ✅ (DeepSeek, no calculator) | ✅ (Gemini 3.5 Flash + calculator, example scenarios) | ✅ (Step-by-step Math Breakdown XAI) |
| **Example Scenarios (hypothetical personas)** | ❌ | **✅ (Phase 3-4)** | ✅ |
| **Compliance Checklists (regulatory bills)** | ❌ | **✅ (Phase 3-4)** | ✅ |
| **Interactive Calculator (client-side)** | ❌ | **✅ (Phase 4, nice-to-have)** | ✅ |
| **Impact page (top-level, financial/regulatory filter)** | ❌ | **✅ (Phase 3)** | ✅ |
| DAG orchestrator | ❌ | ✅ (Phase 2) | ✅ |
| Vector embeddings (pgvector) | ❌ | ❌ | ✅ (Phase 7) |
| RAG retrieval | ❌ | ❌ | ✅ (Phase 7) |
| SMS alerts | ✅ (single send) | ✅ (tier-level, manual trigger) | ✅ (automated, batch via Africa's Talking) |
| WhatsApp alerts | ❌ | ❌ | ✅ (Phase 8) |
| Subscriber management | ✅ (Firestore) | ✅ (Supabase) | ✅ |
| **Phone OTP auth (feedback only)** | ❌ | **✅ (Phase 3, AT Webhook & Local Bypass)** | ✅ |
| **Feedback submission (auth-gated)** | ✅ (Firestore, no dedup) | **✅ (Supabase, auth + UNIQUE constraint)** | ✅ |
| **Custom user business profiles** | ❌ | **❌ (Deferred to Post-Buildathon)** | ✅ (Post-Buildathon) |
| **Login/account page** | ❌ | **❌ (Deferred to Post-Buildathon)** | ✅ (Post-Buildathon) |
| Insights dashboard | ✅ (Streamlit + Plotly) | ✅ (Next.js + charts) | ✅ (real-time) |
| Phone encryption (Vault) | ❌ | ❌ | ✅ (Phase 6) |
| RLS policies | ❌ | ❌ | ✅ (Phase 6) |
| Pub/Sub event pipeline | ❌ | ❌ | **❌ (Deferred to Post-Buildathon)** |
| Cloud Scheduler | ❌ | ❌ | ✅ (Phase 5) |
| Cloud Run deployment | ❌ | ❌ | ✅ (Phase 5, consolidated monolith) |
| Circuit breakers | ❌ | ❌ | ✅ (Phase 8) |
| Dead letter queues | ❌ | ❌ | **❌ (Deferred to Post-Buildathon)** |
| PWA (offline, installable) | ❌ | ❌ | ✅ (Phase 8) |
| Monitoring & observability | ❌ | ❌ | ✅ (Phase 8) |
| LLM cost tracking | ❌ | ❌ | ✅ (Phase 7) |
| All 8 industry profiles | ❌ (only Transport) | ❌ (only Transport) | ✅ (Phase 8) |
| Storage monitoring (400MB alert) | ❌ | ❌ | ✅ (Phase 8) |
