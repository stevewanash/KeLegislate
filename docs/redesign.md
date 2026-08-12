# KeLegislate — Architectural Redesign Guide (v1.3 Alignment)

This document details the architectural and implementation plan shifts required to transition the KeLegislate codebase from **personalized business profile impact calculations** to **pre-generated example scenarios, compliance checklists, and client-side interactive calculators**.

---

## 1. Context and Rationale

The original architecture relied on on-demand AI reasoning where users logged in, created custom business profiles (stored with application-level encryption), and queried the Financial Impact Agent synchronously. Stakeholder feedback and technical constraints identified several issues:

1. **UX Latency**: Live AI reasoning + calculation verification took up to 30 seconds, risking HTTP timeouts on Vercel edge networks (10-second limit).
2. **Data Minimization (GDPR/KDPA)**: Collecting and persisting business metrics (revenues, overheads, values) introduced heavy compliance overhead under the Kenya Data Protection Act (KDPA) 2019.
3. **Engagement Friction**: Requiring users to create complex profiles and log in just to see basic financial impacts severely reduced first-time user engagement.

### The Solution:
* **Pre-generated Example Scenarios**: During the ingestion pipeline, the Financial Impact Agent generates a worked example for a **hypothetical person** (a typical boda boda rider, salon owner, etc.) using predefined hustle profiles.
* **Client-Side Deterministic Calculator**: If a user wants custom figures, they can input their details into a lightweight, session-only interactive calculator on the frontend. The calculator uses a formula pre-loaded from the database — **no server calls, no database persistence, and no data leaves the browser**.
* **Compliance Checklist Guides**: For regulatory bills, the system generates a clear compliance guidance checklist detailing deadlines and action items.
* **Simplified Auth Scope**: Phone OTP auth is scoped exclusively to feedback submission (to ensure one-person-one-vote integrity). Custom profiles and login pages are deferred to post-buildathon.

---

## 2. Key Architectural Shifts

```mermaid
graph TD
    subgraph Old Architecture (Personalized Profiles)
        A1[User Logs In] --> B1[Create Custom Business Profile]
        B1 --> C1[Store Encrypted Profile in DB]
        C1 --> D1[POST /api/impact]
        D1 --> E1[Synchronous AI Run 15-30s]
        E1 --> F1[Display Ephemeral Impact Result]
    end
    
    subgraph New Architecture (Example Scenarios & Client Calc)
        A2[User Navigates to /impact] --> B2[Select Bill from List]
        B2 --> C2[GET /api/impact/:id]
        C2 --> D2[Instant DB Lookup <200ms]
        D2 --> E2[Display Pre-generated Scenario & Checklist]
        E2 --> F2[Interactive Client-Side Calculator]
        F2 -->|Optional & Session-Only| G2[User Inputs Custom Figures]
    end
```

### 2.1 Route & View Changes
* **Old Routes**:
  - `/bills/[id]/impact` (nested page)
  - `/account` or `/profile` (profile creation page)
* **New Routes**:
  - `/impact` — Top-level list view of bills with a **dropdown filter** for *All*, *Financial*, or *Regulatory* bills.
  - `/impact/[id]` — Dedicated impact page containing the concise summary, original PDF link, feedback form, and:
    - **For Financial Bills**: The pre-generated Example Scenario (persona, figures, math breakdown) and the Interactive Calculator.
    - **For Regulatory Bills**: The pre-generated Compliance Checklist.

### 2.2 API Endpoint Transitions

| Method | Old Endpoint | New Endpoint | Payload / Response | Change Description |
|---|---|---|---|---|
| `POST` | `/api/impact` | — | *Removed* | On-demand live AI impact reasoning is removed. |
| `GET` | — | `/api/impact/{bill_id}` | `{concise_summary, example_scenario?, compliance_checklist?, calculator_formula?, risk_level, sources, pdf_url}` | Retrieves the pre-generated scenario/checklist directly from cache. |
| `POST` | `/api/profile` | — | *Deferred* | User profile creation is deferred post-buildathon. |
| `GET` | `/api/profile` | — | *Deferred* | User profile retrieval is deferred post-buildathon. |
| `DELETE`| `/api/profile` | — | *Deferred* | User profile deletion is deferred post-buildathon. |

