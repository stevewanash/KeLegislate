# KeLegislate Implementation Log
## Phase 1

### Step 1.1 — Supabase Project Setup
#### What Was Done
- **Manual Setup:** Initialized the Supabase project on the free tier.
- **pgvector Extension:** Enabled the `pgvector` extension under the extensions schema (stored as `extensions.vector`).
- **Secrets Retrieval:** Recorded the project database URL, anon key, and service role key for configuration.

### Step 1.2 — Database Schema (Core Tables Only)
#### What Was Done
- **SQL Migration Script:** Created [20260727000000_init.sql](file:///c:/git/KeLegislate/supabase/migrations/20260727000000_init.sql) to define the core database schema.
- **Created Tables:** Defined 7 tables: `bills`, `bill_tags`, `subscribers`, `feedback`, `user_profiles`, `notifications`, `tier_impact_cache`.
- **Triggers & Indexes:** Added `updated_at` auto-update triggers on dynamic tables and indexed critical search paths.
- **Verification:** Applied the SQL migration to the Supabase instance, establishing all tables successfully.
- **Table Corrections:** Cleaned up default schema constructs by removing all redundant `NULLABLE` keywords (omitting `NOT NULL` suffices in PostgreSQL) and removing the `parliament_status` field from the `bills` table as there was no data source for this information.
#### Key Technical Details
- **Explicit Foreign Keys:** Explicitly linked user-facing tables (`subscribers`, `feedback`, `user_profiles`) to Supabase Auth (`auth.users(id)`) with cascading delete rules (`ON DELETE CASCADE` and `ON DELETE SET NULL`) to preserve referential database integrity.
- **Nullable Columns:** Omitted `NOT NULL` constraints where PostgreSQL defaults to nullable columns.
- **Performance Indexing:** Configured custom indexes like GIN index on `subscribers.industry_tags` and partial index on `subscribers.is_active` to handle optimized message delivery loops.

### Step 1.3 — FastAPI Backend Scaffold
#### What Was Done
- **Directory Scaffolding:** Constructed `backend/app/` package directories for APIs, agents, services, models, and utils.
- **Dependencies Setup:** Configured [requirements.txt](file:///c:/git/KeLegislate/backend/requirements.txt) with libraries like `fastapi`, `supabase`, `pydantic-settings`, and `pdfplumber`.
- **Docker Integration:** Compiled [Dockerfile](file:///c:/git/KeLegislate/backend/Dockerfile) targeting Google Cloud Run.
- **Configurations:** Configured settings parser in [config.py](file:///c:/git/KeLegislate/backend/app/config.py) and initialized the Supabase Client in [database.py](file:///c:/git/KeLegislate/backend/app/database.py).
- **APIs & Models:** Designed contract-conforming Pydantic schemas in [schemas.py](file:///c:/git/KeLegislate/backend/app/models/schemas.py) and routed health check `/health` and 501 stubs in [main.py](file:///c:/git/KeLegislate/backend/app/main.py).
#### Key Technical Details
- **Settings Fallback:** If environment variables are missing during docker builds or initialization, `config.py` falls back to predefined safe mocks to prevent container runtime crashes.
- **Modular Routers:** Segmented routes under `/api/` matching all public and authenticated routes.

### Step 1.4 — Next.js Frontend Scaffold
#### What Was Done
- **Directory Scaffolding:** Initialized a Next.js App Router workspace under `frontend/`.
- **Theme Definition:** Crafted [globals.css](file:///c:/git/KeLegislate/frontend/src/styles/globals.css) containing variables for a custom dark theme, premium font declarations, and responsive spacing.
- **Responsive Layout:** Developed [layout.js](file:///c:/git/KeLegislate/frontend/src/app/layout.js) including responsive desktop side-nav and mobile bottom-nav layouts.
- **Placeholder Views:** Added interactive placeholder layouts for landing, bill listings, detail page (with Swahili/English toggle), dashboard sentiment charts, subscribe form, and business profile form.
- **Client Wrappers:** Configured [api.js](file:///c:/git/KeLegislate/frontend/src/lib/api.js) and [supabase.js](file:///c:/git/KeLegislate/frontend/src/lib/supabase.js) browser-facing clients.
#### Key Technical Details
- **Glassmorphism Styling:** Leveraged backdrop filters and custom borders to establish a premium application feel.
- **Client-Bypass Router:** Configured Next.js fetch layer to hit the FastAPI backend base URL directly, bypassing Vercel Hobby serverless timeouts.

### Step 1.5 — Port Reusable Prototype Code
#### What Was Done
- **Prototype Porting:** Relocated raw scripts from prototype into FastAPI-friendly backend services and modules.
- **Hustle Profiles:** Ported [hustle_profiles.py](file:///c:/git/KeLegislate/backend/app/models/hustle_profiles.py) to map illustrative operational baselines without Streamlit.
- **Phone Utility:** Relocated logic to [phone.py](file:///c:/git/KeLegislate/backend/app/utils/phone.py) to normalize numbers to E.164.
- **PDF Extractor:** Moved extraction/OCR routines to [extractor.py](file:///c:/git/KeLegislate/backend/app/services/extractor.py).
- **Parliament Scraper:** Ported beautifulsoup scanner to [scraper.py](file:///c:/git/KeLegislate/backend/app/services/scraper.py).
#### Key Technical Details
- **Tesseract Fallback Path:** Configured `extractor.py` to auto-discover standard Windows installation paths for Tesseract, falling back to system-wide paths on Linux environments.

### Step 1.6 — Local Development Environment
#### What Was Done
- **Global Configuration:** Created root [.env.example](file:///c:/git/KeLegislate/.env.example) linking credentials.
- **Setup Manual:** Documented workspace launching, dependency installation, and local ports in [environment-setup.md](file:///c:/git/KeLegislate/docs/environment-setup.md).
#### Key Technical Details
- **Config Separation:** Highlighted credentials split, explaining that front-end relies on `NEXT_PUBLIC_` prefixes while backend utilizes direct variables.
#### Maintenance & Next Developer Guide
- **Phase 1 Complete:** The foundation is fully established. All code scaffold templates are ready to accept logic injection starting with Phase 2.


## Phase 2

### Step 2.2 — Regex Value Extraction

#### What Was Done
- **New Code Utility:** Implemented [regex_extractor.py](file:///c:/git/KeLegislate/backend/app/utils/regex_extractor.py) to parse percentages, monetary amounts, and dates from legislative text.
- **New Unit Tests:** Created [test_regex_extractor.py](file:///c:/git/KeLegislate/backend/tests/test_regex_extractor.py) to cover various date formats, currency styles, percentage representations (both digit-based and word-based), and check for correct context length boundaries.
- **New Pipeline Runner:** Added [run_regex_extraction.py](file:///c:/git/KeLegislate/backend/scripts/run_regex_extraction.py) to retrieve ingested bills, perform value extraction, store results in JSONB format, and update the bill state.
- **Supabase configuration:**
  - Configured and exported `supabase_admin` (service role client) in [database.py](file:///c:/git/KeLegislate/backend/app/database.py) to bypass RLS policies during admin/seeding scripts.
  - Granted privileges on table `public.bills` to `service_role` and other database roles via Supabase SQL commands.
- **Pipeline Seeding & Running:** Successfully ran `seed_bill.py` to ingest "The Motor Vehicle Circulation Tax Bill, 2026", and executed `run_regex_extraction.py` to populate its `regex_extractions` column.
- **Code Review & Refinements:** Address code review recommendations:
  - Extended the percentage parser and regex patterns to support compound written forms (e.g. `"twenty-five percent"`, `"thirty five per cent"`).
  - Documented date parsing assumptions regarding the common Kenyan `DD-MM-YYYY` format.
  - Added new edge case tests covering empty inputs, zero matches, and overlapping dates.

#### Key Technical Details
- **Value Normalization:** Match results are normalized where possible to simplify downstream comparison:
  - Percentages are converted to float representation (e.g. `"twenty-five percent"`, `"two point five per cent"` and `"2.5%"` both parse to float `25.0`, `2.5`, and `2.5` respectively).
  - Monetary values are stripped of commas and parsed with suffix multipliers (e.g. `"10 million shillings"` parses to `10000000.0`).
  - Dates are parsed from Day-Month-Year or Month-Day-Year and converted to ISO standard `YYYY-MM-DD` strings.
- **Compound Written Numbers:** A helper function `parse_word_number` was added to handle written tens + units combinations (e.g., `"twenty-five"` splits into `"twenty"` and `"five"`, looks them up in a dictionary, and sums them to `25`).
- **Date Order Assumption:** The parser assumes a default `DD-MM-YYYY` format for slash/dash numeric dates (e.g. `03/04/2026` is parsed as April 3, 2026), since this format is standard in Kenya. Word-based date formats are unambiguous and preferred.
- **Context Boundaries:** We extract ±200 characters of surrounding context around matches. The boundary computation uses standard bounds clamping (`max(0, start - 200)` and `min(len(text), end + 200)`) to avoid slice indices going out of bounds.
- **Regex Boundary Fix:** Used word boundary `\b` carefully inside regex groupings rather than as a global suffix. For example, `%` is a non-word character and will not match a trailing `\b`, so boundary markers are placed selectively on word characters (e.g. `percent\b` or `cent\b`).

#### Maintenance & Next Developer Guide
- **Current Database Status:** The bill table's RLS policy is bypassed by using `supabase_admin` in backend/scripts. Do not import `supabase` (the anon client) in administrative scripts, as database calls will fail due to lack of write privileges under RLS.
- **Pipeline Continuation:**
  - The seeded test bill has ID `1d1ad81b-650e-49e2-af45-b07040ec8acd` and state `extracted`.
  - The next step (**Step 2.3 — Gemini Client Setup**) should configure the generative AI SDK and initialize a wrapper client for calling Gemini models to consume the `extracted_text` and `regex_extractions`.
