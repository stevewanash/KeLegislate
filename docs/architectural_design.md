# KeLegislate — Detailed Architectural Design Document

> **Version**: 1.1  
> **Date**: July 22, 2026  
> **Status**: Draft — Updated to address architectural concerns (LlamaParse, auth for feedback, custom profiles, VPS contingency)  
> **Scope**: Production architecture for the 8-week buildathon (July 7 – September 5, 2026)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Model Diagram](#2-system-architecture-model-diagram)
3. [Architectural Decisions & Design Rationale](#3-architectural-decisions--design-rationale)
4. [Use Case Diagram Description](#4-use-case-diagram-description)
5. [Entity-Relationship Diagram (ERD) Description](#5-entity-relationship-diagram-erd-description)
6. [Data Flow Diagrams (DFDs)](#6-data-flow-diagrams-dfds)
7. [System Flowchart Description](#7-system-flowchart-description)
8. [Activity Diagram Descriptions](#8-activity-diagram-descriptions)
9. [Sequence Diagram Descriptions](#9-sequence-diagram-descriptions)
10. [Component Diagram Description](#10-component-diagram-description)
11. [Deployment Diagram Description](#11-deployment-diagram-description)
12. [State Machine Diagram Description](#12-state-machine-diagram-description)
13. [Agent Orchestration Architecture (The DAG)](#13-agent-orchestration-architecture-the-dag)
14. [SMS Fan-Out & Cost Control Architecture](#14-sms-fan-out--cost-control-architecture)
15. [API Contract Summary](#15-api-contract-summary)
16. [Security Architecture](#16-security-architecture)
17. [Non-Functional Requirements](#17-non-functional-requirements)

---

## 1. Executive Summary

KeLegislate is a civic technology platform that proactively alerts Kenyan informal workers — boda boda riders, market traders, Uber drivers, content creators — about how proposed legislation will impact their livelihood in shillings and cents. The system scrapes legislative bills, uses AI agents to summarize and model financial impact, and delivers personalized alerts via SMS and WhatsApp.

This document provides the detailed architectural blueprint for building KeLegislate during the 8-week buildathon. It addresses three key structural challenges — synchronous vs. asynchronous execution paths, idempotency/event deduplication, and agent orchestration — as well as additional architectural concerns including: circuit breaker patterns for external service failures, Cloud Run cold start mitigation, RAG embedding strategy, background task error handling, database migration from the existing Firestore prototype, a phased SMS fan-out cap to control costs during testing, a two-tier PDF extraction strategy (LlamaParse + pdfplumber), authentication for feedback integrity (anti-astroturfing), custom user business profiles with encrypted persistence, and VPS as hosting contingency.

**Key architectural principles**:
- **Monolith-First Asynchronous Processing** — bills flow through an in-memory FastAPI BackgroundTasks queue within a single Cloud Run service for the buildathon, keeping code modular to allow Pub/Sub scaling post-competition.
- **Privacy-by-design & KDPA 2019 Compliance** — financial impact is computed in-memory and never persisted; phone numbers are encrypted via Supabase Vault, and custom profiles are encrypted at application level. Consent modals explicitly disclose cross-border storage and rights.
- **Deterministic & Explainable (XAI)** — all arithmetic uses a deterministic calculator tool, not LLM math; value extraction uses regex before AI, and all calculated impacts present a clear, Step-by-Step Math Breakdown with citations.
- **Structural Chunking** — RAG chunking utilizes structural regex splitting (PART, Section, Schedule) to preserve legislative logical boundaries.
- **Scraper Resiliency** — Sc scraper checks parliament.go.ke but automatically falls back to a local/storage seed directory of pre-downloaded PDF bills if the website is down or timing out.
- **Cost-conscious** — 500 SMS fan-out cap during testing (configurable via `MAX_SMS_FAN_OUT`), free-tier infrastructure throughout.
- **Graceful degradation** — every external dependency (Parliament site, Gemini, Africa's Talking) has a fallback path.
- **Feedback integrity** — all feedback submissions require phone OTP authentication (delivered locally via Africa's Talking Custom Webhook or testing bypass OTP) to prevent astroturfing; `UNIQUE(bill_id, user_id)` enforced server-side.

---

## 2. System Architecture Model

### 2.1 Diagram Description — Layer by Layer

**Presentation Layer**: The user-facing surface. A Next.js Progressive Web App (PWA) hosted on Vercel's free hobby tier provides the primary web interface — mobile-first, installable, with offline caching of previously viewed bill summaries. To bypass Vercel Hobby's 10-second serverless proxy timeout, the Next.js client component bypasses Vercel's API proxy layer and fetches directly from the Google Cloud Run URL stored in `NEXT_PUBLIC_API_BASE_URL` (with CORS locked to the Vercel domain). SMS and WhatsApp alerts are the push channels, delivered via Africa's Talking.

**API Gateway Layer**: A single FastAPI application deployed on Google Cloud Run (free tier). It serves six distinct API groups: Bills (read bill summaries), Impact (compute financial impact in-memory — never persisted), Feedback (auth-required citizen feedback submission), Dashboard (aggregated statistics with real-time WebSocket updates), Subscribe (manage SMS/WhatsApp alert preferences), and Profile (custom user business profile CRUD — encrypted at rest). All routes pass through an Auth Middleware that verifies Supabase JWT tokens for authenticated endpoints, while allowing unauthenticated access to public bill summaries and predefined-tier impact calculations. CORS is locked to the Vercel frontend domain only.

**Event Pipeline Layer**: The asynchronous backbone. Cloud Scheduler triggers the Scraper Job every 6 hours. The scraper uses BeautifulSoup to parse bill listings from parliament.go.ke (with local seed fallback). If the website is down or timing out, the scraper seamlessly falls back to reading pre-downloaded bill PDFs from a designated local seed directory or Supabase Storage bucket. When a new bill is detected (determined by URL hash deduplication — see Section 3.2), an asynchronous background task is triggered locally via FastAPI's native `BackgroundTasks` within the single backend container, running Extract, Chunk/Embed, Summarize, Verify, Translate, and Fan-Out steps sequentially. To prevent silent pipeline stalls if the Cloud Run container is recycled or crashes mid-task, a **Stale Job Recovery Sweep** is run during scraper runs/startup, which queries the database for bills in progress (`ingested`, `extracted`, `summarized`) updated more than 15 minutes ago and re-queues them.

> **Supabase Realtime clarification**: FastAPI does **not** need to communicate with Supabase Realtime directly. Supabase Realtime listens to the PostgreSQL Write-Ahead Log (WAL) at the database level. When FastAPI performs a standard `INSERT` or `UPDATE` on a subscribed table (e.g., `feedback`), Supabase automatically detects the change and broadcasts it to the Next.js frontend via WebSockets. The backend code remains completely stateless with respect to Realtime — no Realtime SDK, no channel management, no WebSocket connections from the backend.

**AI Agent Layer**: Logically nested within the FastAPI monolith container, but described separately for clarity. Four agents operate in a DAG (Directed Acyclic Graph) orchestrated by a lightweight state machine (not LangGraph — see Section 13 for rationale). The Summarization Agent (Gemini 2.5 Flash) produces English summaries with source citations. The Verification Agent (Gemini 3.5 Flash) cross-checks claims against RAG chunks and regex-extracted values — capped at 2 retries to prevent unbounded cost loops. The Translation Agent (Gemini 2.5 Flash) produces the Swahili translation. The Financial Impact Agent (Gemini 3.5 Flash + Calculator Tool) runs per unique hustle tier during alert fan-out, generating personalized KES impact figures.

**Data Layer**: Supabase provides four services from one platform: PostgreSQL with the pgvector extension (relational tables, vector embeddings, and a `tier_impact_cache` table to cache pre-computed impact calculations for predefined tiers), Supabase Auth (phone OTP authentication, 50K MAU free), Supabase Storage (bill PDF storage, 1GB free), and Supabase Vault (AES-256 encryption for phone numbers at rest). Supabase Realtime provides WebSocket subscriptions for live dashboard updates — it operates at the database level by listening to the PostgreSQL WAL (Write-Ahead Log), meaning the backend does not need to explicitly push events; any standard SQL write triggers an automatic broadcast to subscribed frontend clients. Row Level Security (RLS) policies enforce that users can only access their own subscription data.

**External Services**: Three external dependencies, each with a fallback path. Parliament.go.ke (bill source; if site is down, scraper retries on next scheduled run and checks the local/storage seed bucket fallback). Gemini API (primary AI; fallback: cached responses for previously processed bills; secondary fallback: DeepSeek V4 Flash if Gemini is down). Africa's Talking (SMS delivery; no fallback — if AT is down, messages are marked as failed and queued in the database for retry). OTP delivery uses Africa's Talking custom webhook and a local testing bypass code in Supabase Auth to bypass Twilio carrier blocking.

**Key architectural note on the Impact API**: The arrow from Impact API to PostgreSQL is labeled "In-memory only — Result NOT persisted." The API reads the bill summary and hustle profile (either predefined tier from in-memory dict, or custom profile from the user's encrypted `user_profiles` record) from the database, computes the financial impact via the AI agent entirely in memory, and returns the result to the user. No impact inputs or outputs are written to any persistent store. Custom profile data is stored persistently (encrypted, RLS-protected) but impact *results* are ephemeral.

---

## 3. Architectural Decisions & Design Rationale

This section addresses three key structural challenges identified during architectural review, plus additional gaps that matter for a production-grade system.

### 3.1 Synchronous vs. Asynchronous Execution Paths

The system has two fundamentally different workload types that require distinct architectural handling:

**Asynchronous Path — Background Bill Processing Pipeline**:

When a new bill is detected by the scraper, the entire processing pipeline — text extraction, regex value extraction, RAG embedding, AI summarization, verification, translation, subscriber matching, financial impact generation per subscriber, and SMS/WhatsApp fan-out — runs asynchronously in the background via FastAPI's native `BackgroundTasks`. No HTTP request is waiting. The task updates the bill status in the database at each step. If the Gemini API is slow (e.g., 30 seconds for a complex bill), this is fine — Cloud Run has a configurable timeout of up to 60 minutes for task executions, and the background task runs concurrently in the background.

The asynchronous path uses a **fire-and-forget task execution** model. If the background process fails, the traceback is caught, logged, and the bill's `ai_status` is updated to `'failed'` in Supabase, preventing system blocking and alerting administrators.

**Synchronous Path — On-Demand User Requests**:

When a user visits the web app and clicks "Calculate My Impact," they are waiting on screen. The request behavior depends on whether they use a predefined tier or a custom business profile:
1. **Predefined Hustle Tiers (Cached)**: During the background task processing of a bill, the backend pre-computes the financial impact for all 3 predefined hustle tiers across the 8 industries and caches them in `tier_impact_cache`. An on-demand request for a predefined tier is served via an instant database lookup (< 200ms).
2. **Custom Business Profiles (On-Demand AI)**: If the user provides a custom business profile (authenticated), the FastAPI `/api/impact` endpoint directly invokes the Financial Impact Agent (Gemini 3.5 Flash + Calculator Tool), then the Verification Agent, and returns the result. During the buildathon/testing phase, latency is secondary to correctness — a working, accurate result that takes 25 seconds is far preferable to a fast but broken one. To bypass Vercel's 10-second serverless function timeout, the Next.js client component makes the request directly to the Cloud Run backend URL (`NEXT_PUBLIC_API_BASE_URL`) via CORS, avoiding Vercel's proxy layer entirely.

The architectural separation is enforced at the code level:

| Concern | Async Pipeline | Sync API (Custom Profile) | Sync API (Predefined Tier) |
|---|---|---|---|
| **Entry point** | Scraper detection → FastAPI `BackgroundTasks` | HTTP POST `/api/impact` → FastAPI | HTTP POST `/api/impact` → FastAPI |
| **Timeout** | Up to 60 minutes (FastAPI async background worker loop) | 90 seconds (Cloud Run HTTP timeout, direct client fetch bypasses Vercel 10s limit) | < 2 seconds |
| **Retry strategy** | Automatic retry loop for transient Gemini API errors | Client-side retry (frontend shows "Retry" button after timeout) | None (instant cache lookup) |
| **Error handling** | Database logging & status set to `'failed'` | HTTP 504 Gateway Timeout → user sees "Try again" message | Database exception fallback to ephemeral calculation |
| **Financial Impact Agent**| Runs per subscriber & predefined tier (batch, cost-amortized) | Runs once for requesting user (single invocation, low latency critical) | Serves pre-computed cache, no LLM call |
| **Result storage** | Summary + Swahili translation + predefined tier impacts cached in Supabase | Impact result returned in HTTP response, **never persisted** | Impact result returned from cache, **never duplicated** |

**Latency budget for synchronous path (custom business profiles)**:

During the buildathon/testing phase, custom business profile requests invoke the live AI agent synchronously. Because AI APIs can be slow under rate limits, the budget below are generous to avoid premature timeouts that break functionality. Direct browser-to-Cloud Run connection guarantees that this request will not be aborted by Vercel's 10-second serverless timeout.

| Step | Buildathon Target | Notes |
|---|---|---|
| Auth middleware (JWT verify) | < 200 ms | Supabase JWT local verification, no network call |
| Fetch bill summary & custom profile | < 500 ms | Decrypted via Supabase Vault |
| Financial Impact Agent (Gemini 3.5 Flash) | < 15 seconds | ~500 input tokens (summary + profile), ~300 output tokens. AI APIs can be slow under load |
| Calculator Tool calls | < 50 ms | Deterministic Python, no network |
| Verification Agent (Gemini 3.5 Flash) | < 10 seconds | ~400 input tokens (impact result + source), ~200 output tokens. Allow for API variability |
| Response serialization | < 50 ms | Pydantic model → JSON |
| **Total** | **< 30 seconds** | Acceptable for testing phase; optimize post-buildathon |

**Timeout handling**: The FastAPI endpoint uses `asyncio.wait_for()` with a **90-second timeout** for custom profile calculations. This is deliberately generous for the buildathon to ensure the full AI pipeline (scraping, extraction, agent reasoning, calculator calls, verification) can complete even when Gemini APIs are slowIf the timeout is hit, the endpoint returns HTTP 504 with a user-friendly message ("Our analysis engine is busy — please try again in a moment"). The frontend shows this message with a "Retry" button. For predefined tiers, the lookup is a simple database select index, taking less than 200ms.

### 3.2 Idempotency and Event Deduplication

The scraper runs every 6 hours and will re-discover bills it has already processed. Without a deduplication mechanism, the expensive AI pipeline would re-run for every previously seen bill on every scrape cycle.

**Solution — URL Hash Gatekeeper**:

The deduplication gate sits inside the Scraper Job, before any background task is queued:

```
Scraper fetches bill list from parliament.go.ke (or local seed directory)
    ↓
For each bill URL:
    1. Compute URL hash: SHA-256(bill_url)[:16]
    2. Query Supabase: SELECT id FROM bills WHERE url_hash = '{hash}'
    3. If EXISTS → Skip (bill already processed)
       If NOT EXISTS → Queue FastAPI background task: process_bill_pipeline(url, title, url_hash)
```

This is the **same hashing strategy** already used in the prototype's [feedback_utils.py:9-11](file:///c:/git/KeLegislate/src/feedback_utils.py#L9-L11) (`_url_to_doc_id()`), adapted for PostgreSQL.

**Downstream idempotency**: Even if a duplicate background task somehow starts (e.g., a manual retry concurrent with automated scheduler), each pipeline stage is idempotent:

| Service / Stage | Idempotency Mechanism |
|---|---|
| Text Extraction | `INSERT ... ON CONFLICT (url_hash) DO NOTHING` — if the bill text already exists, skip extraction |
| AI Pipeline | Checks `bills.ai_status` column — if already `'verified'` or later, skip AI processing |
| Categorizer | Uses `bill_id + subscriber_id` composite key — won't duplicate alert assignments |
| Notification | Checks `notifications.bill_id + subscriber_id` — won't send duplicate SMS/WhatsApp |

**FastAPI Task-level deduplication**: Since background tasks run in a thread pool managed by FastAPI, database constraints (`ON CONFLICT` and `UNIQUE` indexes) serve as the final gatekeeper, ensuring concurrent executions fail-safe without double-alerting.

### 3.3 Agent Orchestration — The DAG

With 5 agents in the pipeline, a structured orchestration pattern is needed — managing them with nested `if/else` statements would quickly become unmaintainable. The key question is whether to use a framework like LangGraph or build a custom DAG.

**Decision: Custom lightweight DAG state machine — not LangGraph.**

**Why not LangGraph?** LangGraph adds a significant dependency (LangChain ecosystem), has a learning curve, and is designed for complex conversational agent graphs with branching, loops, and human-in-the-loop patterns. KeLegislate's agent pipeline is a **linear DAG with one conditional retry edge** — not a complex graph. A custom state machine is simpler, has no external dependencies, and is easier for a team of 2 to debug and maintain in 8 weeks.

The full DAG design is covered in [Section 13](#13-agent-orchestration-architecture-the-dag).

### 3.4 Additional Architectural Considerations

Beyond the three structural challenges above, several other concerns matter for a production architecture:

**3.4.1 Circuit Breaker Pattern for External Services**

The system depends on three external services: Parliament.go.ke, Gemini API, and Africa's Talking. Any of these can fail or become slow. Without circuit breakers, a slow Gemini API could cause Cloud Run instances to pile up, burning through free-tier limits.

Each external service call is wrapped in a circuit breaker with three states:
- **Closed** (normal): Requests pass through. If failure count exceeds threshold (3 consecutive failures), switch to Open.
- **Open** (tripped): Requests fail immediately without calling the external service. After a cooldown period (60 seconds), switch to Half-Open.
- **Half-Open** (testing): One test request is allowed. If it succeeds, switch to Closed. If it fails, switch back to Open.

For Gemini specifically, if the circuit breaker is Open, the system falls back to returning the most recent cached summary (if available) or queuing the bill for later processing.

**3.4.2 Cloud Run Cold Start Mitigation**

Cloud Run free tier scales to zero when idle. The first request after idle incurs a cold start penalty (3-10 seconds for a Python container with ML dependencies). This directly impacts the synchronous impact calculation UX.

Mitigation:
- **Minimum instance = 1** for the FastAPI API service (Cloud Run allows 1 always-on instance in free tier for billing-enabled accounts). This eliminates cold starts for user-facing requests.
- **Pipeline services** (extractor, AI pipeline, categorizer, notifier) can scale to zero since they're async and latency-insensitive.
- **Container optimization**: Use a slim Python base image, lazy-load heavy dependencies (e.g., `pdfplumber`, `pytesseract` only imported when needed), and pre-warm the Gemini client connection at startup.

### 3.4.3 RAG Embedding Strategy and PDF Extraction

#### PDF Extraction — Two-Tier Strategy

Parliament bills contain complex formatting (tabulated schedules, nested clauses, annexures) that pdfplumber + Tesseract handles poorly. Poor extraction directly degrades RAG quality and regex value accuracy.

| Extraction Tool | When Used | Cost |
|---|---|---|
| **LlamaParse (Agentic Mode)** | Initial bulk ingestion of ~25 bills (~4,000 pages). Quality-gate fallback when pdfplumber extraction is poor | ~$10-15 per 1,000 pages (one-time: ~$40-60 total) |
| **pdfplumber + Tesseract OCR** | Automated pipeline for new bills (most new bills are digitally-born PDFs) | $0 |
| **Docling (IBM, open source)** | Manual fallback if LlamaParse unavailable and pdfplumber quality insufficient | $0 (requires GPU — not on Cloud Run free tier) |

After pdfplumber extraction, a quality heuristic checks the output (ratio of garbled characters, table structure markers). If quality is below threshold, the bill is queued for LlamaParse re-extraction.

#### RAG Embedding Parameters

The implementation plan specifies pgvector for RAG but doesn't define the embedding model, chunk size, or retrieval strategy.

| Parameter | Decision | Rationale |
|---|---|---|
| Embedding model | Gemini `text-embedding-004` (768 dimensions) | Free tier available; smaller vectors than OpenAI's 1536-dim, saving ~50% pgvector storage |
| Chunk size | 1,000 characters with 200-character overlap | Legislative bills have long sections; 1K chars captures enough context per chunk |
| Chunk strategy | Structural regex splitting (Primary) | Split by major sections (e.g., "PART I", "Section X", "Schedule") using structural regex patterns to preserve legal boundaries. If formatting is corrupt or scanned PDF text yields un-parsable structure, fall back to recursive character splitting (double-newlines -> single newlines -> character limit of 1,000 with 200 overlap). This ensures tax rates and qualifying exemptions are not severed. |
| Retrieval | Top-5 chunks by cosine similarity, filtered by bill ID | Ensures the AI only sees chunks from the specific bill being analyzed, not cross-bill contamination |
| Vector index | IVFFlat (pgvector) | Suitable for < 100K vectors; HNSW would be premature for buildathon scale |

**3.4.4 Database Migration from Firestore**

The prototype stores data in Firebase Firestore. The production system uses Supabase PostgreSQL. A migration path is needed:

- **Bills collection** → `bills` table. Migrate using a one-time Python script that reads all Firestore documents and inserts into PostgreSQL.
- **Subscribers collection** → `subscribers` table. Re-encrypt phone numbers using Supabase Vault during migration.
- **Feedback collection** → `feedback` table. Straightforward field mapping.
- **Timeline**: Migration script built in Week 1, executed once. Firestore project kept alive (read-only) as a backup for 2 weeks, then decommissioned.

**3.4.5 Dead Letter Queue Handling (Deferred to Post-Buildathon)**

During the buildathon, since we are using FastAPI's native `BackgroundTasks` instead of Pub/Sub, failed background pipeline steps are caught and handled by logging the error traceback and updating the bill's `ai_status` to `'failed'` in the database. 

Post-buildathon, when we migrate to Cloud Pub/Sub, we will deploy a dedicated DLQ topic (`kelegislate-dlq`) with Cloud Monitoring alerts, Slack notifications, and manual retry mechanisms (republishing failed messages).

**3.4.6 Financial Impact Agent — Per-Subscriber vs. Per-Tier**

If the Financial Impact Agent runs "per subscriber" during alert fan-out, a 500-subscriber cap would mean up to 500 Gemini 3.5 Flash invocations per bill. At $1.50/$9.00 per 1M tokens, this would be prohibitively expensive.

**Current approach — Tier-Level Caching**: During the buildathon, the Financial Impact Agent runs **per unique hustle tier** matched to the bill (not per subscriber). Since there are only 3 tiers per industry and ~8 industries, the maximum unique impact calculations per bill is 24 (8 industries × 3 tiers), not 500. The per-subscriber alert then simply templates the pre-computed tier-level impact into the SMS/WhatsApp message.

This reduces Gemini 3.5 Flash calls from O(subscribers) to O(tiers) — a 20x+ reduction.

**Future phase — Per-Subscriber Impact**: Once user profiles are introduced (where users input their specific business details — actual vehicle value, employee count, etc.), the Financial Impact Agent will run per subscriber using their personalized data. This will require a budget re-evaluation, but by that stage the platform will have real users and a clearer revenue/sponsorship model to justify the higher AI costs.

---

## 4. Use Case Diagram Description

The system has three actor types and twelve use cases organized into three packages.

### Actors

| Actor | Type | Description |
|---|---|---|
| **Citizen (Informal Worker)** | Primary | The target user — boda boda rider, market trader, Uber driver, content creator. Interacts via the Next.js PWA and receives SMS/WhatsApp alerts. May or may not have a user account |
| **System (Automated)** | System | Represents the automated backend processes — scraper, AI pipeline, notification service. Acts without human intervention |
| **Administrator** | Secondary | A team member who monitors system health, reviews DLQ errors, and manages the scraper configuration. During the buildathon, this is the development team itself |

### Use Case Package 1: Bill Discovery & Consumption

| UC ID | Use Case | Actor(s) | Description | Preconditions | Postconditions |
|---|---|---|---|---|---|
| UC-01 | **Browse Active Bills** | Citizen | View a paginated list of all currently tracked legislative bills with title, date, status, and industry tags | None (public endpoint, no auth required) | Bill list displayed; bills sorted by most recent |
| UC-02 | **View Bill Summary** | Citizen | Read the AI-generated English or Swahili summary of a specific bill, including key implications for citizens and businesses, with source citations linking to specific bill sections | Bill must have been processed by the AI pipeline (status = `verified`) | Summary displayed with section citations; user can toggle between English and Swahili |
| UC-03 | **Calculate Personalized Impact** | Citizen | Select an industry and hustle tier (predefined), OR use a saved custom business profile (requires auth), then view a KES-denominated financial impact analysis | Bill must be in `verified` status; user must select an industry and tier from the predefined list, or be authenticated and have a saved custom profile | Impact analysis displayed (KES table, net monthly impact, compliance checklist, risk level). Data is ephemeral — impact result not stored |
| UC-04 | **Search/Filter Bills by Industry** | Citizen | Filter the bill list by one or more industry tags to see only legislation relevant to the user's hustle | At least one bill must exist in the system | Filtered bill list displayed |

### Use Case Package 2: Civic Engagement

| UC ID | Use Case | Actor(s) | Description | Preconditions | Postconditions |
|---|---|---|---|---|---|
| UC-05 | **Submit Feedback on a Bill** | Citizen | Provide structured feedback: support stance (Support/Oppose/Neutral), 1-5 star rating, and free-text concerns. **Requires authentication** (phone OTP) to prevent astroturfing and ensure one-person-one-vote integrity | Bill must exist; user must be authenticated via Supabase Auth (phone OTP). `UNIQUE(bill_id, user_id)` enforced server-side | Feedback stored in database; dashboard stats updated in real-time via Supabase Realtime |
| UC-06 | **View Insights Dashboard** | Citizen | View aggregated citizen sentiment on bills — pie charts (support distribution), bar charts (rating distribution), word cloud (common concerns), and AI-generated policy insights | At least 5 feedback submissions must exist for the selected bill | Dashboard rendered with charts and AI insights |
| UC-07 | **Subscribe to Alerts** | Citizen | Register phone number, select industry tag(s), choose language (English/Swahili), and choose channel (SMS/WhatsApp/both) | Valid Kenyan phone number in E.164 format; explicit consent given via opt-in dialog | Subscriber record created; phone number encrypted at rest via Supabase Vault; confirmation SMS/WhatsApp sent |
| UC-08 | **Unsubscribe from Alerts** | Citizen | Remove subscription via the web app or by replying "STOP" to an SMS | Active subscription must exist | Subscriber record marked as inactive; no further alerts sent; data retained for 12 months then auto-deleted |

### Use Case Package 3: Automated System Operations

| UC ID | Use Case | Actor(s) | Description | Preconditions | Postconditions |
|---|---|---|---|---|---|
| UC-09 | **Scrape New Bills** | System | Automatically check for new bills every 6 hours via parliament.go.ke scraper, deduplicate against known bills, and publish new bills to the event pipeline | Cloud Scheduler trigger fires | New bills published to `bill-ingested` topic; known bills skipped |
| UC-10 | **Process Bill Through AI Pipeline** | System | Extract text, run regex value extraction, generate embeddings, produce AI summary with citations, verify claims, translate to Swahili | `bill-ingested` event received | Bill status transitions from `ingested` → `extracted` → `summarized` → `verified` → `translated`. Final verified summary stored in Supabase |
| UC-11 | **Fan Out Alerts to Matched Subscribers** | System | Match bill industry tags to subscriber preferences, compute tier-level financial impacts (cached per tier, not per subscriber), format SMS/WhatsApp messages, and dispatch via Africa's Talking | Bill status = `translated`; at least one subscriber matches the bill's industry tags | Up to 500 alerts dispatched (configurable via `MAX_SMS_FAN_OUT`). Delivery receipts logged |
| UC-12 | **Monitor & Alert on Failures** | Administrator | Review Cloud Monitoring dashboards, respond to DLQ alerts, manually retry failed pipeline stages | DLQ message received or monitoring alert triggered | Failed message reprocessed or root cause identified |

### Use Case Relationships

- UC-03 **includes** a call to the Financial Impact Agent (shared logic with UC-11's tier-level impact computation, but invoked synchronously)
- UC-07 **includes** phone number validation and encryption (shared with UC-11's subscriber lookup)
- UC-10 **extends** UC-09 — bill processing is triggered by bill discovery
- UC-11 **extends** UC-10 — alert fan-out is triggered by bill analysis completion

---

## 5. Entity-Relationship Diagram (ERD) Description

The database schema consists of 9 tables in Supabase PostgreSQL, organized into three logical groups: Bill Data, User Data, and System Data. All tables use UUID primary keys (generated by `gen_random_uuid()`), and all timestamps are `TIMESTAMPTZ` (UTC).

### Table Definitions

**Group 1: Bill Data**

**Table: `bills`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Internal unique identifier |
| `url_hash` | VARCHAR(16) | UNIQUE, NOT NULL, INDEX | SHA-256 hash of bill URL (first 16 chars). Used for deduplication |
| `title` | TEXT | NOT NULL | Bill title (e.g., "The Motor Vehicle Circulation Tax Bill, 2026") |
| `source_url` | TEXT | NOT NULL | Original URL where the bill PDF was found |
| `pdf_storage_path` | TEXT | NULLABLE | Path in Supabase Storage where the PDF is stored |
| `extracted_text` | TEXT | NULLABLE | Full plain-text extraction of the bill PDF |
| `ai_summary_en` | TEXT | NULLABLE | AI-generated English summary with source citations |
| `ai_summary_sw` | TEXT | NULLABLE | AI-generated Swahili translation of the summary |
| `ai_status` | VARCHAR(20) | NOT NULL, DEFAULT 'ingested' | Processing status: `ingested` → `extracted` → `summarized` → `verified` → `translated` → `failed` |
| `ai_error` | TEXT | NULLABLE | Error message if AI processing failed |
| `verification_score` | DECIMAL(3,2) | NULLABLE | 0.00 – 1.00 confidence score from Verification Agent |
| `regex_extractions` | JSONB | NULLABLE | JSON array of deterministically extracted values (percentages, monetary amounts, with context) |
| `source_api` | VARCHAR(20) | NOT NULL, DEFAULT 'scraper' | Which source discovered this bill: `scraper` |
| `parliament_status` | VARCHAR(50) | NULLABLE | Bill status if available (e.g., "First Reading", "Committee Stage") |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the bill was first ingested |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp (auto-updated via trigger) |

**Table: `bill_tags`** (Junction table — bills can have multiple industry tags)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `bill_id` | UUID | FK → bills.id, NOT NULL, INDEX | The bill this tag belongs to |
| `industry_tag` | VARCHAR(100) | NOT NULL | One of the 8 canonical industry tags |
| `confidence` | DECIMAL(3,2) | NOT NULL, DEFAULT 1.00 | AI-assigned confidence that this tag applies (0.00–1.00) |
| **Unique constraint** | | `UNIQUE(bill_id, industry_tag)` | Prevents duplicate tags on the same bill |

**Table: `bill_chunks`** (For RAG — vector embeddings of bill text sections)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `bill_id` | UUID | FK → bills.id, NOT NULL, INDEX | The bill this chunk belongs to |
| `chunk_index` | INTEGER | NOT NULL | Order of this chunk within the bill (0-based) |
| `chunk_text` | TEXT | NOT NULL | The raw text of this chunk (up to 1,000 chars) |
| `section_ref` | VARCHAR(100) | NULLABLE | Bill section reference (e.g., "Part II, Section 4(1)") |
| `embedding` | VECTOR(768) | NOT NULL | Gemini text-embedding-004 vector (768 dimensions) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When this chunk was embedded |
| **Unique constraint** | | `UNIQUE(bill_id, chunk_index)` | Prevents duplicate chunks |

**Table: `tier_impact_cache`** (Pre-computed predefined hustle tier impacts)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Auto-generated unique identifier |
| `bill_id` | UUID | FK → bills.id, ON DELETE CASCADE, NOT NULL, INDEX | The bill this cache belongs to |
| `industry` | VARCHAR(100) | NOT NULL | Subscribed industry (e.g., "Transport & Logistics") |
| `tier_label` | VARCHAR(100) | NOT NULL | Predefined hustle tier label (e.g., "Tier 1 — BodaBoda Rider") |
| `impact_data` | JSONB | NOT NULL | AI-generated financial impact metrics and Step-by-Step Math Breakdown |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Cache creation timestamp |
| **Unique constraint** | | `UNIQUE(bill_id, industry, tier_label)` | Prevents duplicate cache entries for the same bill and tier |

**Group 2: User Data**

**Table: `subscribers`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `phone_hash` | VARCHAR(64) | UNIQUE, NOT NULL, INDEX | SHA-256 hash of the phone number (full hash, used for lookups without decryption) |
| `phone_encrypted` | TEXT | NOT NULL | Phone number encrypted via Supabase Vault (AES-256). Only decrypted at alert send time |
| `industry_tags` | TEXT[] | NOT NULL | Array of subscribed industry tags (e.g., `{'Transport & Logistics', 'Finance & Mobile Money'}`) |
| `preferred_tier` | VARCHAR(100) | NULLABLE | Last selected hustle tier (e.g., "Tier 1 — BodaBoda Rider"). Optional — if null, alert uses a generic impact message |
| `preferred_language` | VARCHAR(10) | NOT NULL, DEFAULT 'en' | `en` or `sw` |
| `channels` | TEXT[] | NOT NULL, DEFAULT '{sms}' | Alert channels: `{sms}`, `{whatsapp}`, or `{sms, whatsapp}` |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Whether the subscription is active. Set to FALSE on unsubscribe |
| `consent_given_at` | TIMESTAMPTZ | NOT NULL | When the user explicitly opted in |
| `user_id` | UUID | FK → auth.users.id, NULLABLE | If the user later creates an account, link it here |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Subscription creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification time |

**Table: `feedback`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `bill_id` | UUID | FK → bills.id, NOT NULL, INDEX | The bill this feedback is about |
| `user_id` | UUID | FK → auth.users.id, NOT NULL | The authenticated user who submitted this feedback |
| `support` | VARCHAR(10) | NOT NULL | `support`, `oppose`, or `neutral` |
| `rating` | SMALLINT | NOT NULL, CHECK (1-5) | 1-5 star rating |
| `concerns` | TEXT | NULLABLE | Free-text concerns from the citizen |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Submission timestamp |
| **Unique constraint** | | `UNIQUE(bill_id, user_id)` | One feedback per bill per authenticated user — enforced at database level to prevent astroturfing |

**Table: `user_profiles`** (NEW)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `user_id` | UUID | FK → auth.users.id, UNIQUE, NOT NULL | One profile per authenticated user |
| `industry` | VARCHAR(100) | NOT NULL | Primary industry (e.g., "Transport & Logistics") |
| `tier_label` | VARCHAR(100) | NULLABLE | Closest predefined tier label (e.g., "Tier 1 — BodaBoda Rider") for reference |
| `custom_metrics` | JSONB | NOT NULL | User's specific business metrics. Encrypted at application level before storage. Example: `{"vehicle_value": 250000, "monthly_revenue_range": "50000-80000", "employee_count": 2, "monthly_expenses": 35000}` |
| `consent_given_at` | TIMESTAMPTZ | NOT NULL | When the user explicitly consented to store business data |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Profile creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification time |

**Group 3: System Data**

**Table: `notifications`** (Delivery tracking)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `bill_id` | UUID | FK → bills.id, NOT NULL, INDEX | The bill this notification is about |
| `subscriber_id` | UUID | FK → subscribers.id, NOT NULL, INDEX | The subscriber who received this alert |
| `channel` | VARCHAR(10) | NOT NULL | `sms` or `whatsapp` |
| `message_body` | TEXT | NOT NULL | The actual message sent |
| `at_message_id` | VARCHAR(100) | NULLABLE | Africa's Talking message ID (for delivery receipt correlation) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'queued' | `queued` → `sent` → `delivered` → `failed` |
| `failure_reason` | TEXT | NULLABLE | Error message if delivery failed |
| `sent_at` | TIMESTAMPTZ | NULLABLE | When the message was sent to Africa's Talking |
| `delivered_at` | TIMESTAMPTZ | NULLABLE | When Africa's Talking confirmed delivery |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation time |
| **Unique constraint** | | `UNIQUE(bill_id, subscriber_id, channel)` | Prevents duplicate notifications per channel |

**Table: `llm_usage_log`** (Cost tracking)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `bill_id` | UUID | FK → bills.id, NULLABLE | Associated bill (null for on-demand impact calculations) |
| `agent_name` | VARCHAR(50) | NOT NULL | Which agent: `summarization`, `verification`, `translation`, `financial_impact` |
| `model` | VARCHAR(50) | NOT NULL | `gemini-2.5-flash` or `gemini-3.5-flash` |
| `input_tokens` | INTEGER | NOT NULL | Token count for the prompt |
| `output_tokens` | INTEGER | NOT NULL | Token count for the response |
| `latency_ms` | INTEGER | NOT NULL | Request-to-response time in milliseconds |
| `estimated_cost_usd` | DECIMAL(8,6) | NOT NULL | Computed cost based on model pricing |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the API call was made |

**Table: `audit_log`** (Data access tracking for responsible computing)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated |
| `action` | VARCHAR(50) | NOT NULL | `phone_decrypt`, `subscriber_create`, `subscriber_delete`, `data_export`, `feedback_submit` |
| `actor` | VARCHAR(100) | NOT NULL | `system:notifier`, `system:migration`, `user:{user_id}`, or `admin:{admin_id}` |
| `target_table` | VARCHAR(50) | NOT NULL | Which table was accessed |
| `target_id` | UUID | NULLABLE | Specific record ID if applicable |
| `metadata` | JSONB | NULLABLE | Additional context (e.g., reason for decryption) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When the action occurred |

### Relationships Summary

- `bills` 1 ←→ N `bill_tags` (a bill has multiple industry tags)
- `bills` 1 ←→ N `bill_chunks` (a bill is split into multiple RAG chunks)
- `bills` 1 ←→ N `feedback` (a bill receives multiple feedback submissions)
- `bills` 1 ←→ N `notifications` (a bill triggers multiple alerts)
- `bills` 1 ←→ N `tier_impact_cache` (a bill has multiple pre-computed tier impacts cached)
- `subscribers` 1 ←→ N `notifications` (a subscriber receives multiple alerts over time)
- `subscribers` N ←→ 1 `auth.users` (optional link to Supabase Auth user, nullable)
- `auth.users` 1 ←→ 1 `user_profiles` (each authenticated user can have at most one custom business profile)
- `auth.users` 1 ←→ N `feedback` (an authenticated user submits feedback on multiple bills)
- `bills` 1 ←→ N `llm_usage_log` (each bill triggers multiple LLM calls)

### Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `bills` | `idx_bills_url_hash` | B-tree UNIQUE | Fast deduplication lookups during scraping |
| `bills` | `idx_bills_ai_status` | B-tree | Filter bills by processing stage |
| `bills` | `idx_bills_created_at` | B-tree DESC | Sort bills by newest first |
| `bill_tags` | `idx_bill_tags_industry` | B-tree | Match subscribers to bills by industry |
| `bill_chunks` | `idx_bill_chunks_embedding` | IVFFlat (pgvector) | Approximate nearest-neighbor search for RAG retrieval |
| `tier_impact_cache` | `idx_tier_impact_lookup` | B-tree UNIQUE | `UNIQUE(bill_id, industry, tier_label)` constraint enforcement for fast lookup |
| `subscribers` | `idx_subscribers_phone_hash` | B-tree UNIQUE | Lookup subscriber by phone hash |
| `subscribers` | `idx_subscribers_industry` | GIN | Array containment queries for matching bills to subscribers |
| `subscribers` | `idx_subscribers_active` | B-tree (partial: WHERE is_active = TRUE) | Filter only active subscribers during fan-out |
| `feedback` | `idx_feedback_bill_id` | B-tree | Aggregate feedback per bill |
| `feedback` | `idx_feedback_user_bill` | B-tree UNIQUE | `UNIQUE(bill_id, user_id)` constraint enforcement |
| `user_profiles` | `idx_user_profiles_user_id` | B-tree UNIQUE | One profile per user lookup |
| `notifications` | `idx_notifications_status` | B-tree | Track pending/failed deliveries |

---

## 6. Data Flow Diagrams (DFDs)

### 6.1 Context Diagram (Level 0 DFD) Description

The Level 0 DFD shows KeLegislate as a single process interacting with four external entities:

**External Entities**:
1. **Kenyan Parliament** (data source) — provides raw bill PDFs via the parliament.go.ke website
2. **Citizen / Informal Worker** (primary user) — receives bill summaries, financial impact analyses, and push alerts; provides feedback and subscription preferences
3. **Africa's Talking** (notification provider) — receives formatted alert messages and delivers them as SMS or WhatsApp messages to citizens' phones
4. **Google Gemini API** (AI service) — receives bill text, prompts, and function call definitions; returns AI-generated summaries, translations, financial reasoning, and verification results

**Data Flows**:
- Kenyan Parliament → KeLegislate: `Bill PDF Data` (raw PDF files, bill metadata)
- KeLegislate → Citizen: `Bill Summary` (English + Swahili), `Financial Impact Analysis` (KES-denominated), `Push Alert` (SMS/WhatsApp message)
- Citizen → KeLegislate: `Feedback` (support stance, rating, concerns), `Subscription Preferences` (phone, industry, language, channel), `Impact Request` (selected bill + hustle tier)
- KeLegislate → Africa's Talking: `Alert Message` (formatted SMS/WhatsApp text, recipient phone number)
- Africa's Talking → KeLegislate: `Delivery Receipt` (message status: delivered/failed)
- KeLegislate → Google Gemini: `Bill Text + Prompt` (structured prompt with bill content and instructions)
- Google Gemini → KeLegislate: `AI Response` (summary, translation, financial reasoning, verification result, function call arguments)

### 6.2 Level 1 DFD Description

The Level 1 DFD decomposes KeLegislate into five processes and two data stores:

**Processes**:

1. **P1: Bill Ingestion** — Receives bill data from the Kenyan Parliament external entity. Checks the `D1: Bill Store` for existing URL hashes to deduplicate. For new bills, downloads the PDF, extracts text (digital-first, OCR fallback), runs regex to extract percentages and monetary amounts, generates vector embeddings, and stores all results in `D1: Bill Store`. Outputs `Extracted Bill Data` (text + regex values + embeddings) to P2.

2. **P2: AI Analysis** — Receives extracted bill data from P1. Sends bill text and prompts to the Google Gemini API external entity. Orchestrates the Summarization Agent (English summary with citations), Verification Agent (cross-checks claims against source), and Translation Agent (Swahili translation). Stores verified summaries in `D1: Bill Store`. Outputs `Analyzed Bill` (verified summary + tags) to P3.

3. **P3: Alert Fan-Out** — Receives analyzed bill data from P2. Queries `D2: Subscriber Store` to find subscribers whose industry tags overlap with the bill's tags. For each matched hustle tier (not per subscriber — tier-level caching), invokes the Financial Impact Agent via the Google Gemini API. Formats personalized alert messages. Sends messages to Africa's Talking external entity for delivery. Logs delivery status in `D2: Subscriber Store` (via the notifications table). Applies the `MAX_SMS_FAN_OUT` cap (500 during testing).

4. **P4: Citizen Interaction** — Receives requests from the Citizen external entity: browse bills, view summaries, calculate impact, submit feedback, manage subscriptions. Reads from `D1: Bill Store` and `D2: Subscriber Store`. For on-demand impact calculations, invokes Google Gemini API synchronously. Returns results directly to the Citizen. Writes feedback to `D1: Bill Store`. Writes subscription changes to `D2: Subscriber Store`.

5. **P5: System Monitoring** — Reads from `D1: Bill Store` and `D2: Subscriber Store` to compute dashboard statistics. Aggregates feedback for the insights dashboard. Logs LLM usage for cost tracking. Detects and alerts on pipeline failures.

**Data Stores**:

- **D1: Bill Store** — Contains: bills (metadata + text + summaries), bill_tags, bill_chunks (embeddings), feedback, llm_usage_log. Physically maps to Supabase PostgreSQL + pgvector + Supabase Storage (PDFs).
- **D2: Subscriber Store** — Contains: subscribers (encrypted phone, preferences), notifications (delivery tracking), audit_log. Physically maps to Supabase PostgreSQL + Supabase Vault.

### 6.3 Level 2 DFD — Process P1 (Bill Ingestion) Description

Process P1 decomposes into four sub-processes:

**P1.1: Scrape & Deduplicate** — Triggered by Cloud Scheduler every 6 hours. Scrapes bill listings from parliament.go.ke using BeautifulSoup. If parliament.go.ke is unreachable or times out, the scraper checks a designated local seed directory or Supabase Storage bucket for pre-downloaded PDF bills to process. For each bill URL/file found, computes SHA-256 hash and queries `D1: Bill Store`. If the hash already exists, skip. If new, stores bill metadata (title, URL, hash) with status `ingested` in `D1: Bill Store` and passes the bill to P1.2.

**P1.2: Download & Extract Text** — Downloads the PDF from the bill URL (or copies it from seed storage). Stores the raw PDF in Supabase Storage (`D1: Bill Store`). For the initial bill corpus (~25 bills), uses LlamaParse (Agentic Mode) for high-quality structured extraction of tables, nested clauses, and complex formatting. For new bills discovered by the automated pipeline, attempts digital text extraction using `pdfplumber`. If pdfplumber extraction yields less than 100 characters (indicating a scanned PDF), falls back to PyTesseract OCR. A quality heuristic checks extraction quality (ratio of garbled characters, table structure markers); if poor, the bill is queued for LlamaParse re-extraction. Stores extracted text in the `bills.extracted_text` column. Updates bill status to `extracted`. Passes extracted text to P1.3.

**P1.3: Regex Value Extraction** — Receives extracted text from P1.2. Runs deterministic regex patterns to find percentages (`X%`, `X per cent`), monetary amounts (`KES X`, `Ksh X`), and dates. For each match, captures the value, the raw match text, and ±200 characters of surrounding context. Stores results as JSONB in `bills.regex_extractions`. Passes text + regex results to P1.4.

**P1.4: Generate Embeddings** — Receives extracted text from P1.2. Splits text into chunks using structural regex splitting (splitting at PART, Section, and Schedule boundaries to preserve semantic clause logic), with recursive character splitting (double-newlines -> single newlines -> character limit of 1,000 with 200-char overlap) as a fallback. For each chunk, calls the Gemini `text-embedding-004` model to generate a 768-dimensional vector. Stores each chunk's text, section reference (if extractable), and embedding in the `bill_chunks` table (`D1: Bill Store`).

### 6.4 Level 2 DFD — Process P2 (AI Analysis) Description

Process P2 decomposes into three sub-processes:

**P2.1: Summarize** — Receives extracted bill data from P1. Retrieves the top-5 most relevant chunks from `bill_chunks` (pgvector cosine similarity search, filtered by bill ID). Constructs a prompt containing: the RAG-retrieved chunks, the regex-extracted values, and the full bill text (up to 100K characters — Gemini 2.5 Flash supports 1M context). Sends the prompt to Gemini 2.5 Flash requesting a structured English summary with section citations, key implications, and industry tags. Parses the response (Pydantic structured output). Stores the summary in `bills.ai_summary_en` and tags in `bill_tags`. Updates bill status to `summarized`. Passes the summary to P2.2.

**P2.2: Verify** — Receives the AI summary from P2.1. Constructs a verification prompt containing: the summary text, the RAG-retrieved chunks (same top-5), and the regex-extracted values. Sends to Gemini 3.5 Flash with instructions to: (a) check every numerical claim against the regex-extracted values, (b) check every section citation against the RAG chunks, (c) check for hallucinated provisions, and (d) explicitly verify boundary and edge conditions against the checklist: Min/Max Caps, Threshold Triggers, Temporal Validity, and Exemptions. Returns a structured verdict: `{verified: bool, issues: [...], confidence: float}`. If verified = true, updates bill status to `verified` and passes to P2.3. If verified = false (issues found), passes the issues back to P2.1 for re-summarization with corrections. **Maximum 2 retries** — if verification fails twice, the bill is marked as `failed` with the verification issues logged in `bills.ai_error` and the background task exits.

**P2.3: Translate** — Receives the verified English summary from P2.2. Sends to Gemini 2.5 Flash with a translation prompt specifying: translate to Swahili, preserve all numerical values exactly as-is, preserve all section citations, maintain the same structure. Stores the Swahili summary in `bills.ai_summary_sw`. Updates bill status to `translated`. FastAPI then triggers the subscriber matching and alerts fan-out tasks in the background.

### 6.5 Level 2 DFD — Process P3 (Alert Fan-Out) Description

Process P3 decomposes into four sub-processes:

**P3.1: Match Subscribers** — Triggered asynchronously in the background when the bill status transitions to `translated`. Reads the bill's industry tags from `bill_tags`. Queries `subscribers` for all active subscribers whose `industry_tags` array overlaps with the bill's tags (`WHERE industry_tags && ARRAY[{bill_tags}] AND is_active = TRUE`). Returns matched subscriber list grouped by hustle tier.

**P3.2: Compute Tier-Level Impacts** — For each unique hustle tier among the matched subscribers (not per subscriber), invokes the Financial Impact Agent (Gemini 3.5 Flash + Calculator Tool). The agent receives the verified bill summary, the regex-extracted values, and the tier's predefined metrics. It reasons about the financial formula, calls the Calculator Tool for arithmetic, and produces a structured impact result including a clear **Step-by-Step Math Breakdown** (XAI) for transparency. The Verification Agent validates the formulae and reasoning against caps, thresholds, validity, and exemptions (max 2 retries). Results are cached in memory for the duration of this fan-out batch.

**P3.3: Format Messages** — For each matched subscriber, templates the tier-level impact result (including the Step-by-Step Math Breakdown and a KDPA-compliant data deletion/unsubscribe statement) into an SMS or WhatsApp message in the subscriber's preferred language. SMS messages are capped at 480 characters (3 segments). WhatsApp messages can be longer and include bold formatting, bullet points, and a "View Full Analysis" deep link to the web app.

**P3.4: Dispatch & Track** — Sends formatted messages to Africa's Talking (SMS and/or WhatsApp based on subscriber channel preference). Creates a `notifications` record with status `queued` for each message. Enforces the `MAX_SMS_FAN_OUT` cap (500 during testing). If the cap is reached, remaining subscribers are not notified for this bill — they can view the analysis on the web app. Updates notification status to `sent` on successful API call. Africa's Talking delivery receipts (webhook callback) update status to `delivered` or `failed` asynchronously.

---

## 7. System Flowchart Description

The system flowchart describes the end-to-end flow from bill discovery to citizen notification, including all decision points and error paths.

**Start** → Cloud Scheduler fires every 6 hours.

1. **Call parliament.go.ke scraper** → Decision: Scraper succeeds?
   - Yes → Receive bill list (HTML-parsed array of {title, url})
   - No → **Fallback: check local seed directory/Supabase Storage bucket**. If files found, process them. If none found, log error to Cloud Logging → **End** (wait for next scheduled run)

2. **For each bill in the list** → Compute `url_hash = SHA256(url)[:16]`

3. **Query Supabase**: `SELECT id FROM bills WHERE url_hash = ?` → Decision: Bill already exists?
   - Yes → Skip this bill, continue to next bill in list
   - No → Insert new bill record (status: `ingested`), download PDF (or copy from seed), trigger FastAPI `process_bill_pipeline` background task

4. **Extract text from PDF** → Try `pdfplumber` digital extraction. Decision: Extracted text > 100 characters?
   - Yes → Use digital text
   - No → **Fallback: PyTesseract OCR**. Decision: OCR extraction > 100 characters?
     - Yes → Use OCR text
     - No → Mark bill status as `failed` (error: "Unreadable PDF"), log to database → continue to next bill

5. **Run regex extraction** on the text → Extract all percentages, monetary amounts, dates. Store as JSONB in `bills.regex_extractions`.

6. **Generate vector embeddings** → Split text into chunks using structural regex splitting (PART, Section, Schedule), with recursive character splitting (1,000 chars, 200 overlap) as a fallback. Call Gemini `text-embedding-004` for each chunk. Store in `bill_chunks` table. Update status to `extracted`.

7. **AI Pipeline Background Task Execution** → Retrieve top-5 chunks via pgvector similarity search. Construct prompt with chunks + regex values + full text.

8. **Call Gemini 2.5 Flash** (Summarization Agent) → Receive structured summary (English, with citations + industry tags). Store summary and tags. Update status to `summarized`.

9. **Call Gemini 3.5 Flash** (Verification Agent) → Check claims and verify boundaries (caps, thresholds, temporal, exemptions). Decision: Summary verified?
    - Yes → Update status to `verified`, continue
    - No → Retry counter check. Decision: Retries < 2?
      - Yes → Pass issues back to Summarization Agent (Step 8) with corrections
      - No → Mark status as `failed`, log issues to database → continue to next bill

10. **Call Gemini 2.5 Flash** (Translation Agent) → Produce Swahili translation. Store translation. Update status to `translated`.

11. **Subscriber Matching & Alerts (Background Task)** → Query active subscribers by industry tag overlap. Group by unique hustle tier. Decision: Any matched subscribers?
    - No → Log "No subscribers matched" → **End** for this bill
    - Yes → Continue

12. **For each unique hustle tier** → Call Financial Impact Agent (Gemini 3.5 Flash + Calculator Tool) to compute impact table and Step-by-Step Math Breakdown. Call Verification Agent to validate. Cache result per tier.

13. **For each matched subscriber** → Counter check: Decision: Messages sent < `MAX_SMS_FAN_OUT` (500)?
    - No → Log "Fan-out cap reached" → **End** for this bill
    - Yes → Format message in subscriber's language, including Step-by-Step Math Breakdown and KDPA compliance data deletion notice. Determine channel (SMS/WhatsApp/both).

14. **Send via Africa's Talking API** (or custom webhook OTP / testing bypass code in dev) → Decision: API call successful?
    - Yes → Create notification record (status: `sent`). Increment counter.
    - No → Create notification record (status: `failed`, reason logged). Increment counter. Continue to next subscriber.

15. **After all subscribers processed** → **End** for this bill.

16. **Asynchronously**: Africa's Talking sends delivery receipt webhook → Update notification status to `delivered` or `failed`.

**End** → Wait for next Cloud Scheduler trigger.

---

## 8. Activity Diagram Descriptions

### 8.1 Activity: Citizen Views Bill Summary and Calculates Impact

**Actors**: Citizen (swimlane 1), Next.js Frontend (swimlane 2), FastAPI Backend (swimlane 3), Supabase (swimlane 4), Gemini API (swimlane 5)

**Flow**:

1. [Citizen] Opens the KeLegislate PWA on their phone.
2. [Frontend] Renders the bill list page. Calls `GET /api/bills`.
3. [Backend] Queries `bills` table (WHERE ai_status = 'translated', ORDER BY created_at DESC). Returns paginated bill list (id, title, tags, date, status).
4. [Supabase] Returns query results.
5. [Frontend] Displays bill cards with titles, industry tag badges, and dates.
6. [Citizen] Taps on a bill card.
7. [Frontend] Navigates to `/bills/{id}`. Calls `GET /api/bills/{id}`.
8. [Backend] Queries `bills` table by ID. Returns full bill data including `ai_summary_en`, `ai_summary_sw`, `regex_extractions`.
9. [Supabase] Returns bill record.
10. [Frontend] Displays summary in English (default). Shows a language toggle (EN/SW). Shows industry tags, key implications, and source citations. Shows a "Calculate My Impact" button.
11. [Citizen] *Decision point*: Read summary only, or calculate impact?
    - **Read only** → Activity ends here.
    - **Calculate impact** → Citizen taps "Calculate My Impact."
12. [Frontend] Shows a bottom sheet with: industry selector (8 options), tier selector (3 options per industry, loaded dynamically).
13. [Citizen] Selects industry (e.g., "Transport & Logistics") and tier (e.g., "Tier 1 — BodaBoda Rider").
14. [Frontend] Shows a loading spinner ("Analyzing impact on your hustle..."). Calls `POST /api/impact` with `{bill_id, industry, tier}`.
15. [Backend] Loads bill summary from Supabase. Loads hustle profile metrics from in-memory Python dict (not from database — these are predefined). *Fork into parallel activities*:
    - (a) Calls Gemini 3.5 Flash (Financial Impact Agent) with summary + profile metrics.
    - (b) Gemini 3.5 Flash reasons about the formula, calls the Calculator Tool for arithmetic.
16. [Gemini API] Returns structured financial impact (KES table, net monthly impact, compliance checklist, risk level).
17. [Backend] Calls Gemini 3.5 Flash (Verification Agent) with the impact result + source values.
18. [Gemini API] Returns verification verdict.
19. [Backend] *Decision point*: Verified?
    - **Yes** → Returns impact JSON to frontend. **Does NOT write to Supabase.** (Privacy-by-design: ephemeral data.)
    - **No** (and retries < 2) → Loops back to step 15(a) with corrections.
    - **No** (and retries exhausted) → Returns a degraded response with a disclaimer ("This analysis could not be fully verified. Treat figures as approximate.").
20. [Frontend] Renders impact analysis: KES impact table, net monthly cost, compliance checklist, risk badge (LOW/MEDIUM/HIGH). Shows a "Share via WhatsApp" button.
21. [Citizen] Reads the analysis. Activity ends.

**Notes**: Total latency target: < 10 seconds (steps 14-19). No financial data persists after the HTTP response is sent. If the user refreshes the page, they must recalculate — this is intentional (data minimization).

### 8.2 Activity: Citizen Subscribes to Bill Alerts

**Actors**: Citizen (swimlane 1), Next.js Frontend (swimlane 2), FastAPI Backend (swimlane 3), Supabase (swimlane 4), Africa's Talking (swimlane 5)

**Flow**:

1. [Citizen] Taps "Get Alerts" on the web app.
2. [Frontend] Shows a subscription form: phone number input, industry checkboxes (multi-select from 8 options), language radio (English/Swahili), channel checkboxes (SMS/WhatsApp).
3. [Frontend] Displays a consent dialog: "We will store your phone number (encrypted) and industry choices to send you bill alerts. You can unsubscribe at any time by tapping 'Manage Alerts' in the app or replying STOP to any SMS. We never share your number with third parties."
4. [Citizen] Enters phone number, selects industries, selects language, selects channel, reads and accepts consent.
5. [Frontend] Validates phone number format (E.164 regex: `^\+254\d{9}$`). If invalid, shows inline error.
6. [Frontend] Calls `POST /api/subscribe` with `{phone, industries, language, channels}`.
7. [Backend] Normalizes phone number (handles `0XXXXXXXXX`, `254XXXXXXXXX`, `+254XXXXXXXXX` formats). Computes phone hash (SHA-256). *Decision point*: Does subscriber with this phone hash already exist?
    - **Yes** → Update existing record with new preferences (merge industry tags, update language/channels). This is an upsert.
    - **No** → Encrypt phone via Supabase Vault. Insert new subscriber record with consent timestamp.
8. [Supabase] Stores/updates subscriber record.
9. [Backend] Logs `subscriber_create` to `audit_log`.
10. [Backend] Sends a confirmation message via Africa's Talking: "Welcome to KeLegislate! You'll receive alerts about bills affecting [selected industries]. Reply STOP to unsubscribe."
11. [Africa's Talking] Delivers confirmation SMS/WhatsApp.
12. [Backend] Returns success response to frontend.
13. [Frontend] Shows success message: "You're subscribed! You'll receive alerts when new bills affecting your hustle are introduced."
14. [Citizen] Activity ends.

### 8.3 Activity: Automated Bill Processing Pipeline (End-to-End)

**Actors**: Cloud Scheduler (swimlane 1), Scraper Service (swimlane 2), Text Extraction Service (swimlane 3), AI Pipeline Service (swimlane 4), Notification Service (swimlane 5)

**Flow**:

1. [Cloud Scheduler] Fires HTTP trigger at T+0, T+6h, T+12h, T+18h daily.
2. [Scraper Service] Receives trigger. Scrapes parliament.go.ke using BeautifulSoup. *Decision*: Scrape successful?
   - Yes → Parse bill list.
   - No → Circuit breaker check. *Decision*: Circuit open?
     - Yes → Log "Parliament.go.ke circuit open, skipping this run."
     - No → Increment failure count. If failure count ≥ 3, open circuit (60s cooldown). Log failure.
3. [Scraper Service] For each bill URL, query Supabase for URL hash. *Decision*: New bill?
    - No → Skip.
    - Yes → Publish `{url, title, url_hash}` to `bill-ingested` Pub/Sub topic.
4. [Text Extraction Service] Receives `bill-ingested` event. Downloads PDF. Extracts text (pdfplumber → OCR fallback). Runs regex extraction. Generates embeddings. Stores all in Supabase. Publishes to `bill-extracted` topic.
5. [AI Pipeline Service] Receives `bill-extracted` event. Retrieves RAG chunks. Runs Summarization Agent → Verification Agent (max 2 retries) → Translation Agent. Stores verified summaries. Publishes to `bill-analyzed` topic.
6. [Notification Service] Receives `bill-analyzed` event. Matches subscribers by industry tags. Computes tier-level impacts (Financial Impact Agent + Verification Agent). *Decision*: Messages sent < MAX_SMS_FAN_OUT?
    - Yes → Format and send alert via Africa's Talking. Log notification.
    - No → Stop sending. Log "Fan-out cap reached for bill {id}."
7. All services complete. Wait for next trigger.

---

## 9. Sequence Diagram Descriptions

### 9.1 Sequence: On-Demand Financial Impact Calculation (Synchronous Path)

**Participants** (left to right): Citizen Browser, Next.js Frontend, FastAPI Backend, Supabase PostgreSQL, Gemini 3.5 Flash, Calculator Tool

**Message Sequence**:

1. `Citizen Browser` → `Next.js Frontend`: User clicks "Calculate My Impact" and selects industry + tier.
2. `Next.js Frontend` → `FastAPI Backend`: `POST /api/impact {bill_id: "abc123", industry: "Transport & Logistics", tier: "Tier 1 — BodaBoda Rider"}` (includes JWT auth token in header if logged in; endpoint also accessible without auth).
3. `FastAPI Backend` → `FastAPI Backend`: Auth middleware — verify JWT if present (optional auth). Extract user context if authenticated.
4. `FastAPI Backend` → `Supabase PostgreSQL`: `SELECT ai_summary_en, regex_extractions FROM bills WHERE id = 'abc123' AND ai_status = 'translated'`
5. `Supabase PostgreSQL` → `FastAPI Backend`: Returns bill summary + regex values.
6. `FastAPI Backend` → `FastAPI Backend`: Load hustle profile from in-memory `HUSTLE_PROFILES` dict. Profile = `HUSTLE_PROFILES["Transport & Logistics"][0]` (Tier 1 BodaBoda metrics).
7. `FastAPI Backend` → `Gemini 3.5 Flash`: Financial Impact Agent prompt: `{system: "You are a financial analyst...", user: "Bill summary: [summary]. Regex-extracted values: [values]. Business profile: [metrics]. Use the calculate() tool for all arithmetic..."}`. Function definitions: `[{name: "calculate", parameters: {expression: string}}]`.
8. `Gemini 3.5 Flash` → `FastAPI Backend`: Function call: `calculate({expression: "150000 * 0.025"})`.
9. `FastAPI Backend` → `Calculator Tool`: Evaluate `"150000 * 0.025"`.
10. `Calculator Tool` → `FastAPI Backend`: `{result: 3750.0, expression: "150000 * 0.025"}`.
11. `FastAPI Backend` → `Gemini 3.5 Flash`: Function response: `{result: 3750.0}`.
12. `Gemini 3.5 Flash` → `FastAPI Backend`: (May make additional calculate() calls for other line items — steps 8-11 repeat). Final response: Structured JSON with KES impact table, net monthly impact, compliance checklist, risk level.
13. `FastAPI Backend` → `Gemini 3.5 Flash`: Verification Agent prompt: `{system: "You are a verification agent...", user: "Financial impact result: [result]. Source regex values: [values]. Source bill summary: [summary]. Verify: (a) formulae correctness, (b) values match source, (c) reasoning is sound."}`.
14. `Gemini 3.5 Flash` → `FastAPI Backend`: `{verified: true, confidence: 0.95, issues: []}`.
15. `FastAPI Backend` → `FastAPI Backend`: Log LLM usage (tokens, latency, cost) to `llm_usage_log` (this IS persisted — it's system data, not user data).
16. `FastAPI Backend` → `Next.js Frontend`: HTTP 200, JSON response with impact analysis. **No write to Supabase for the impact result itself.**
17. `Next.js Frontend` → `Citizen Browser`: Render impact analysis cards.

**Total message count**: 17 messages. **Target duration**: < 10 seconds end-to-end.

### 9.2 Sequence: Asynchronous Bill Alert Delivery (Background Task Monolith)

**Participants**: Cloud Scheduler, FastAPI Backend (Cloud Run Monolith), Supabase, Gemini API, Africa's Talking

**Message Sequence**:

1. `Cloud Scheduler` → `FastAPI Backend`: HTTP POST trigger to `/api/tasks/scrape` (every 6 hours).
2. `FastAPI Backend` → External: BeautifulSoup scraper fetches bill listing from parliament.go.ke. (Fallback to local seed directory checks if down).
3. `FastAPI Backend` → `Supabase`: `SELECT id FROM bills WHERE url_hash = SHA256(url)[:16]`.
4. `Supabase` → `FastAPI Backend`: Existing bill IDs (or empty if new).
5. `FastAPI Backend` → `Supabase`: For new bills: `INSERT INTO bills (url_hash, title, source_url, ai_status) VALUES (..., 'ingested')`.
6. `FastAPI Backend` → `FastAPI Backend`: Triggers FastAPI native `BackgroundTasks`: `process_bill_pipeline(bill_id)`.
7. `FastAPI Backend` → External: (Background) Downloads PDF from bill URL.
8. `FastAPI Backend` → `FastAPI Backend`: Runs text extraction (pdfplumber/OCR with LlamaParse fallback), structural regex splitting, updates status to `extracted` in Supabase.
9. `FastAPI Backend` → `Supabase`: (Background) Generate and store vector embeddings for chunks.
10. `FastAPI Backend` → `Supabase`: (Background) Fetch text, regex extractions, top-5 chunks for RAG.
11. `FastAPI Backend` → `Gemini API`: (Background) Summarization Agent prompt (Gemini 2.5 Flash).
12. `Gemini API` → `FastAPI Backend`: (Background) English summary with citations + tags.
13. `FastAPI Backend` → `Gemini API`: (Background) Verification Agent prompt (Gemini 3.5 Flash) with boundary checks (caps, thresholds, temporal, exemptions).
14. `Gemini API` → `FastAPI Backend`: (Background) Verification verdict `{verified: true/false}`.
15. *Alt fragment [verified = false, retries < 2]*: Loop back to step 11 with corrections.
16. *Alt fragment [verified = false, retries >= 2]*: Mark bill as `failed` in Supabase, log error, end.
17. `FastAPI Backend` → `Gemini API`: (Background) Translation Agent prompt (Gemini 2.5 Flash).
18. `Gemini API` → `FastAPI Backend`: (Background) Swahili translation.
19. `FastAPI Backend` → `Supabase`: (Background) Store summaries (EN + SW), tags, update status to `translated`.
20. `FastAPI Backend` → `Supabase`: (Background) Query matching active subscribers (`WHERE industry_tags && bill_tags AND is_active = TRUE`).
21. `Supabase` → `FastAPI Backend`: (Background) Matched subscribers list.
22. *Loop [for each unique tier matched]*:
    23. `FastAPI Backend` → `Gemini API`: (Background) Financial Impact Agent prompt (Gemini 3.5 Flash + Calculator Tool).
    24. `Gemini API` → `FastAPI Backend`: (Background) Impact result (calling calculator tool) including Step-by-Step Math Breakdown.
    25. `FastAPI Backend` → `Gemini API`: (Background) Verification Agent prompt.
    26. `Gemini API` → `FastAPI Backend`: (Background) Verification verdict.
27. *Loop [for each matched subscriber, up to MAX_SMS_FAN_OUT]*:
    28. `FastAPI Backend` → `Supabase`: Decrypt phone number via Vault. Log `phone_decrypt` to `audit_log`.
    29. `FastAPI Backend` → `FastAPI Backend`: Format message (tier impact math breakdown + preferred language + KDPA opt-out statement).
    30. `FastAPI Backend` → `Africa's Talking`: Send SMS/WhatsApp (`POST /messaging/send`).
    31. `Africa's Talking` → `FastAPI Backend`: Response `{messageId, status: "Sent"}`.
    32. `FastAPI Backend` → `Supabase`: Insert notification record (status: `sent`).
33. *Later (asynchronous)*: `Africa's Talking` → `FastAPI Backend`: Delivery receipt webhook (`POST /api/webhooks/at-delivery`).
34. `FastAPI Backend` → `Supabase`: Update notification status to `delivered` or `failed`.

### 9.3 Sequence: Citizen Submits Feedback

**Participants**: Citizen Browser, Next.js Frontend, FastAPI Backend, Supabase

**Message Sequence**:

1. `Citizen Browser` → `Next.js Frontend`: User fills feedback form: support stance, rating (1-5), concerns text. Clicks "Submit."
2. `Next.js Frontend` → `Next.js Frontend`: Check if user is authenticated (JWT in session). *Decision*: Logged in?
   - Yes → Continue.
   - No → Show login prompt: "Please verify your phone number to submit feedback. This ensures one-person-one-vote integrity." Trigger Supabase Auth OTP flow. After successful OTP verification, continue.
3. `Next.js Frontend` → `FastAPI Backend`: `POST /api/feedback {bill_id, support, rating, concerns}` (includes JWT Bearer token in Authorization header).
4. `FastAPI Backend` → `FastAPI Backend`: Auth middleware: Verify Supabase JWT. Extract `user_id` from token payload. *Decision*: Valid JWT?
   - Yes → Continue.
   - No → Return HTTP 401 "Unauthorized."
5. `FastAPI Backend` → `Supabase`: `INSERT INTO feedback (bill_id, user_id, support, rating, concerns) VALUES (...)`.
6. `Supabase` → `FastAPI Backend`: Insert success (or `UNIQUE(bill_id, user_id)` constraint violation if duplicate).
7. `FastAPI Backend` → `Next.js Frontend`: HTTP 201 Created (or HTTP 409 Conflict if duplicate — "You've already submitted feedback for this bill.").
8. `Next.js Frontend` → `Citizen Browser`: Show success toast: "Thanks for your feedback!"
9. *Parallel*: `Supabase Realtime` → `Next.js Frontend` (all connected dashboard viewers): WebSocket event with updated feedback count for this bill. Dashboard charts update in real-time. **Note**: This step is entirely automatic — Supabase Realtime detects the `INSERT` via PostgreSQL's WAL and broadcasts the change without any explicit action by FastAPI. The backend does not send any Realtime events; it simply performs the `INSERT` in step 5, and Supabase handles the rest.

---

## 10. Component Diagram Description

The system is organized into five component packages, each deployed as a separate unit.

### Package 1: Next.js Frontend (Vercel)

**Components**:
- **Pages Router**: Next.js App Router with routes: `/` (landing), `/bills` (bill list), `/bills/[id]` (bill detail + impact calculator), `/dashboard` (insights), `/subscribe` (alert subscription), `/account` (optional user profile, Phase 4).
- **PWA Service Worker**: Caches bill summaries for offline reading. Handles install prompt.
- **Supabase Client**: Browser-side Supabase SDK for Auth (phone OTP) and Realtime (WebSocket subscriptions for live dashboard).
- **API Client**: Fetch wrapper for FastAPI backend calls. Handles JWT token refresh, error states, retry logic.
- **UI Component Library**: Built with vanilla CSS (no Tailwind). Components: BillCard, ImpactTable, FeedbackForm, SubscriptionForm, DashboardCharts (using Recharts), LanguageToggle, ConsentDialog.

**Provided interfaces**: Web UI to Citizen. REST API calls to FastAPI Backend.  
**Required interfaces**: FastAPI Backend REST API. Supabase Auth + Realtime.

### Package 2: FastAPI Backend (Cloud Run)

**Components**:
- **Auth Middleware**: Verifies Supabase JWT tokens. Enforces optional auth (public endpoints work without auth; authenticated endpoints return richer data).
- **Bills Router**: `GET /api/bills` (list), `GET /api/bills/{id}` (detail). Read-only.
- **Impact Router**: `POST /api/impact`. Invokes Financial Impact Agent synchronously. No-storage design.
- **Feedback Router**: `POST /api/feedback`. Rate-limited (IP + phone hash dedup).
- **Subscribe Router**: `POST /api/subscribe`, `DELETE /api/subscribe`. Phone encryption via Supabase Vault.
- **Dashboard Router**: `GET /api/dashboard/stats`, `GET /api/dashboard/feedback/{bill_id}`. Aggregation queries.
- **Webhook Router**: `POST /api/webhooks/at-delivery`. Receives Africa's Talking delivery receipts. **Critical design constraint**: This endpoint must perform **minimal work** — only a fast `UPDATE notifications SET status = $1 WHERE at_message_id = $2` query — because batch SMS sends (e.g., 500 messages) can trigger hundreds of concurrent delivery receipt webhooks from Africa's Talking nearly simultaneously. Heavy processing in this handler would cause CPU throttling on Cloud Run's free tier.
- **Agent Orchestrator**: The DAG state machine (see Section 13). Manages agent invocations, retry logic, circuit breakers.
- **Calculator Tool**: Deterministic Python calculator function. Exposed as a Gemini function calling definition.
- **Regex Extractor**: Deterministic regex patterns for financial value extraction from bill text.
- **Supabase Client**: Server-side Supabase SDK for PostgreSQL, Vault, Storage.
- **Gemini Client**: Google AI Python SDK. Wraps Gemini 2.5 Flash and 3.5 Flash calls with circuit breaker, retry, and token counting.
- **AT Client**: Africa's Talking Python SDK. Wraps SMS/WhatsApp sending with retry and delivery tracking.

**Provided interfaces**: REST API to Frontend. Pub/Sub message handlers for pipeline services.  
**Required interfaces**: Supabase (PostgreSQL, Auth, Vault, Storage). Gemini API. Africa's Talking API.

### Package 3: Event Pipeline Services (Modular Monolith)

**Components**:
- **Scraper Service**: Parsers parliament.go.ke for bill listings. Deduplicates by URL hash. Contains a fallback mechanism to parse from local seed directories or Supabase Storage buckets if the external website is unreachable.
- **Text Extraction Module**: Downloads PDFs, runs text extraction (pdfplumber + OCR), parses regex values, and manages RAG embedding chunking.
- **AI Pipeline Module**: Orchestrates Summarization → Verification → Translation agents using the DAG and custom state objects.
- **Matching & Alerts Module**: Correlates bill tags to subscribers and schedules SMS/WhatsApp delivery via Africa's Talking.

**Note**: For the 8-week buildathon, these modules are packaged and executed asynchronously inside the single FastAPI backend service using `BackgroundTasks`. This avoids the configuration, cold start chaining, and operational overhead of Google Cloud Pub/Sub and multiple distinct microservices, while keeping the modules cleanly separated to allow a smooth transition to separate Cloud Run services post-competition.

### Package 4: Data Layer (Supabase)

**Components**:
- **PostgreSQL**: 8 tables (see ERD in Section 5). Row Level Security policies on all user-facing tables.
- **pgvector Extension**: Vector similarity search for RAG. IVFFlat index on `bill_chunks.embedding`.
- **Supabase Auth**: Phone OTP authentication. JWT issuance. 50K MAU free tier.
- **Supabase Vault**: AES-256 encryption for phone numbers at rest. Key managed by Supabase.
- **Supabase Storage**: Bill PDF storage. 1GB free tier.
- **Supabase Realtime**: WebSocket channels for live dashboard updates. 200 concurrent connections free.

### Package 5: External Services (Third-Party)

**Components**:
- **Parliament.go.ke**: Bill listing source (scraped via BeautifulSoup).
- **Gemini 2.5 Flash**: Summarization + translation. $0.30/$2.50 per 1M tokens.
- **Gemini 3.5 Flash**: Financial reasoning + verification. $1.50/$9.00 per 1M tokens.
- **Gemini text-embedding-004**: Embedding generation for RAG. 768 dimensions.
- **Africa's Talking SMS API**: Live SMS delivery. ~KES 0.40 per message.
- **Africa's Talking WhatsApp API / Meta Cloud API Sandbox**: WhatsApp message delivery. 250 recipients/day in sandbox mode.

---

## 11. Deployment Diagram Description

The deployment diagram shows the physical infrastructure and network topology.

### Nodes

**Node 1: Vercel Edge Network (Global CDN)**
- **Artifact**: Next.js application (static pages + serverless functions)
- **Environment**: Node.js 20 runtime
- **Scaling**: Auto-scaled by Vercel. Hobby plan: 100K function invocations/month.
- **Connectivity**: HTTPS (TLS 1.3) to user browsers. HTTPS to FastAPI backend (Cloud Run).

**Node 2: Google Cloud Run — FastAPI Monolith Service**
- **Artifact**: FastAPI Docker container (Python 3.12, slim base image with OS-level `tesseract-ocr`, `libtesseract-dev`, and `ghostscript` packages installed)
- **Environment**: 1 vCPU, 1 GB RAM (sized to handle text extraction and OCR fallback), minimum 1 instance, and always-on CPU allocation (configured via the `--no-cpu-throttling` flag to prevent FastAPI `BackgroundTasks` from freezing mid-execution after returning the HTTP response)
- **Scaling**: 0-5 instances (auto-scaled based on traffic volume)
- **Connectivity**: HTTPS ingress from Vercel. HTTPS egress to Supabase, Gemini API, Africa's Talking, and Parliament.go.ke.
- **Background Workers**: Executes in-memory async background tasks using FastAPI's built-in `BackgroundTasks` thread pool.

**Node 3: Google Cloud Pub/Sub (Deferred to Post-Buildathon)**
- **Role**: Not implemented during the buildathon to avoid infrastructure and debugging complexity. High-performance asynchronous decoupling will be introduced post-competition.

**Node 4: Google Cloud Scheduler**
- **Job**: `scrape-bills` — HTTP POST to Scraper endpoint `/api/tasks/scrape`, every 6 hours (cron: `0 */6 * * *`).
- **Keepalive Job**: `supabase-keepalive` — HTTP GET to backend endpoint `/api/health`, every 6 hours (cron: `0 3,9,15,21 * * *`). The backend endpoint executes a lightweight query (e.g. `SELECT 1;` or briefly queries the bills table) on the Supabase PostgreSQL database to register active compute, preventing the free tier DB from pausing.

**Node 6: Supabase Cloud (AWS ap-south-1 or eu-west-1)**
- **Artifacts**: PostgreSQL 15 (with pgvector), GoTrue Auth server, Storage API, Realtime server, Vault
- **Environment**: Managed by Supabase. Free tier: 500 MB DB, 1 GB storage, 50K MAU auth, 200 concurrent realtime connections. **Storage monitoring**: Cloud Monitoring alert at 400MB (80% threshold).
- **Connectivity**: Accepts connections from Cloud Run (API key + JWT auth). WebSocket connections from user browsers (for Realtime).

**Node 6b: VPS (Contingency — Not Primary)**
- **Purpose**: Available as a fallback hosting option if Cloud Run free tier proves insufficient (e.g., hitting request limits, cold starts unacceptable for user-facing requests, or GPU compute needed for Docling PDF processing).
- **Current status**: Not active. Cloud Run is the primary deployment target. VPS evaluated only if Cloud Run limitations block development.
- **If activated**: Would host the FastAPI backend and pipeline services directly, replacing Nodes 2 and 3. Would require manual deployment (nginx/Caddy reverse proxy, systemd process management, Let's Encrypt SSL).

**Node 7: Africa's Talking Servers**
- **SMS Gateway**: Shared short code for student accounts. Live API endpoint.
- **WhatsApp Gateway**: Routes through Meta Cloud API.
- **Connectivity**: REST API (HTTPS). Webhook callbacks to Cloud Run for delivery receipts.

**Node 8: Citizen's Mobile Device**
- **Artifacts**: Browser (Chrome/Safari, mobile-first), SMS app, WhatsApp app
- **Connectivity**: HTTPS to Vercel (PWA). SMS via carrier network. WhatsApp via internet.

### Network Communication Protocols

| From | To | Protocol | Authentication |
|---|---|---|---|
| Browser → Vercel | HTTPS (TLS 1.3) | None (public) |
| Vercel → Cloud Run API | HTTPS | Supabase JWT (Bearer token) |
| Cloud Run → Supabase | HTTPS | Supabase service role key |
| Cloud Run → Gemini | HTTPS | Google API key |
| Cloud Run → Africa's Talking | HTTPS | AT API key + username |
| Cloud Run → Parliament.go.ke | HTTPS | None (public website) |
| Browser → Supabase Realtime | WSS (WebSocket Secure) | Supabase anon key + JWT |
| Africa's Talking → Cloud Run (webhooks) | HTTPS | AT webhook signature verification |

---

## 12. State Machine Diagram Description

### 12.1 Bill Processing State Machine

The `bills.ai_status` column tracks a bill's lifecycle through the system. There are 6 states and 8 transitions.

**States**:

| State | Description | Entry Action |
|---|---|---|
| `ingested` | Bill metadata stored. PDF not yet downloaded. | Scraper inserts record after deduplication check passes |
| `extracted` | PDF downloaded, text extracted, regex values found, embeddings generated. | Text Extraction Service completes processing |
| `summarized` | English AI summary generated (awaiting verification). | Summarization Agent returns response |
| `verified` | Summary cross-checked against source — all claims validated. | Verification Agent returns `{verified: true}` |
| `translated` | Swahili translation complete. Bill is fully processed and ready for alerts. | Translation Agent returns response |
| `failed` | Processing failed at some stage. Human review needed. | Any stage fails after retries exhausted |

**Transitions**:

1. `ingested` → `extracted`: Text extraction module successfully processes the PDF and saves text and regex extractions.
2. `ingested` → `failed`: PDF download fails, or text extraction yields < 100 chars after both digital and OCR attempts.
3. `extracted` → `summarized`: Summarization Agent returns a structured summary.
4. `extracted` → `failed`: Gemini API call fails after circuit breaker exhaustion.
5. `summarized` → `verified`: Verification Agent confirms all claims are grounded in source text.
6. `summarized` → `summarized` (self-loop): Verification Agent finds issues; re-summarization triggered (max 2 retries).
7. `verified` → `translated`: Translation Agent completes Swahili translation.
8. `summarized` → `failed`: Verification fails after 2 retries. Issues logged in `bills.ai_error`.

**Guard conditions on the self-loop (summarized → summarized)**:
- `retry_count < 2`: Allows re-summarization with corrections.
- `retry_count >= 2`: Transitions to `failed` instead.

### 12.2 Notification State Machine

The `notifications.status` column tracks each alert message through delivery.

**States**:

| State | Description |
|---|---|
| `queued` | Notification record created, message not yet sent to Africa's Talking |
| `sent` | Message accepted by Africa's Talking API (immediate response) |
| `delivered` | Africa's Talking confirmed delivery to the subscriber's device (async webhook) |
| `failed` | Delivery failed — phone unreachable, invalid number, or AT API error |

**Transitions**:

1. `queued` → `sent`: Africa's Talking API returns `{status: "Sent"}`.
2. `queued` → `failed`: Africa's Talking API returns error, or HTTP call fails.
3. `sent` → `delivered`: Delivery receipt webhook received with success status.
4. `sent` → `failed`: Delivery receipt webhook received with failure status (e.g., `"Rejected"`, `"DeliveryFailure"`).

### 12.3 Subscriber State Machine

**States**:

| State | Description |
|---|---|
| `active` | Subscriber is receiving alerts. `is_active = TRUE` |
| `inactive` | Subscriber has unsubscribed. `is_active = FALSE`. Data retained for 12 months |
| `deleted` | 12 months of inactivity. Data permanently deleted from database |

**Transitions**:

1. (Initial) → `active`: User completes subscription with consent.
2. `active` → `inactive`: User unsubscribes (web app or "STOP" SMS reply).
3. `inactive` → `active`: User re-subscribes (consent dialog re-presented).
4. `inactive` → `deleted`: 12-month retention timer expires. Automated deletion job (Cloud Scheduler, monthly).

---

## 13. Agent Orchestration Architecture (The DAG)

This section addresses Critique Point 3 in detail — how the 5 agents (4 AI agents + 1 deterministic extraction step) are orchestrated.

### 13.1 Why Not LangGraph

| Concern | LangGraph | Custom DAG |
|---|---|---|
| **Dependency weight** | Pulls in LangChain ecosystem (~50+ packages) | Zero external dependencies |
| **Learning curve** | Significant — state graphs, checkpointing, streaming | Minimal — Python dict + match/case |
| **Debugging** | Complex trace logs, opaque state transitions | Simple Python stack traces, full control |
| **Flexibility** | High (supports loops, branching, human-in-the-loop) | Sufficient for our linear-with-retry pipeline |
| **Team size** | Suited for larger teams with LangChain experience | Suited for team of 2 with limited time |
| **Buildathon risk** | High — learning + debugging LangGraph could consume 1-2 weeks | Low — custom DAG implemented in < 1 day |

**Decision**: Custom lightweight DAG. KeLegislate's agent pipeline is a **linear sequence with one conditional retry edge**, not a complex graph. LangGraph's power is unnecessary here and its complexity is a risk for a 2-person team on an 8-week timeline.

### 13.2 DAG Structure

The DAG represents state transitions of a bill through the AI pipeline. Each node is a processing step. Edges represent data flow. One edge is conditional (verification retry).

```
[Extract Text + Regex] → [Generate Embeddings] → [Summarize (Gemini 2.5 Flash)]
                                                        ↓
                                                  [Verify (Gemini 3.5 Flash)]
                                                   ↓ verified?     ↓ not verified
                                                  YES              (retry ≤ 2?)
                                                   ↓                ↓ YES → back to [Summarize]
                                            [Translate (Gemini 2.5 Flash)]  ↓ NO → [FAILED]
                                                   ↓
                                              [COMPLETE]
```

### 13.3 State Object

> **Tech stack note**: The backend is **Python (FastAPI)** deployed on Cloud Run. The frontend is **Next.js (JavaScript/TypeScript)** deployed on Vercel. All agent orchestration, pipeline processing, and AI integration code is written in Python. Next.js handles only the user-facing web interface. The state object below is Python backend code.

All agents share a single state dictionary that accumulates data as it passes through the pipeline:

```python
@dataclass
class PipelineState:
    bill_id: str
    status: str  # Current stage: 'ingested', 'extracted', 'summarized', 'verified', 'translated', 'failed'
    
    # Populated by Text Extraction + Regex stage
    extracted_text: str | None = None
    regex_extractions: list[dict] | None = None  # [{type, value, context, position}, ...]
    
    # Populated by Embedding stage
    chunk_ids: list[str] | None = None  # IDs of stored chunks for RAG retrieval
    
    # Populated by Summarization Agent
    summary_en: str | None = None
    industry_tags: list[str] | None = None
    rag_chunks_used: list[str] | None = None  # The specific chunks retrieved for grounding
    
    # Populated by Verification Agent
    verification_result: dict | None = None  # {verified: bool, issues: [...], confidence: float}
    verification_retries: int = 0
    
    # Populated by Translation Agent
    summary_sw: str | None = None
    
    # Error tracking
    error: str | None = None
    
    # Cost tracking
    llm_calls: list[dict] = field(default_factory=list)  # [{agent, model, input_tokens, output_tokens, latency_ms}]
```

### 13.4 Orchestrator Logic

The orchestrator is a simple function that runs the DAG steps in sequence, with the verification retry being the only conditional branch:

```
function run_pipeline(bill_id):
    state = PipelineState(bill_id=bill_id, status='ingested')
    
    # Step 1: Extract text + regex (deterministic, no LLM)
    state = extract_and_regex(state)
    if state.status == 'failed': return persist_and_exit(state)
    
    # Step 2: Generate embeddings
    state = generate_embeddings(state)
    if state.status == 'failed': return persist_and_exit(state)
    
    # Step 3-4: Summarize + Verify (with retry loop)
    while state.verification_retries <= 2:
        state = summarize(state)  # Gemini 2.5 Flash
        if state.status == 'failed': return persist_and_exit(state)
        
        state = verify(state)  # Gemini 3.5 Flash
        if state.verification_result['verified']:
            break
        
        state.verification_retries += 1
        if state.verification_retries > 2:
            state.status = 'failed'
            state.error = f"Verification failed after 2 retries: {state.verification_result['issues']}"
            return persist_and_exit(state)
        
        # Feed verification issues back into summarization context for next iteration
    
    # Step 5: Translate
    state = translate(state)  # Gemini 2.5 Flash
    if state.status == 'failed': return persist_and_exit(state)
    
    # Persist final state to database
    persist_final(state)
    
    # Log all LLM costs
    log_llm_usage(state.llm_calls)
    
    return state
```

This is **explicit, debuggable, and requires no framework**. Each step function (`extract_and_regex`, `summarize`, `verify`, `translate`) takes the state, performs its work, updates the state, and returns it. If any step fails (e.g., Gemini API error after circuit breaker), it sets `state.status = 'failed'` and `state.error` with the reason.

### 13.5 Financial Impact Agent (Separate DAG — Runs per Tier)

The Financial Impact Agent runs separately from the bill processing pipeline. It's invoked either:
- **Asynchronously** by the Notification Service (per unique hustle tier, during alert fan-out)
- **Synchronously** by the Impact API endpoint (per user request, for on-demand calculations)

Its DAG is simpler — two steps with one retry edge:

```
[Financial Impact Agent (Gemini 3.5 Flash + Calculator Tool)] → [Verify (Gemini 3.5 Flash)]
                                                                   ↓ verified?     ↓ not verified
                                                                  YES              (retry ≤ 2?)
                                                                   ↓                ↓ YES → back to [Impact Agent]
                                                               [COMPLETE]           ↓ NO → [Return with disclaimer]
```

Unlike the bill processing pipeline, impact calculation failure is **non-fatal** — the system returns a degraded response with a disclaimer rather than marking anything as `failed`. This is because impact calculations are ephemeral (not persisted), so a "best effort" result is still valuable to the user.

---

## 14. SMS Fan-Out & Cost Control Architecture

### 14.1 Testing Phase Limits (Buildathon)

During the buildathon, the system operates with conservative limits to control Africa's Talking API costs:

| Parameter | Value | Configurable Via |
|---|---|---|
| `MAX_SMS_FAN_OUT` | 500 | Environment variable on Cloud Run |
| `MAX_WHATSAPP_FAN_OUT` | 250 | Environment variable (Meta sandbox limit) |
| SMS message segments | Max 3 (480 chars) | Constant in code |
| Estimated monthly SMS cost | ~KES 80 (~$0.60) | Based on ~200 test messages/month |

### 14.2 Fan-Out Priority Strategy

When the fan-out cap is reached before all matched subscribers receive alerts, which subscribers should be prioritized?

**Strategy — First-Subscribed Priority** (simple, fair):
Subscribers are ordered by `created_at ASC` (earliest subscribers first). This rewards early adopters. The remaining subscribers can still view the bill analysis on the web app — they just don't receive a push alert.

An alternative strategy (not implemented for buildathon, but noted for future) would be **activity-based priority**: subscribers who have engaged with the app recently (viewed bills, submitted feedback) get alerts first.

### 14.3 Scaling Plan (Post-Buildathon)

When real users start joining, the SMS cap should be raised incrementally:

| User Count | `MAX_SMS_FAN_OUT` | Estimated Monthly SMS Cost |
|---|---|---|
| < 100 (testing) | 500 | ~KES 80 |
| 100 - 1,000 | 2,000 | ~KES 800 |
| 1,000 - 5,000 | 5,000 | ~KES 2,000 |
| 5,000+ | 10,000+ | Budget-dependent; consider tiered plans |

The cap is changed by updating a single environment variable on Cloud Run — no code changes, no redeployment.

### 14.4 Batch Sending Architecture

SMS messages are not sent individually in a tight loop (the current prototype's problem in [sms_utils.py:134-152](file:///c:/git/KeLegislate/src/sms_utils.py#L134-L152)). Instead:

1. The Notification Service receives the full list of matched subscribers.
2. Subscribers are batched into groups of 20 (Africa's Talking supports up to 20 recipients per API call for bulk SMS).
3. Each batch is sent as a single AT API call with multiple recipients.
4. Between batches, a 100ms delay is inserted to avoid AT rate limits.
5. If any batch fails, it's retried up to 3 times with exponential backoff.
6. Total fan-out is tracked against `MAX_SMS_FAN_OUT` — once the cap is hit, remaining batches are skipped.

### 14.5 Delivery Receipt Webhook Concurrency

When the Notification Service sends a batch of 500 SMS messages, Africa's Talking may fire up to 500 delivery receipt webhooks (`POST /api/webhooks/at-delivery`) back at the Cloud Run instance **almost simultaneously**. This creates a concurrency spike that can cause CPU throttling on the free tier.

**Mitigation — Minimal-work webhook handler**: The delivery receipt webhook endpoint must do **absolutely minimal work**:

```
POST /api/webhooks/at-delivery:
    1. Verify AT webhook signature (in-memory, < 1ms)
    2. Extract message_id and status from the request body
    3. Execute: UPDATE notifications SET status = $1, delivered_at = NOW() WHERE at_message_id = $2
    4. Return HTTP 200 immediately
```

No logging, no additional queries, no downstream event publishing — just a single indexed `UPDATE` statement. This ensures each webhook invocation completes in < 50ms, well within Cloud Run's CPU budget even under concurrent load. Detailed delivery analytics (e.g., aggregating delivery rates, identifying failed phone numbers) should be computed asynchronously via scheduled batch queries, not in the webhook handler.

---

## 15. API Contract Summary

These are the agreed-upon API endpoints. The API contracts are already established with the facilitators and should not change.

### 15.1 Public Endpoints (No Auth Required)

| Method | Endpoint | Request Body | Response | Description |
|---|---|---|---|---|
| `GET` | `/api/bills` | Query params: `?page=1&limit=20&industry=Transport` | `{bills: [{id, title, tags, date, status}], total, page}` | Paginated list of processed bills |
| `GET` | `/api/bills/{id}` | — | `{id, title, summary_en, summary_sw, tags, regex_extractions, source_url, date}` | Full bill detail with summaries |
| `POST` | `/api/impact` | `{bill_id, industry, tier, use_custom_profile?}` | `{impact_table, net_monthly, compliance_checklist, risk_level, verified, disclaimer?}` | On-demand financial impact (ephemeral). If `use_custom_profile=true` and JWT present, uses saved custom profile instead of predefined tier |
| `GET` | `/api/dashboard/stats` | Query params: `?bill_id=abc` | `{total_feedback, support_pct, avg_rating, top_concerns}` | Aggregated dashboard stats |

### 15.2 Authenticated Endpoints (Supabase JWT Required)

| Method | Endpoint | Request Body | Response | Description |
|---|---|---|---|---|
| `POST` | `/api/feedback` | `{bill_id, support, rating, concerns}` | `{id, created_at}` | Submit citizen feedback (auth required to prevent astroturfing; `UNIQUE(bill_id, user_id)` enforced) |
| `POST` | `/api/subscribe` | `{phone, industries[], language, channels[]}` | `{subscriber_id, status: "active"}` | Create/update subscription |
| `DELETE` | `/api/subscribe` | — | `{status: "inactive"}` | Deactivate subscription |
| `GET` | `/api/subscribe/status` | — | `{is_active, industries, language, channels}` | Check subscription status |
| `POST` | `/api/profile` | `{industry, tier_label?, custom_metrics}` | `{profile_id, created_at}` | Create or update custom business profile (encrypted at rest) |
| `GET` | `/api/profile` | — | `{industry, tier_label, custom_metrics, created_at, updated_at}` | Retrieve user's custom business profile |
| `DELETE` | `/api/profile` | — | `{status: "deleted"}` | Delete custom business profile permanently |

### 15.3 Internal/Webhook Endpoints

| Method | Endpoint | Caller | Description |
|---|---|---|---|
| `POST` | `/api/webhooks/at-delivery` | Africa's Talking | Delivery receipt callback |
| `POST` | `/api/tasks/scrape` | Cloud Scheduler | Scraper run trigger (runs background pipeline task) |
| `POST` | `/api/admin/run-pipeline/{id}` | Administrator | Manual trigger to run pipeline for specific bill (development/debug) |
| `POST` | `/api/auth/send-sms` | Supabase Auth | Custom SMS OTP webhook callback. Dispatches SMS via Africa's Talking and returns `{}` on success |

---

## 16. Security Architecture

### 16.1 Authentication & Authorization

| Layer | Mechanism | Details |
|---|---|---|
| **Frontend → Backend** | Supabase JWT (Bearer token) | JWT issued by Supabase Auth after phone OTP login. Verified by FastAPI middleware using Supabase's public JWT key. Optional for public endpoints |
| **Backend → Supabase** | Service role key | Full access, bypasses RLS. Stored in Cloud Run secret (Google Secret Manager) |
| **Backend → Gemini** | Google API key | Stored in Google Secret Manager |
| **Backend → Africa's Talking** | API key + username | Stored in Google Secret Manager |
| **Cloud Scheduler → Cloud Run** | OIDC token / API Secret | Scheduler triggers the scraper job via signed OIDC token, verified by backend |
| **Supabase → Backend (Custom SMS)** | Webhook Secret | Custom SMS webhook requests carry a configured secret header `x-supabase-webhook-secret` verified by backend to prevent SMS balance exhaustion exploits |
| **Africa's Talking → Backend** | Webhook signature | AT signs webhooks; backend verifies the signature before processing |

### 16.2 Data Protection

| Data | At Rest | In Transit | Access Control |
|---|---|---|---|
| **Phone numbers** | AES-256 encrypted via Supabase Vault | TLS 1.3 | Decrypted only at alert send time; decryption logged in `audit_log` |
| **Phone hashes** | SHA-256 (irreversible) | TLS 1.3 | Used for lookups and deduplication; cannot be reversed to phone number |
| **Custom business profiles** | Application-level encryption (JSONB `custom_metrics` field encrypted before storage) + Supabase encryption at rest | TLS 1.3 | RLS: only the owning user (`user_id = auth.uid()`) can read/write. Decryption logged in `audit_log` |
| **Bill text** | Supabase PostgreSQL (encrypted at rest by Supabase) | TLS 1.3 | Public data (bills are public documents) |
| **Feedback** | Supabase PostgreSQL | TLS 1.3 | RLS: users can only read their own feedback (by `user_id`). Aggregated stats are public (for dashboard) |
| **Financial impact results** | **Not stored** — computed in-memory only | TLS 1.3 (API response) | Ephemeral; discarded after HTTP response |

### 16.3 Row Level Security (RLS) Policies

| Table | Policy | Effect |
|---|---|---|
| `bills` | `SELECT` allowed for all (public) | Anyone can read bill summaries |
| `bill_tags` | `SELECT` allowed for all (public) | Anyone can read bill tags |
| `bill_chunks` | No direct access (internal only) | Only accessed by backend service role |
| `subscribers` | `SELECT`, `UPDATE`, `DELETE` WHERE `user_id = auth.uid()` | Users can only manage their own subscription |
| `feedback` | `INSERT` WHERE `auth.uid() IS NOT NULL`; `SELECT` WHERE `user_id = auth.uid()` OR aggregated (for dashboard) | Only authenticated users can submit; users can only read their own individual feedback |
| `user_profiles` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` WHERE `user_id = auth.uid()` | Users can only manage their own business profile |
| `notifications` | `SELECT` WHERE `subscriber_id` matches user's subscriber record | Users can view their own notification history |
| `llm_usage_log` | No public access | Admin/system only |
| `audit_log` | No public access | Admin/system only |

### 16.4 CORS Configuration

```python
ALLOWED_ORIGINS = [
    "https://kelegislate.vercel.app",       # Production frontend
    "http://localhost:3000",                 # Local development
]
```

No wildcard (`*`) origins. Credentials allowed. Methods restricted to `GET`, `POST`, `DELETE`, `OPTIONS`.

---

## 17. Non-Functional Requirements

During the buildathon, the priority is a **working, demonstrable product** — not production-grade performance targets. The requirements below are deliberately relaxed to avoid over-engineering during testing. Post-buildathon optimization targets are specified in Section 17.6.

### 17.1 Performance (Buildathon Targets)

These are relaxed targets for the testing/development phase. The system should work reliably end-to-end; latency optimization comes later.

| Metric | Buildathon Target | Measurement Method |
|---|---|---|
| Bill list page load | < 5 seconds | Lighthouse performance audit |
| Bill detail page load | < 5 seconds | Lighthouse |
| On-demand impact calculation | < 30 seconds | Backend latency logging (`llm_usage_log.latency_ms`) |
| SMS delivery (end-to-end) | < 2 minutes from `alerts-ready` event to AT API call | Notification service timestamp logging |
| Full pipeline (bill ingested → alerts sent) | < 15 minutes for a single bill | Pub/Sub message timestamp tracking |
| Dashboard real-time update | < 5 seconds from feedback submission to chart update | Supabase Realtime latency |

### 17.2 Scalability (Buildathon Scale)

The buildathon will have minimal users. These figures reflect testing-phase realities, not production ambitions.

| Component | Buildathon Scale | Scaling Mechanism |
|---|---|---|
| Frontend | ~50-100 MAU (team + testers + demo) | Vercel Hobby tier (auto-scaled) |
| Backend API | ~50 req/hour | Cloud Run auto-scaling (0-3 instances) |
| Database | ~10-20 MB | Supabase Free tier (500 MB) |
| SMS fan-out | 500/bill (capped) | `MAX_SMS_FAN_OUT` env var |
| AI pipeline | ~5-10 bills/month | Single Cloud Run instance |

### 17.3 Availability

| Component | Buildathon Target | Justification |
|---|---|---|
| Frontend (Vercel) | Best effort | Vercel Hobby tier; occasional downtime acceptable during development |
| Backend (Cloud Run) | Best effort | Free tier; cold starts acceptable for async pipeline services |
| Database (Supabase) | Best effort | Free tier has inactivity pausing risk (mitigated by keepalive ping every 6 hours) |
| Event pipeline | Best effort | Async — delays are acceptable; FastAPI BackgroundTasks executes tasks in background thread pool, with failsafe db logging on error |

### 17.4 Maintainability

- **Code structure**: Modular Python packages — `agents/`, `api/`, `services/`, `models/`, `utils/`.
- **API documentation**: Auto-generated OpenAPI/Swagger from FastAPI type annotations.
- **Logging**: Structured JSON logs via Cloud Logging. Every log entry includes `bill_id`, `agent_name`, `correlation_id` (traces a bill through the full pipeline).
- **Testing**: pytest for unit/integration; Playwright for E2E.

### 17.5 Data Retention & Compliance

| Data | Retention Period | Deletion Method | Legal Basis |
|---|---|---|---|
| Bill data (public) | Indefinite | N/A (public records) | Legitimate interest |
| Subscriber data | 12 months after inactivity | Automated monthly job deletes inactive subscribers | Consent (explicit opt-in) |
| Phone numbers (encrypted) | Deleted with subscriber record | Supabase Vault key deletion | Consent |
| Feedback | Indefinite (anonymized — no PII after phone hash) | N/A (cannot identify individual) | Legitimate interest |
| Audit logs | 24 months | Automated quarterly purge | Accountability under Kenya Data Protection Act 2019 |
| LLM usage logs | 6 months | Automated monthly purge | Operational monitoring |

### 17.6 Post-Buildathon Optimization Targets

Once the buildathon concludes and the product moves toward real users, the following tighter targets should be implemented. These are **not required during the buildathon** but serve as a roadmap for production hardening.

#### Performance (Production Targets)

| Metric | Production Target | How to Achieve |
|---|---|---|
| Bill list page load | < 2 seconds | Next.js ISR (Incremental Static Regeneration), CDN caching |
| Bill detail page load | < 2 seconds | Pre-rendered pages, Supabase edge caching |
| On-demand impact calculation | < 10 seconds | Pre-compute tier-level impacts during async pipeline; sync path becomes DB lookup |
| SMS delivery (end-to-end) | < 30 seconds | Batch sending optimization, AT priority routing |
| Full pipeline (bill ingested → alerts sent) | < 5 minutes | Parallel agent execution where possible, faster embedding model |
| Dashboard real-time update | < 2 seconds | Supabase Realtime + optimized subscription channels |

#### Scalability (Production Scale)

| Component | Production Scale | Scaling Mechanism |
|---|---|---|
| Frontend | ~5,000 MAU | Vercel Pro ($20/mo), CDN edge caching |
| Backend API | ~1,000 req/hour | Cloud Run auto-scaling (0-10 instances), min 1 always-on instance |
| Database | ~200 MB | Supabase Pro ($25/mo, 8 GB storage) |
| SMS fan-out | 5,000-10,000/bill | Raise `MAX_SMS_FAN_OUT` incrementally as user base grows |
| AI pipeline | ~50 bills/month | Parallel Cloud Run instances, response caching |

#### Availability (Production Targets)

| Component | Production Target | How to Achieve |
|---|---|---|
| Frontend (Vercel) | 99.9% | Upgrade to Vercel Pro SLA |
| Backend (Cloud Run) | 99.5% | Min 1 instance always-on, health checks, auto-restart |
| Database (Supabase) | 99.9% | Upgrade to Supabase Pro (no inactivity pausing) |
| Event pipeline | 99% | DLQ monitoring, automated retry, alerting |

#### Additional Production Optimizations

- **Per-subscriber financial impact**: Once user profiles are introduced (where users input their specific business details), run the Financial Impact Agent per subscriber instead of per tier. Requires budget increase for Gemini 3.5 Flash calls.
- **Response caching**: Cache tier-level impact results in Supabase so repeat requests for the same bill + tier are served from cache (sub-second).
- **CDN for static assets**: Serve bill PDFs and pre-rendered summaries from Vercel's edge CDN.
- **API rate limiting**: Implement stricter per-IP and per-user rate limits to prevent abuse at scale.
- **Cloud Run minimum instances**: Set min instances = 1 for the API service to eliminate cold start latency for user-facing requests.

---

*End of Architectural Design Document — Version 1.1*