---

## 3. Database Modifications

The core schema changes required in `supabase/migrations/20260727000000_init.sql` (or subsequent migrations):

1. **Defer Table**: Do not implement the `user_profiles` table. Keep its schema definition in architectural design docs but tag it as deferred.
2. **Expand `tier_impact_cache`**:
   - The table originally cached calculations strictly per-tier. It is now expanded to store bill-wide Example Scenarios and Compliance Guides.
   - For bill-wide content, set `industry = 'ALL'` and `tier_label = 'ALL'`.
   - Update `impact_data` JSONB payload format:
     - **Financial Bills**:
       ```json
       {
         "scenario_persona": {
           "name": "Mama Njeri",
           "description": "A transport micro-enterprise owner with 1 matatu...",
           "metrics": {"vehicle_value": 800000}
         },
         "concise_summary": "Introduces a 2.5% motor vehicle tax...",
         "key_figures": ["2.5% Tax rate", "KES 5,000 Minimum", "KES 100,000 Maximum"],
         "math_breakdown": [
           "Annual Cost = KES 800,000 * 2.5% = KES 20,000",
           "Monthly Cost = KES 20,000 / 12 = KES 1,667"
         ],
         "calculator_formula": "min(max(vehicle_value * 0.025, 5000), 100000)",
         "sources": ["Section 4(2)(a)", "Clause 12"],
         "risk_level": "MEDIUM"
       }
       ```
     - **Regulatory Bills**:
       ```json
       {
         "concise_summary": "Mandates digital permit registration for boda boda operators.",
         "regulatory_changes": ["Mandatory county permit", "NTSA registration linkage"],
         "compliance_checklist": [
           {
             "action": "Register digital profile with County Transport Board",
             "deadline": "Within 90 days of gazettement",
             "source": "Section 3(1)"
           },
           {
             "action": "Pay annual county permit fee of KES 3,000",
             "deadline": "January 1st annually",
             "source": "Section 5(2)"
           }
         ],
         "sources": ["Section 3", "Section 5"],
         "risk_level": "HIGH"
       }
       ```

---

## 4. Codebase Refactoring Steps

### Phase 1: Foundation (Backend & DB Setup)
* **Action**: Do not write migration rules for `user_profiles`. Remove `api/profile.py` from the routing scaffolding.
* **Action**: Ensure the seed scripts handle insertion of both financial and regulatory test bills (`Finance Bill 2024` and `Boda Boda Permit Regulations 2025`).

### Phase 2: Core Pipeline (AI Ingestion)
* **Action**: Update `backend/app/agents/impact_agent.py`. The agent now accepts the bill summary, regex extractions, and the representative predefined hustle profile. It should be prompted to select the most appropriate predefined profile for the bill (e.g., boda boda rider for motorcycle regulations, matatu operator for vehicle value taxes) and return a structured Pydantic object matching `ExampleScenario` or `ComplianceGuide`.
* **Action**: Ensure the Financial Impact Agent outputs a string-based python-like expression in `calculator_formula` (e.g., `vehicle_value * 0.025`) using AST-supported operators for the frontend calculator.
* **Action**: Update the router `backend/app/api/impact.py` to support `GET /api/impact/{bill_id}` fetching from the cache table.

### Phase 3: Web App (Frontend Structure)
* **Action**: Delete `/frontend/src/app/bills/[id]/impact/` directory.
* **Action**: Create `/frontend/src/app/impact/page.js` (list page with filtering dropdown).
* **Action**: Create `/frontend/src/app/impact/[id]/page.js` (detail page).
* **Action**: Add "Impact" to the main header navigation menu. Remove login navigation links; redirect login actions only when a guest submits the `FeedbackForm`.
### Phase 5: Pipeline Automation
* **Action**: Update the asynchronous pipeline worker `BackgroundTasks` in `backend/app/services/orchestrator.py` to trigger the Financial Impact Agent on ingest to generate the example scenario/checklist and store it in `tier_impact_cache` under the `'ALL'` tier key.
