# SurgiSense

> AI-powered surgical recovery platform — from discharge to full recovery, guided by intelligent agents.

SurgiSense digitises discharge summaries, generates personalised day-by-day recovery schedules, tracks medication adherence, monitors wound healing through computer vision, and surfaces real-time alerts when a patient falls behind — all through a multi-agent backend and a mobile-first React frontend.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend](#backend)
  - [API Routes](#api-routes)
  - [Agent System](#agent-system)
  - [Database Models](#database-models)
  - [Services](#services)
- [Frontend](#frontend)
  - [Pages](#pages)
  - [Components](#components)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│  Vite · React Router · Tailwind CSS · Framer Motion         │
│                                                             │
│  Landing → Login/Signup → IntakeOnboarding → Dashboard      │
│           ↕ Chat   ↕ Pharmacy   ↕ WoundAnalysis             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / REST (localhost:8000)
┌────────────────────────▼────────────────────────────────────┐
│                      FastAPI Backend                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Auth Routes │  │  Intake API  │  │    Main API      │  │
│  │  /auth/*     │  │  /api/intake │  │  /api/*          │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Agent System                        │   │
│  │  Agent Router → Medication Agent → Scheduler Agent  │   │
│  │               → Intake Agent    → NLP Agent         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  RAG Chat    │  │ Wound Vision │  │  Rules / Eval    │  │
│  │  FAISS +     │  │  Groq Vision │  │  rules_ai.py     │  │
│  │  SentenceT.  │  │  API         │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ SQLAlchemy ORM
┌────────────────────────▼────────────────────────────────────┐
│              PostgreSQL (Neon serverless)                    │
│  Users · PatientProfiles · RecoveryTasks · Medicines        │
│  DischargeSummaries · MedicationLogs · AdherenceLogs        │
│  IntakeRecords · AgentAlerts · MedicalRecords               │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy |
| Database | PostgreSQL (Neon serverless) |
| LLM | Groq API (`llama-3.3-70b-versatile`) |
| RAG | FAISS + `sentence-transformers` (MiniLM-L12-v2) |
| PDF parsing | PyMuPDF (`fitz`) |
| Auth | JWT (custom) + Google OAuth 2.0 |
| Background jobs | Python `threading` (scheduler agent) |
| Validation | Pydantic v2 |
| Price search | SerpAPI (Google Shopping) |
| Pharmacy lookup | OpenStreetMap Overpass API |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| HTTP client | Axios |
| Markdown | `react-markdown` |
| UI primitives | Custom shadcn-style components |

---

## Project Structure

```
SurgiSense/
├── backend/
│   ├── main.py                  # FastAPI app, all route definitions
│   ├── models.py                # SQLAlchemy ORM models
│   ├── database.py              # DB engine + session factory
│   ├── auth.py                  # JWT utilities
│   ├── auth_routes.py           # /auth/signup, /auth/login, /auth/logout
│   ├── google_auth.py           # Google OAuth flow
│   ├── dependencies.py          # get_current_user, get_db
│   ├── intake_routes.py         # /api/extract-intake, /api/submit-intake, etc.
│   ├── migrate_add_dates.py     # One-off migration: add task_date column
│   ├── seed_pharmacies.py       # Dev utility: seed pharmacy data
│   ├── utils/
│   │   └── pdf_reader.py        # PDF → plain text extraction helper
│   └── services/
│       ├── agent_router.py      # Unified event dispatcher (Phase 5)
│       ├── agent_nlp.py         # Natural language → agent intent classifier
│       ├── medication_agent.py  # Multi-step task completion pipeline
│       ├── scheduler.py         # Background overdue-task scanner + alerts
│       ├── intake_agent.py      # PDF extraction, ICD-10/CPT validation
│       ├── chat.py              # RAG chat service (FAISS + SentenceTransformers)
│       ├── record_digitization.py  # Discharge summary → structured JSON
│       ├── rules_ai.py          # Clinical vitals evaluation rules
│       ├── wound_analysis.py    # Wound image → severity assessment
│       └── speech_to_text.py   # Audio → transcript (Groq Whisper)
│
└── frontend/src/
    ├── main.jsx                 # React entry point
    ├── App.jsx                  # Root component
    ├── routes.js                # React Router route definitions
    ├── Vision.jsx               # Wound photo capture + upload component
    ├── Voice.jsx                # Voice input component
    ├── assets/
    │   └── surgisense-logo.jpeg # App logo
    ├── styles/
    │   ├── index.css
    │   ├── tailwind.css
    │   ├── theme.css
    │   └── fonts.css
    ├── pages/
    │   ├── Landing.jsx          # Public marketing page
    │   ├── Login.jsx            # Email/password login
    │   ├── Signup.jsx           # Account registration
    │   ├── OauthSuccess.jsx     # Google OAuth callback handler
    │   ├── IntakeOnboarding.jsx # Post-login intake form (new patient flow)
    │   ├── ProfileSetup.jsx     # Legacy profile setup page
    │   ├── Dashboard.jsx        # Main recovery dashboard (home)
    │   ├── Chat.jsx             # RAG-powered AI chat
    │   ├── Pharmacy.jsx         # Medication inventory + price finder
    │   ├── SurgeryReadiness.jsx # Pre-op readiness assessment
    │   └── WoundAnalysis.jsx    # Wound photo analysis page
    └── components/ui/
        ├── AgentChat.jsx        # Floating AI agent chat popup
        ├── AgentReportCard.jsx  # Historical agent action log
        ├── AdherenceCard.jsx    # 7-day adherence chart + stats
        ├── ReasoningChain.jsx   # Agent reasoning step visualiser
        ├── RecordDigitization.jsx  # Discharge summary upload UI
        ├── medication_selector.jsx # Post-upload medication selection modal
        └── [shadcn primitives]  # Button, Card, Progress, Dialog, etc.
```

---

## Backend

### API Routes

#### Auth — `/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Register with email + password |
| POST | `/auth/login` | Login, returns JWT token |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/google` | Initiate Google OAuth flow |
| GET | `/auth/google/callback` | Google OAuth callback |

#### Patient Profile — `/api`
| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Get current user's profile |
| POST | `/api/create-profile` | Create or update profile |

#### Intake Onboarding — `/api`
| Method | Path | Description |
|---|---|---|
| POST | `/api/extract-intake` | Extract structured data from uploaded PDF |
| POST | `/api/submit-intake` | Submit validated intake form, persist to DB |
| GET | `/api/intake-report` | Get latest intake report for current user |
| GET | `/api/my-intake` | Raw intake record for current user |
| PATCH | `/api/update-intake` | Update an existing intake record |
| GET | `/api/audit-trail/{record_id}` | Audit trail for a specific record |

#### Medical Records & Tasks — `/api`
| Method | Path | Description |
|---|---|---|
| POST | `/api/digitize-record` | Upload discharge PDF → extract + store + ingest into RAG |
| POST | `/api/scan` | Upload any medical document → full structured extraction + background task generation |
| GET | `/api/my-records` | List all stored medical records |
| GET | `/api/my-tasks?date=YYYY-MM-DD` | Fetch tasks for a given date (defaults to today) |
| POST | `/api/generate-tasks` | Generate single-day task schedule from document |
| POST | `/api/generate-daily-tasks` | Generate full multi-day schedule (pre-op to surgery date, or post-op 14-day window) |
| PATCH | `/api/task/{task_id}` | Mark a task as completed (legacy; prefer agent endpoint) |
| GET | `/api/overdue-tasks` | Return critical tasks overdue by 2+ hours (used by browser notifications) |
| GET | `/api/debug-tasks` | Debug: list all tasks with raw task_date values |

#### Medications & Inventory — `/api`
| Method | Path | Description |
|---|---|---|
| GET | `/api/my-medicines` | List all medicines from latest discharge summary |
| PATCH | `/api/medicines/{med_id}` | Update total quantity + dose amount |
| POST | `/api/inventory/deduct` | Atomically deduct one dose by medicine name (fuzzy match) |

#### AI Services — `/api`
| Method | Path | Description |
|---|---|---|
| POST | `/api/chat` | Ask a question against the RAG vector store |
| POST | `/api/analyze-wound` | Upload wound image → severity score + clinical assessment |
| POST | `/api/voice-to-text` | Upload audio → transcript via Groq Whisper |
| POST | `/api/evaluate` | Evaluate patient vitals against clinical readiness rules |

#### Agent System — `/api/agent`
| Method | Path | Description |
|---|---|---|
| POST | `/api/agent/complete-task` | Agentic task completion (verify → mark done → deduct doses → log adherence → alert → score) |
| POST | `/api/agent/event` | Unified event dispatcher (task_completed / inventory_changed / daily_summary / time_tick) |
| POST | `/api/agent/chat` | Natural language message → intent classification → agent action |
| GET | `/api/agent/alerts` | Fetch unread agent alerts |
| PATCH | `/api/agent/alerts/{id}/read` | Mark an alert as read |
| GET | `/api/agent/inventory-alerts` | Proactive inventory intelligence scan |
| GET | `/api/agent/adherence-stats?days=7` | Adherence analytics: overall %, per-med, streak, daily chart |

#### Pharmacy & Procurement — `/api`
| Method | Path | Description |
|---|---|---|
| GET | `/api/pharmacies/nearest?lat=&lng=` | Find nearest pharmacies via Overpass API (OpenStreetMap) |
| GET | `/api/pharmacy/search-prices?medicine=` | Live price comparison via SerpAPI Google Shopping |

---

### Agent System

The backend runs a five-phase agentic architecture:

**Phase 1 — Medication Agent** (`medication_agent.py`)
Multi-step pipeline triggered on task completion: verify → complete → atomically deduct doses → log adherence (on-time / late) → check inventory thresholds → compute today's adherence score → return structured summary.

**Phase 2 — Inventory Intelligence** (`medication_agent.py` · `check_inventory_alerts`)
Proactively scans all medicines, calculates days-until-empty based on dose frequency, and emits severity-classified alerts (critical / warning / ok).

**Phase 3 — Compliance Analytics** (`medication_agent.py` · `get_adherence_stats`)
Computes 7-day (or N-day) adherence reports: overall percentage, per-medication breakdown, current streak, most-skipped time slot, and daily chart data.

**Phase 4 — Scheduler Agent** (`scheduler.py`)
Background thread polling every 5 minutes. Scans all pending critical tasks, detects overdue items (30 min → warning, 2 hrs → critical), and writes `AgentAlert` rows to the database. Runs an end-of-day sweep at 23:55 to mark incomplete tasks as missed in `AdherenceLog`.

**Phase 5 — Agent Router + NLP** (`agent_router.py` · `agent_nlp.py`)
Unified event dispatcher that accepts any supported event type and routes it to the correct agent. The NLP layer accepts free-form user messages, classifies intent via LLM, executes the matching agent tool, and returns a conversational response with the full reasoning chain.

---

### Database Models

| Model | Key Fields | Purpose |
|---|---|---|
| `User` | id, email, hashed_password | Auth identity |
| `PatientProfile` | user_id, patient_name, surgery_type, surgery_date, recovery_days_total | Patient metadata shown in navbar |
| `MedicalRecord` | user_id, content (JSON) | Raw extracted records from uploaded documents |
| `DischargeSummary` | user_id, surgery_type, surgery_date, surgery_phase, vitals, icd10_code, cpt_code | Structured discharge data with clinical codes |
| `Medicine` | user_id, summary_id, name, dosage, frequency, total_quantity, current_quantity, dose_amount | Per-medication inventory tracker |
| `RecoveryTask` | user_id, title, time, status, task_date, is_critical | Daily scheduled tasks; is_critical flags medication/wound/vitals |
| `IntakeRecord` | user_id, raw JSON fields, audit_log | Pre-op intake form submissions with full audit trail |
| `MedicationLog` | medicine_id, user_id, action, quantity_change, remaining, timestamp | Immutable inventory transaction log |
| `AdherenceLog` | user_id, task_id, medicine_id, status (on_time/late/missed), logged_at | Adherence events for compliance analytics |
| `AgentAlert` | user_id, alert_type, message, data_json, is_read, created_at | Persistent agent-generated alerts (overdue, low-stock) |

---

### Services

| File | Responsibility |
|---|---|
| `chat.py` | RAG service — chunks + embeds document text into an in-memory FAISS index using `paraphrase-multilingual-MiniLM-L12-v2`; answers questions with top-3 retrieved chunks as context |
| `wound_analysis.py` | Sends wound images to Groq Vision API; returns a markdown clinical assessment with a 1–10 severity score |
| `speech_to_text.py` | Transcribes audio via Groq Whisper |
| `record_digitization.py` | Extracts structured JSON from discharge PDFs using an LLM prompt |
| `rules_ai.py` | Rule-based + AI vitals evaluation for surgery readiness scoring |
| `intake_agent.py` | PDF → intake form extraction, ICD-10/CPT validation, prior-auth simulation, auditable reasoning log |
| `utils/pdf_reader.py` | PyMuPDF wrapper for clean text extraction from PDFs |

---

## Frontend

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | `Landing.jsx` | Public marketing page with feature highlights |
| `/login` | `Login.jsx` | Email/password login with Google OAuth option |
| `/signup` | `Signup.jsx` | Account registration |
| `/oauth-success` | `OauthSuccess.jsx` | Handles Google OAuth token exchange and redirect |
| `/intake` | `IntakeOnboarding.jsx` | Multi-step intake form for new users (replaces /setup-profile for new sessions) |
| `/setup-profile` | `ProfileSetup.jsx` | Legacy profile setup (kept for backwards compatibility) |
| `/dashboard` | `Dashboard.jsx` | Main hub: adherence card, date-navigable task list, discharge summary, wound analysis, medications, agent alerts bell, floating agent chat |
| `/chat` | `Chat.jsx` | Full-page RAG-powered AI chat with voice input |
| `/pharmacy` | `Pharmacy.jsx` | Medication inventory management, pill counter, nearest pharmacies, live price comparison |
| `/surgery-readiness` | `SurgeryReadiness.jsx` | Pre-op vitals entry + AI readiness assessment |
| `/wound-analysis` | `WoundAnalysis.jsx` | Dedicated wound photo upload + analysis page |

### Components

| Component | Description |
|---|---|
| `AgentChat.jsx` | Floating chat popup (Bot FAB button) for natural language agent interaction with reasoning chain display |
| `AgentReportCard.jsx` | Scrollable log of historical agent actions (task completions, deductions, alerts) |
| `AdherenceCard.jsx` | 7-day adherence ring chart, tasks-done count, per-medication bars, most-missed slot insight |
| `ReasoningChain.jsx` | Step-by-step visualiser of the agent's decision chain returned from `/api/agent/complete-task` |
| `RecordDigitization.jsx` | Standalone discharge summary upload widget used in `/record-digitization` route |
| `medication_selector.jsx` | Modal popup shown after discharge upload — lets user confirm which medications to track |
| `Vision.jsx` | Wound photo capture (camera or file upload) and analysis trigger |
| `Voice.jsx` | Microphone recording + transcription via `/api/voice-to-text` |

---

## Getting Started

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-jose \
            groq faiss-cpu sentence-transformers pymupdf python-dotenv \
            pydantic requests starlette

# Create .env (see Environment Variables below)
cp .env.example .env

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # starts at http://localhost:5173
```

---

## Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# LLM
GROQ_API_KEY=your_groq_api_key

# Auth
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:5173

# Procurement agent (optional)
SERP_API_KEY=your_serpapi_key
```
