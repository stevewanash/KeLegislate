# Local Development Environment Setup Guide

Follow this guide to set up and run the KeLegislate platform locally.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:
- **Python 3.11** or higher
- **Node.js v18** or higher
- **Tesseract OCR** (for PDF image extraction fallback)
  - **Windows**: [Tesseract Installer](https://github.com/UB-Mannheim/tesseract/wiki). Note the installation path (usually `C:\Program Files\Tesseract-OCR\tesseract.exe`).
  - **macOS**: Run `brew install tesseract`
  - **Linux**: Run `sudo apt-get install tesseract-ocr tesseract-ocr-eng`

---

## 2. Supabase Setup

1. Create a project on the [Supabase Dashboard](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard and run the script contents located in:
   `supabase/migrations/20260727000000_init.sql`
3. Retrieve your project settings under **Project Settings -> API**:
   - `Project URL`
   - `API Key (anon)`
   - `Service Role Key (service_role)`
4. Retrieve your database connection string under **Project Settings -> Database**.

---

## 3. Environment Variables Configuration

Copy `.env.example` at the repository root to create:
1. `backend/.env` (FastAPI backend environment variables)
2. `frontend/.env.local` (Next.js frontend environment variables)

Fill in the credentials you recorded during the Supabase setup:
- Set `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- Set `SUPABASE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Set `SUPABASE_SERVICE_KEY`
- Set `SUPABASE_DB_URL`
- Set `GEMINI_API_KEY` (obtained from [Google AI Studio](https://aistudio.google.com))
- Set `AFRICAS_TALKING_API_KEY` (from [Africa's Talking Console](https://account.africastalking.com))
- Set `ENCRYPTION_KEY` to a random 32-byte Base64-encoded string (for encrypting business profile data).

---

## 4. Backend Setup

1. Navigate to the `backend/` directory.
2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```
3. Activate the virtual environment:
   - **Windows (cmd/powershell)**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - **macOS/Linux**:
     ```bash
     source .venv/bin/activate
     ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
6. Verify it works by opening [http://localhost:8000/health](http://localhost:8000/health) in your browser. You should receive `{"status": "ok"}`.

---

## 5. Frontend Setup

1. Navigate to the `frontend/` directory.
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Verify by opening [http://localhost:3000](http://localhost:3000) in your browser. You should see the KeLegislate landing page.
