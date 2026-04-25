<div align="center">

# 🛡️ MedGuard AI

### AI-Powered Medical Billing Auditor & Insurance Appeal Engine for India

**Built for the Indian healthcare system. Designed to fight back.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![LLM](https://img.shields.io/badge/LLM-Groq%20%7C%20LLaMA3-orange?style=flat-square)](https://groq.com/)

---

*Developed by **Viraj Jadhao** & **Bhumi Sirvi** — Team Neural Nomads*

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [Core Features](#-core-features)
- [System Architecture](#-system-architecture)
- [The 5-Agent AdvocAI Pipeline](#-the-5-agent-advocai-pipeline)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start (Windows — Recommended)](#quick-start-windows--recommended)
  - [Manual Setup](#manual-setup)
  - [Docker Compose Setup](#docker-compose-setup)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Frontend Pages](#-frontend-pages)
- [How the AI Works](#-how-the-ai-works)
- [Known Issues & Fixes](#-known-issues--fixes)
- [Roadmap](#-roadmap)
- [Contributors](#-contributors)

---

## 🔍 Overview

**MedGuard AI** is a full-stack, AI-powered platform that solves two critical problems in the Indian healthcare system:

1. **Bill Auditing (ClaimShield Layer):** Automatically extracts line items from hospital bills (PDF or image) using OCR, cross-references each item against official **CGHS (Central Government Health Scheme)** rate benchmarks, and flags overcharges with a confidence score.

2. **Insurance Denial Appeals (AdvocAI Engine):** When a patient's insurance claim is denied, MedGuard's 5-agent autonomous AI pipeline reads the denial letter and policy document, researches clinical evidence and IRDAI regulations, and generates a legally-sound, formal appeal letter — ready to send.

The entire flow — from uploading a bill to downloading a finished appeal — can happen in under 2 minutes, without needing a lawyer or a billing expert.

---

## 🚨 The Problem

India's healthcare billing system is notoriously opaque:

- Hospitals routinely charge **2–5x** the CGHS benchmark rates for routine procedures
- Insurance companies deny claims using boilerplate reasoning that patients don't understand
- Drafting an appeal letter requires knowledge of IRDAI regulations, medical terminology, and legal language — skills most patients simply don't have
- There is no automated, affordable tool that does all of this end-to-end for the Indian healthcare context

MedGuard AI directly addresses all three of these problems.

---

## ✨ Core Features

### 🏥 ClaimShield — Bill Auditing Layer
- **OCR-powered document parsing** using PyMuPDF (PDFs) and EasyOCR (images/photos of bills)
- **CGHS rate lookup** for common procedures: blood tests, consultations, room rent, X-rays, ECG, MRI, CT scans, and more
- **Anomaly detection** that calculates deviation percentage and assigns a confidence score (70–95%) per line item
- **Savings estimate** across the entire bill in a single scan
- Supports **.pdf, .png, .jpg, .jpeg** inputs up to 10MB

### ⚖️ AdvocAI — Insurance Appeal Engine
- **5-agent autonomous pipeline** (Auditor → Clinician → Regulatory → Barrister → Judge)
- **Real-time Server-Sent Events (SSE)** streaming — watch the agents work live in the browser
- **Local RAG (Retrieval-Augmented Generation)** using Sentence Transformers and a vector store of IRDAI circulars and CGHS guidelines
- **PDF packet download** of the finalized appeal letter
- **Appeal quality scoring** by the Judge agent (0–100)
- Session management with PostgreSQL persistence or JSON fallback
- JWT-based **authentication** for user accounts and case history

### 🌐 Frontend
- Drag-and-drop bill upload on the home page
- Guided 4-step appeal submission wizard
- Live agent pipeline status with animated progress indicators
- Streaming appeal draft rendered in real time
- Fully responsive, glass-morphism dark UI

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MedGuard AI Platform                          │
│                                                                       │
│   ┌───────────────────┐          ┌──────────────────────────────┐   │
│   │   Next.js 15      │  HTTP /  │      FastAPI Backend          │   │
│   │   Frontend        │◄────────►│      (main.py — v2.0.0)      │   │
│   │   (port 3000)     │   SSE    │      (port 8000)             │   │
│   └───────────────────┘          └──────────┬───────────────────┘   │
│                                             │                        │
│                              ┌──────────────┴───────────────┐        │
│                              │                              │        │
│                   ┌──────────▼──────┐          ┌───────────▼──────┐ │
│                   │  ClaimShield    │          │  AdvocAI Engine  │ │
│                   │  (Bill Audit)   │          │  (5-Agent Flow)  │ │
│                   │                 │          │                  │ │
│                   │  ocr_parser     │          │  auditor.py      │ │
│                   │  anomaly_       │          │  clinician.py    │ │
│                   │  detector       │          │  regulatory.py   │ │
│                   │  cghs_checker   │          │  barrister.py    │ │
│                   └─────────────────┘          │  judge.py        │ │
│                                                └───────┬──────────┘ │
│                                                        │             │
│                              ┌─────────────────────────▼──────────┐ │
│                              │          Infrastructure             │ │
│                              │                                    │ │
│                              │  PostgreSQL + pgvector (DB)        │ │
│                              │  Sentence Transformers (RAG)       │ │
│                              │  Groq API / LLaMA3-70B (LLM)      │ │
│                              │  EasyOCR + PyMuPDF (OCR)          │ │
│                              │  ReportLab (PDF Generation)        │ │
│                              └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

The backend is a **single unified FastAPI application** that serves both the ClaimShield bill-auditing routes and the full AdvocAI multi-agent pipeline. The AdvocAI sub-application is mounted as a sub-app and also re-registered on the main router for clean frontend access.

---

## 🤖 The 5-Agent AdvocAI Pipeline

When a user submits a denial case, the following agents execute sequentially. Their progress streams live to the frontend via SSE.

```
  Upload Denial Letter + Policy PDF
              │
              ▼
  ┌───────────────────────┐
  │  1. 🔍 Auditor Agent  │
  │  Parses both documents│
  │  Extracts denial      │
  │  reason, amounts,     │
  │  policy clauses cited │
  └──────────┬────────────┘
             │
             ▼
  ┌───────────────────────┐
  │  2. 🩺 Clinician Agent│
  │  Retrieves clinical   │
  │  evidence justifying  │
  │  medical necessity    │
  │  (PubMed optional)    │
  └──────────┬────────────┘
             │
             ▼
  ┌───────────────────────┐
  │  3. ⚖️ Regulatory     │
  │     Agent             │
  │  Searches local RAG   │
  │  vector store for     │
  │  IRDAI circulars and  │
  │  CGHS guidelines that │
  │  support the claim    │
  └──────────┬────────────┘
             │
             ▼
  ┌───────────────────────┐
  │  4. 📜 Barrister Agent│
  │  Drafts the formal    │
  │  appeal letter using  │
  │  clinical + legal     │
  │  findings. Streams    │
  │  output token-by-token│
  └──────────┬────────────┘
             │
             ▼
  ┌───────────────────────┐
  │  5. 🏛️ Judge Agent    │
  │  QA-scores the draft  │
  │  (0–100). Polishes    │
  │  tone and formatting. │
  │  Finalizes the letter.│
  └──────────┬────────────┘
             │
             ▼
  📄 Downloadable PDF Appeal Packet
```

Each agent is powered by **LLaMA3-70B via the Groq API**. The Regulatory Agent uses a local **Sentence Transformer (all-MiniLM-L6-v2)** to embed and query a curated knowledge base of IRDAI circulars, ensuring regulatory citations are grounded in real documents — not hallucinated.

---

## 🛠️ Tech Stack

### Backend
| Component | Technology |
|---|---|
| Web Framework | FastAPI 0.115+ |
| ASGI Server | Uvicorn |
| LLM Provider | Groq API (LLaMA3-70B / LLaMA3-8B) |
| OCR — PDFs | PyMuPDF (fitz) |
| OCR — Images | EasyOCR |
| Embeddings / RAG | Sentence Transformers (`all-MiniLM-L6-v2`) |
| PDF Generation | ReportLab |
| Database | PostgreSQL 16 + pgvector |
| Auth | JWT (PyJWT) + bcrypt |
| Data Validation | Pydantic v2 |

### Frontend
| Component | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion 12 |
| Icons | Lucide React |
| Real-time | Server-Sent Events (EventSource API) |

### Infrastructure
| Component | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| Database Image | `pgvector/pgvector:pg16` |
| Local AI Fallback | Ollama (Mistral) |

---

## 📁 Project Structure

```
MedGuard-AI/
│
├── backend/                        # FastAPI backend
│   ├── main.py                     # 🚀 Unified entry point — mounts both apps
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Backend container
│   │
│   ├── agents/                     # ClaimShield agent orchestrator
│   │   └── orchestrator.py         # Runs the 5-step bill appeal pipeline
│   │
│   ├── services/                   # ClaimShield core services
│   │   ├── ocr_parser.py           # PyMuPDF + EasyOCR document parser
│   │   ├── anomaly_detector.py     # Overcharge detection + confidence scoring
│   │   ├── cghs_checker.py         # CGHS rate lookup (keyword fuzzy match)
│   │   └── vector_store.py         # Sentence Transformer RAG store
│   │
│   ├── db/                         # Database utilities
│   │   └── vector_store.py         # Mock/local vector store for IRDAI docs
│   │
│   └── advocai/                    # AdvocAI multi-agent sub-application
│       ├── agents/                 # Individual agent modules
│       │   ├── auditor.py          # Document parsing agent
│       │   ├── clinician.py        # Medical necessity agent
│       │   ├── regulatory.py       # IRDAI/CGHS legal research agent
│       │   ├── barrister.py        # Appeal letter drafting agent (streams)
│       │   └── judge.py            # QA scoring + finalization agent
│       │
│       ├── orchestrator/           # AdvocAI FastAPI sub-app
│       │   ├── app.py              # Route definitions + SSE streaming
│       │   ├── main.py             # Pipeline orchestration logic
│       │   └── auth/               # JWT auth router + DB helpers
│       │
│       ├── tools/                  # Shared utility tools
│       │   ├── document_reader.py  # PDF/image reading utilities
│       │   ├── io_utils.py         # File I/O helpers
│       │   ├── pdf_compiler.py     # ReportLab PDF assembly
│       │   └── pubmed_search.py    # Optional PubMed clinical evidence fetch
│       │
│       ├── storage/                # Persistence layer
│       │   ├── session_manager.py  # Session CRUD (JSON or Postgres)
│       │   ├── json/               # JSON file-based session storage
│       │   └── postgres/           # PostgreSQL schema + queries
│       │
│       ├── config/                 # Configuration loading
│       └── data/                   # Runtime data directories
│
├── frontend/                       # Next.js 15 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout (Inter font, global CSS)
│   │   │   ├── page.tsx            # 🏠 Home — bill upload + drag & drop
│   │   │   ├── globals.css         # Tailwind v4 @theme tokens + utilities
│   │   │   ├── login/page.tsx      # Login page
│   │   │   ├── register/page.tsx   # Registration page
│   │   │   ├── submit/page.tsx     # 4-step appeal submission wizard
│   │   │   ├── results/page.tsx    # Bill audit results + appeal generation
│   │   │   └── case/[id]/page.tsx  # Live case view with SSE agent stream
│   │   └── lib/
│   │       └── api.ts              # Auth helpers, token management, fetch wrapper
│   ├── next.config.ts              # API proxy rewrites to backend
│   ├── package.json
│   └── Dockerfile                  # Frontend container (standalone output)
│
├── docs/                           # Project documentation and presentations
│   ├── medguard_ai_architecture.svg
│   ├── MedGuard-AI-v1.pptx
│   ├── MedGuard-AI-v2.pptx
│   └── Documentation Draft 1.docx
│
├── docker-compose.yml              # Full stack: DB + Backend + Frontend
├── .env.example                    # Environment variable template
├── start.bat                       # Windows: starts both servers in new terminals
├── launch.bat                      # Windows: starts everything + opens browser
├── test_e2e.py                     # End-to-end API test script
└── package.json                    # Root-level scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- **Git**
- A **Groq API key** (free tier available at [console.groq.com](https://console.groq.com)) — required for real LLM output; the app falls back to mock responses without it
- **Docker Desktop** (optional, for the containerized setup)

---

### Quick Start (Windows — Recommended)

This is the fastest way to get both servers running locally.

**1. Clone the repository**
```bash
git clone https://github.com/Viraj281105/MedGuard-AI.git
cd MedGuard-AI
```

**2. Set up your environment variables**
```bash
copy .env.example backend\.env
```
Open `backend/.env` and fill in your `GROQ_API_KEY`.

**3. Run the launcher**
```bash
launch.bat
```

This script will:
- Open the **Next.js frontend** in a new terminal window and run `npm install && npm run dev`
- Open the **FastAPI backend** in another terminal, create a virtual environment, install Python dependencies, and start Uvicorn
- Wait 15 seconds for both servers to initialize
- Open `http://localhost:3000` in your default browser automatically

> **Alternative:** Use `start.bat` if you want to keep the backend in the current terminal window instead.

---

### Manual Setup

If you prefer full control, follow these steps.

#### Backend

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (copy and edit the template)
# Windows:
copy ..\env.example .env
# macOS/Linux:
cp ../.env.example .env
# → Edit .env and add your GROQ_API_KEY

# Start the backend server
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend will be available at:
- **API Root:** `http://127.0.0.1:8000`
- **Interactive Docs (Swagger):** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

#### Frontend

Open a **new terminal** in the project root:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

> ⚠️ **Important:** The `package.json` in the repo currently lists incorrect package versions (`next: 16.2.4`, `react: 19.2.4`, `lucide-react: 1.8.0`) — none of which exist on npm. Before running `npm install`, update `frontend/package.json` to:
> ```json
> "lucide-react": "^0.460.0",
> "next": "15.3.1",
> "react": "^19.0.0",
> "react-dom": "^19.0.0",
> "eslint-config-next": "15.3.1"
> ```
> Then delete any existing `node_modules` and `package-lock.json` and run `npm install` fresh.

The frontend will be available at `http://localhost:3000`.

---

### Docker Compose Setup

The Docker setup runs all three services (PostgreSQL, Backend, Frontend) together with a single command. This is the recommended approach for production or demo environments.

```bash
# 1. Clone the repo
git clone https://github.com/Viraj281105/MedGuard-AI.git
cd MedGuard-AI

# 2. Set your environment variables
# The docker-compose.yml reads GROQ_API_KEY from your shell environment
# Option A: Export it
export GROQ_API_KEY=gsk_your_key_here   # macOS/Linux
set GROQ_API_KEY=gsk_your_key_here      # Windows CMD

# Option B: Create a .env file in the project root
echo GROQ_API_KEY=gsk_your_key_here > .env

# 3. Build and start all services
docker-compose up --build

# To run in the background
docker-compose up --build -d

# To stop all services
docker-compose down
```

**Service URLs after startup:**
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

> The PostgreSQL database is initialized automatically using the schema at `backend/advocai/storage/postgres/schema.sql` on first run.

---

## 🔐 Environment Variables

Copy `.env.example` to `backend/.env` and configure the following:

```env
# ── LLM Backend ───────────────────────────────────────────────────────
LLM_BACKEND=groq
GROQ_API_KEY=gsk_your_groq_api_key_here   # Required for real AI output
GROQ_MODEL=llama3-70b-8192                 # Can also use llama3-8b-8192

# Ollama (optional — for fully local/offline development)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# ── PostgreSQL ─────────────────────────────────────────────────────────
POSTGRES_HOST=localhost                    # Use 'db' inside Docker
POSTGRES_PORT=5432
POSTGRES_DB=advocai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=advocai123
PERSISTENCE_BACKEND=json                   # Use 'postgres' for DB persistence

# ── Authentication ─────────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_random_64_char_string
ACCESS_TOKEN_EXPIRE_MINUTES=1440           # 24 hours

# ── PubMed API (optional) ──────────────────────────────────────────────
PUBMED_API_KEY=                            # Leave empty if not using PubMed
```

> If `GROQ_API_KEY` is not set or is set to the dummy value, the backend will return clearly-labeled mock LLM responses so you can still test the full UI flow without an API key.

---

## 📡 API Reference

### Health & Info

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service info and available endpoints |
| `GET` | `/health` | Health check — returns `{"status": "ok"}` |

### ClaimShield — Bill Auditing

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a hospital bill (PDF/image). Returns parsed line items, overcharges, and savings estimate. |
| `POST` | `/api/generate-appeal` | Generate a quick appeal from the last uploaded bill's audit data. |
| `GET` | `/api/download-appeal/{filename}` | Download a generated appeal text file. |

**`POST /api/upload` — Request:**
```
Content-Type: multipart/form-data
Body: file (PDF, PNG, JPG, JPEG — max 10MB)
```

**`POST /api/upload` — Response:**
```json
{
  "filename": "hospital_bill.pdf",
  "parsed_items": [
    { "item": "Complete Blood Count", "charged": 850.0 }
  ],
  "overcharges": [
    {
      "item": "Complete Blood Count",
      "charged": 850.0,
      "cghs_rate": 320.0,
      "overcharge": 530.0,
      "confidence": 0.95
    }
  ],
  "savings_estimate": 2030.0
}
```

### AdvocAI — Insurance Appeal Pipeline

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/submit` | Submit a denial case (denial PDF + policy PDF + case details). Returns `session_id`. |
| `GET` | `/api/case/{session_id}/stream` | SSE stream — real-time agent progress events. |
| `GET` | `/api/case/{session_id}/status` | Poll for pipeline status (`queued`, `running`, `done`, `error`). |
| `GET` | `/api/case/{session_id}/result` | Get the final appeal result and judge score. |
| `POST` | `/api/case/{session_id}/rescore` | Re-run the Judge agent to rescore an existing appeal. |
| `GET` | `/api/case/{session_id}/download` | Download the final appeal as a PDF packet. |
| `GET` | `/api/cases` | List all cases for the authenticated user. |
| `DELETE` | `/api/case/{session_id}` | Delete a case and its associated files. |

**`POST /api/submit` — Request:**
```
Content-Type: multipart/form-data
Fields:
  denial_pdf       (file, required)
  policy_pdf       (file, required)
  patient_name     (string, required)
  insurer_name     (string, required)
  procedure_denied (string, required)
  denial_date      (string, optional — YYYY-MM-DD)
  notes            (string, optional)
```

**`POST /api/submit` — Response:**
```json
{ "session_id": "case_a3f8b12c9d01" }
```

**SSE Event Types from `/api/case/{id}/stream`:**
```json
{ "type": "agent_start",  "agent": "auditor" }
{ "type": "agent_stream", "agent": "barrister", "chunk": "Dear Sir/Madam,\n" }
{ "type": "agent_done",   "agent": "judge", "output": { "score": 87 } }
{ "type": "agent_error",  "agent": "clinician", "message": "PubMed timeout" }
{ "type": "pipeline_done" }
```

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new user account. |
| `POST` | `/api/auth/login` | Login and receive a JWT access token. |
| `GET` | `/api/auth/me` | Get the current authenticated user's profile. |

---

## 🖥️ Frontend Pages

| Route | Description |
|---|---|
| `/` | **Home** — Hero section, drag-and-drop bill upload, one-click analysis |
| `/results` | **Audit Results** — Overcharge breakdown table, savings estimate, generate appeal button |
| `/submit` | **Submit Appeal** — 4-step wizard (upload denial → upload policy → case details → review) |
| `/case/[id]` | **Live Case View** — Real-time SSE agent pipeline status, streaming appeal draft, PDF download |
| `/login` | **Login** — JWT authentication |
| `/register` | **Register** — User account creation |

---

## 🧠 How the AI Works

### Bill Parsing (OCR Layer)

- **PDF bills:** Extracted using `PyMuPDF` (`fitz`), which reads text directly from the PDF structure
- **Image bills (photos of bills):** Processed with `EasyOCR` (English), converting the image to a numpy array via OpenCV and running text detection
- A **regex heuristic** (`[A-Za-z\s]+[\s:]+ ₹?(\d+\.?\d*)`) extracts item name + price pairs from the raw text output
- Lines matching blacklisted words (`total`, `subtotal`, `date`, `invoice`) are filtered out

### CGHS Rate Matching

A keyword dictionary of official CGHS rates is used with fuzzy substring matching (e.g., `"blood count"` matches `"Complete Blood Count"`). This is intentionally simple and extensible — a full CGHS database integration is planned.

### Anomaly Confidence Scoring

Confidence is determined by the percentage deviation from the CGHS benchmark:
- **> 100% markup** → 95% confidence
- **> 50% markup** → 85% confidence
- **≤ 50% markup** → 70% confidence

### RAG for Legal Citations (Vector Store)

The Regulatory Agent uses a local `SentenceTransformer` (`all-MiniLM-L6-v2`) to embed a curated set of IRDAI circulars and CGHS guidelines. At runtime, the agent encodes the query (denied procedure names) and retrieves the top-k most semantically relevant regulatory excerpts via cosine similarity. These are then injected into the LLM prompt as grounded context — preventing hallucinated citations.

### LLM Prompting Strategy

Each agent has a focused **system role prompt** and a **task-specific user prompt**:
- The Auditor acts as a "Medical Billing Auditor"
- The Clinician acts as a "Chief Medical Officer"
- The Regulatory agent acts as a "Regulatory Expert"
- The Barrister acts as a "ruthless Insurance Barrister"
- The Judge acts as a "Senior Judge" reviewing and finalizing the output

All agents use `temperature=0.2` for deterministic, professional output, with `max_tokens=1024`.

---

## 🐛 Known Issues & Fixes

### Frontend — Package Versions (Breaks `npm install`)

The `frontend/package.json` currently lists versions that do not exist on npm:

| Package | Current (broken) | Correct |
|---|---|---|
| `next` | `16.2.4` | `15.3.1` |
| `react` | `19.2.4` | `^19.0.0` |
| `react-dom` | `19.2.4` | `^19.0.0` |
| `lucide-react` | `^1.8.0` | `^0.460.0` |
| `eslint-config-next` | `16.2.4` | `15.3.1` |

**Fix:** Update `frontend/package.json` to the correct versions above, delete `node_modules` and `package-lock.json`, then run `npm install`.

### Backend — EasyOCR First-Run Download

On the very first run, EasyOCR will download its language models (~200MB). This is a one-time operation. Subsequent starts are fast. In Docker, this is cached in the image layer after the first build.

### Backend — `sentence-transformers` / `torch` Installation Time

The `torch` and `sentence-transformers` packages are large (~2–3GB). The first `pip install -r requirements.txt` will take several minutes depending on connection speed. This is normal.

---

## 🗺️ Roadmap

- [ ] Fix frontend package versions (immediate)
- [ ] Expand CGHS rate database from ~7 items to the full official schedule (1000+ procedures)
- [ ] Add Hinglish voice input for bill submission (Web Speech API + Whisper transcription)
- [ ] Integrate live PubMed search in the Clinician Agent (API key optional today)
- [ ] Full PostgreSQL persistence for all sessions (currently defaults to JSON)
- [ ] Shareable case links for patients to send appeal progress to family
- [ ] WhatsApp / SMS notification when appeal is ready
- [ ] Mobile app (React Native) for photographing and submitting bills on the spot
- [ ] Admin dashboard for tracking aggregate overcharge data by hospital

---

## 👥 Contributors

<table>
  <tr>
    <td align="center">
      <b>Viraj Jadhao</b><br/>
      Full-Stack Development, Backend Architecture, AI/Agent Design
    </td>
    <td align="center">
      <b>Bhumi Sirvi</b><br/>
      Frontend Development, UI/UX Design, Documentation
    </td>
  </tr>
</table>

*Team Neural Nomads — built for Nexus 2.0 Hackathon*

---

<div align="center">

**MedGuard AI** — Because your hospital bill shouldn't be a mystery.

</div>
