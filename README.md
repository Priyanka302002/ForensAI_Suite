# ForensicShield AI — Local Full-Stack Integration

ForensicShield AI connects a Next.js (App Router) interface with a Python (FastAPI) forensic parsing and sketch generation engine.

---

## Architecture Overview

```
┌───────────────────────────────────────────────┐
│              Next.js Frontend                 │
│          (http://localhost:3000)              │
│  - Case ID & Eyewitness Voice / Text Intake   │
│  - Biometric Facial Parameters Dashboard      │
│  - Live Portrait Preview & Coordinate Matrix  │
└───────────────────────┬───────────────────────┘
                        │
       fetch(`${NEXT_PUBLIC_API_URL}/api/...`)
                        │
┌───────────────────────▼───────────────────────┐
│               FastAPI Backend                 │
│         (http://127.0.0.1:8000)               │
│  - POST /api/parse-description (gpt-4o-mini)  │
│  - POST /api/render-sketch     (Stable Diff)  │
│  - POST /api/cases/save        (SQLAlchemy DB)│
│  - GET  /api/cases/{case_num}  (Case Ledger)  │
│  - GET  /api/cases             (List Cases)   │
│  - POST /api/intelligence/match (Cosine Sim)  │
│  - POST /api/cases/export-pdf  (ReportLab PDF)│
│  - GET  /api/health            (Status check) │
└───────────────────────────────────────────────┘
```

---

## Quickstart Guide

### 1. Start the FastAPI Backend
In a terminal, run:
```bash
# Activate virtual environment
./venv/Scripts/python.exe main.py
```
Or via uvicorn directly:
```bash
./venv/Scripts/uvicorn.exe main:app --host 127.0.0.1 --port 8000 --reload
```
The backend will be live at `http://127.0.0.1:8000`.

### 2. Start the Next.js Frontend
In a second terminal, run:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## Environment Variables

Both `.env` and `.env.local` are pre-configured:
- `NEXT_PUBLIC_API_URL`: Points to `http://127.0.0.1:8000`
- `STABLE_DIFFUSION_URL`: Points to local Stable Diffusion instance (defaults to `http://127.0.0` / `http://127.0.0.1:7860/sdapi/v1/txt2img`)
- `OPENAI_API_KEY`: Configured with your OpenAI API key (used for NLP description parsing)
- `DATABASE_URL`: Defaults to SQLite (`sqlite:///./forensic_shield.db`) or PostgreSQL

---

## Automated Verification Suite

To verify CORS, database persistence, biometric matching, PDF generation, and end-to-end round trips:
```bash
./venv/Scripts/python.exe test_api_cycle.py
```
All 11 test cycles test:
1. `GET /api/health` status & database connectivity
2. CORS preflight headers for `http://localhost:3000`
3. `POST /api/parse-description` structured biometric parsing
4. `POST /api/render-sketch` Stable Diffusion payload, prompt constraints & Data URI format
5. `POST /api/cases/save` relational database case persistence
6. `GET /api/cases/{case_number}` case retrieval with nested biometrics
7. Case update mutation via `POST /api/cases/save`
8. `POST /api/intelligence/match` Cosine Similarity analytical matrix
9. Wrapped payload compatibility for biometric vector matching
10. `POST /api/cases/export-pdf` court-ready Chain-of-Custody PDF binary streaming
11. `GET /api/cases/{case_number}/export-pdf` direct ledger file export
