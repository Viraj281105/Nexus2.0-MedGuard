<div align="center">

# 🛡️ MedGuard AI

### AI-Powered Medical Billing Auditor & Insurance Appeal Engine for India

**Built for the Indian healthcare system. Designed to fight back.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2016-pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![JWT](https://img.shields.io/badge/Auth-JWT%2BbcryptL%20-4CAF50?style=flat-square)](https://tools.ietf.org/html/rfc7519)
[![LLM](https://img.shields.io/badge/LLM-Groq%20%7C%20LLaMA3-orange?style=flat-square)](https://groq.com/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=flat-square)]()

---

**✅ Fully Integrated | ✅ Production Ready | ✅ Multi-User Support**

*Developed by **Viraj Jadhao** & **Bhumi Sirvi** — Team Neural Nomads*

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [What's New (Integration Complete)](#-whats-new-integration-complete)
- [System Architecture](#-system-architecture)
- [The 5-Agent AdvocAI Pipeline](#-the-5-agent-advocai-pipeline)
- [Tech Stack](#-tech-stack)
- [Database Architecture](#-database-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start with Docker](#quick-start-with-docker)
  - [Manual Setup](#manual-setup)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Authentication & Security](#-authentication--security)
- [User Workflows](#-user-workflows)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Contributors](#-contributors)

---

## 🔍 Overview

**AdvocAI** is a full-stack, AI-powered platform that solves a critical problem in the Indian healthcare system:

**When a patient's insurance claim is denied, AdvocAI automatically:**
1. Parses the denial letter and insurance policy documents
2. Researches clinical evidence and IRDAI regulations
3. Generates a legally-sound, formal appeal letter
4. Provides a confidence score and ready-to-send PDF

The entire workflow — from uploading documents to downloading a finished appeal letter — takes **under 2 minutes**, without needing a lawyer or billing expert.

### Who Is This For?

- 🏥 **Patients** denied insurance claims
- 👨‍⚕️ **Doctors** helping patients file appeals
- 🏢 **Hospitals** managing patient relations
- 📋 **Medical billing advocates** scaling their practice
- 💼 **Insurance brokers** fighting denials

---

## ✨ Key Features

### 🎯 Core Capabilities

✅ **Multi-User Platform**
- User registration with email and secure password (bcrypt hashed)
- JWT-based authentication with 24-hour token expiry
- User-specific case history (cannot see other users' cases)
- Session management with PostgreSQL persistence

✅ **Document Processing**
- Support for **.pdf, .png, .jpg, .jpeg** inputs up to 10MB
- OCR-powered document parsing using PyMuPDF (PDFs) and EasyOCR (images)
- Automatic extraction of denial reasons, policy clauses, and coverage details
- File storage in Docker volumes (survives container restarts)

✅ **5-Agent AI Pipeline (Real-Time Streaming)**
- **Auditor**: Document parsing and structured denial extraction
- **Clinician**: Retrieves clinical evidence for medical necessity
- **Regulatory**: Searches IRDAI regulations and CGHS guidelines via RAG
- **Barrister**: Drafts formal, legally-sound appeal letter (streams in real-time)
- **Judge**: Quality scoring (0–100) and final polish

✅ **Real-Time Frontend Updates**
- Server-Sent Events (SSE) streaming from backend
- Live agent progress indicators with animations
- Streaming appeal draft rendered as it's generated
- Responsive glass-morphism dark UI

✅ **Appeal Management**
- Download finalized appeal as PDF packet
- Rescore appeal with edited text
- View full case history
- Delete completed cases

---

## 🎉 What's New (Integration Complete)

### ✅ Backend-Frontend Integration
- **Frontend**: Now communicates with backend via secure API
- **Authentication**: All protected endpoints require valid JWT token
- **User Isolation**: Each user sees only their own cases
- **Database Persistence**: All cases stored in PostgreSQL (survives restarts)

### ✅ User Authentication System
- **Registration**: `POST /api/auth/register` with email validation
- **Login**: `POST /api/auth/login` returns JWT token + user info
- **Token Management**: Stored in browser localStorage with Bearer header
- **Account Info**: `GET /api/auth/me` returns current user

### ✅ User-Specific Case Management
- **Submit Case**: `POST /api/submit` creates case linked to current user
- **List Cases**: `GET /api/cases` returns only user's cases
- **Stream Events**: `GET /api/case/{id}/stream` requires user ownership verification
- **Delete Case**: `DELETE /api/case/{id}` with ownership check

### ✅ Database Enhancements
| Table | Purpose | New |
|-------|---------|-----|
| `users` | Store user accounts | ✅ |
| `user_sessions` | Link users to cases | ✅ |
| `sessions` | Case metadata + status | ✅ Enhanced |
| `agent_outputs` | Store AI results | ✅ |
| `workflow_errors` | Track failures | ✅ |

### ✅ Production-Ready Security
- Passwords hashed with bcrypt (never stored in plain text)
- JWT tokens with cryptographic signing
- CORS protection with configurable origins
- Rate limiting ready (can be enabled)
- Database transactions for data consistency

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         MedGuard AI — Full Stack                            │
│                                                                              │
│   ┌──────────────────────┐              ┌─────────────────────────────┐   │
│   │   Next.js 15         │              │   FastAPI Backend (v2.0)     │   │
│   │   Frontend           │◄────────────►│   Unified Entry Point         │   │
│   │   (TypeScript)       │ HTTP / SSE   │   (main.py)                  │   │
│   │   (port 3000)        │              │   (port 8000)                │   │
│   └──────────────────────┘              └─────────────────────────────┘   │
│                                                    │                        │
│                            ┌───────────────────────┼───────────────────┐   │
│                            │                       │                   │   │
│              ┌─────────────▼────┐    ┌────────────▼──────┐   ┌────────▼── │
│              │   MedGuard       │    │   MedGuard AI Engine  │   │ Auth       │
│              │   Bill Auditing  │    │   (5-Agent)       │   │ System     │
│              │                  │    │                   │   │            │
│              │ • OCR Parsing    │    │ • Auditor Agent   │   │ • JWT      │
│              │ • CGHS Lookup    │    │ • Clinician       │   │ • bcrypt   │
│              │ • Anomaly Detect │    │ • Regulatory      │   │ • Session  │
│              │ • Speech Parser  │    │ • Barrister       │   │   Manager  │
│              │ • PDF Generator  │    │ • Judge           │   │            │
│              └──────────────────┘    └───────────────────┘   └────────────│
│                                                                             │
│              ┌──────────────────────────────────────────────────────────┐  │
│              │          Infrastructure & Storage                        │  │
│              │                                                          │  │
│              │  ✅ PostgreSQL 16 + pgvector (persistent storage)       │  │
│              │  ✅ Docker Volumes (file uploads, sessions)             │  │
│              │  ✅ Groq API (LLaMA3-70B LLM)                          │  │
│              │  ✅ Sentence Transformers (embeddings + RAG)           │  │
│              │  ✅ EasyOCR + PyMuPDF (document parsing)                │  │
│              │  ✅ ReportLab (PDF generation)                         │  │
│              │  ✅ Server-Sent Events (real-time streaming)           │  │
│              └──────────────────────────────────────────────────────────┘  │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 The 5-Agent MedGuard AI Pipeline

When a user submits an insurance denial case, the following agents execute sequentially. Their progress streams live to the frontend via **Server-Sent Events (SSE)**.

```
User Submits:
  • Denial Letter (PDF/image)
  • Insurance Policy (PDF/image)
  • Patient Name, Insurer, Procedure
              │
              ▼
  ┌───────────────────────────────────────┐
  │  1. 🔍 AUDITOR AGENT                  │
  │  ✓ Extract denial reason              │
  │  ✓ Parse policy exclusions            │
  │  ✓ Identify coverage gaps             │
  │  ✓ Structured denial object           │
  └─────────────────┬─────────────────────┘
                    │
                    ▼
  ┌───────────────────────────────────────┐
  │  2. 🩺 CLINICIAN AGENT                │
  │  ✓ Research clinical evidence         │
  │  ✓ Find medical necessity proof       │
  │  ✓ Retrieve PubMed references         │
  │  ✓ Build clinical argument            │
  └─────────────────┬─────────────────────┘
                    │
                    ▼
  ┌───────────────────────────────────────┐
  │  3. ⚖️ REGULATORY AGENT               │
  │  ✓ Query IRDAI circulars via RAG      │
  │  ✓ Search CGHS guidelines             │
  │  ✓ Find regulatory precedents         │
  │  ✓ Identify policy violations         │
  │  ✓ Build legal framework              │
  └─────────────────┬─────────────────────┘
                    │
                    ▼
  ┌───────────────────────────────────────┐
  │  4. 📜 BARRISTER AGENT (STREAMING)    │
  │  ✓ Draft formal appeal letter         │
  │  ✓ Combine clinical + legal evidence  │
  │  ✓ Professional tone + formatting     │
  │  ✓ Real-time token streaming          │
  │  ✓ Ready-to-send document             │
  └─────────────────┬─────────────────────┘
                    │
                    ▼
  ┌───────────────────────────────────────┐
  │  5. 🏛️ JUDGE AGENT (QA)               │
  │  ✓ Score appeal quality (0–100)       │
  │  ✓ Verify legal completeness          │
  │  ✓ Polish tone & structure            │
  │  ✓ Final review & approval            │
  └─────────────────┬─────────────────────┘
                    │
                    ▼
              📄 FINAL OUTPUT
       ✓ Appeal PDF packet
       ✓ Quality score
       ✓ Ready to email/file
```

**Key Feature**: As the **Barrister** agent writes the appeal letter, every token streams in real-time to the frontend — giving users a live, animated view of the letter being composed.

---

## 🛠️ Tech Stack

### Backend
| Component | Technology | Purpose |
|---|---|---|
| Web Framework | FastAPI 0.115+ | REST API + SSE streaming |
| ASGI Server | Uvicorn | Production-ready async server |
| LLM Provider | Groq API (LLaMA3-70B) | Fast, high-quality LLM inference |
| OCR — PDFs | PyMuPDF (fitz) + LayoutLMv3 | Extract text from PDF documents |
| OCR — Images | EasyOCR | Extract text from photos/scans |
| Document Processing | pdf2image, Pillow | Image preprocessing |
| Speech-to-Text | OpenAI Whisper | Audio transcription (optional) |
| Embeddings / RAG | Sentence Transformers (all-MiniLM-L6-v2) | Semantic search for IRDAI regulations |
| Vector Search | FAISS | In-memory vector store |
| PDF Generation | ReportLab | Generate appeal PDFs |
| Database | PostgreSQL 16 + pgvector | Persistent user data + embeddings |
| Auth | JWT (PyJWT) + bcrypt | Secure authentication |
| Data Validation | Pydantic v2 | Type-safe request/response models |
| Async/Concurrency | asyncio | Async task scheduling |

### Frontend
| Component | Technology | Purpose |
|---|---|---|
| Framework | Next.js 15 (App Router) | React full-stack framework |
| Language | TypeScript 5 | Type-safe JavaScript |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Animations | Framer Motion 12 | Smooth UI animations |
| Icons | Lucide React | Beautiful SVG icons |
| Real-time | Server-Sent Events (EventSource API) | Live event streaming |
| State Management | React Hooks | useState, useEffect, useCallback |
| Storage | localStorage | Client-side token + case persistence |
| HTTP Client | Native Fetch API | REST API communication |

### Infrastructure
| Component | Technology | Purpose |
|---|---|---|
| Containerization | Docker + Docker Compose | Full stack orchestration |
| Database Image | pgvector/pgvector:pg16 | PostgreSQL with vector support |
| Volume Management | Docker Volumes | Persistent file storage |
| Network | Docker Compose networks | Inter-container communication |

---

## 💾 Database Architecture

### PostgreSQL Schema (Auto-initialized)

```sql
-- Users table (authentication)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User-case mapping (ownership tracking)
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_id UUID UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Case metadata + status
CREATE TABLE sessions (
    session_id UUID PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    status TEXT DEFAULT 'queued',
    patient_name TEXT,
    insurer_name TEXT,
    procedure_denied TEXT,
    denial_date TEXT,
    notes TEXT,
    denial_path TEXT,
    policy_path TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI agent outputs
CREATE TABLE agent_outputs (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(session_id),
    agent_stage TEXT, -- auditor|clinician|regulatory|barrister|judge
    output_json JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Error tracking
CREATE TABLE workflow_errors (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES sessions(session_id),
    agent_stage TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Data Persistence
- **User Accounts**: Stored in PostgreSQL (email + hashed password)
- **Case Metadata**: PostgreSQL (status, file paths, patient details)
- **Case Files**: Docker volume (survives restarts)
- **Session Events**: In-memory during processing, then logged to PostgreSQL
- **AI Outputs**: Stored in PostgreSQL as JSON for later retrieval

---

## 📁 Project Structure

```
MedGuard-AI/
│
├── backend/                             # FastAPI backend (unified entry point)
│   ├── main.py                          # 🚀 Entry point — mounts both apps
│   ├── requirements.txt                 # Python dependencies
│   ├── Dockerfile                       # Backend container
│   │
│   ├── services/                        # MedGuard Bill Auditing Services
│   │   ├── ocr_parser.py               # LayoutLMv3 + EasyOCR document parsing
│   │   ├── anomaly_detector.py         # Isolation Forest + confidence scoring
│   │   ├── cghs_checker.py             # CGHS rate lookup (fuzzy matching)
│   │   ├── pdf_generator.py            # ReportLab appeal PDF generation
│   │   └── speech_parser.py            # OpenAI Whisper audio transcription
│   │
│   ├── agents/                          # MedGuard Bill Audit Orchestrator
│   │   └── orchestrator.py             # Runs the bill audit pipeline
│   │
│   ├── db/                              # Database utilities
│   │   └── vector_store.py             # Vector search for documents
│   │
│   ├── data/                            # Runtime data (bill auditing)
│   │   ├── input/                       # Uploaded files
│   │   └── output/                      # Processed outputs
│   │
│   ├── uploads/                         # Raw file uploads
│   ├── sessions/                        # Session storage
│   │
│   └── advocai/                         # AdvocAI Insurance Appeal Engine
│       ├── agents/                      # Individual LLM agents
│       │   ├── auditor.py              # Parse denial + extract structure
│       │   ├── clinician.py            # Find medical necessity evidence
│       │   ├── regulatory.py           # Search IRDAI/CGHS via RAG
│       │   ├── barrister.py            # Draft appeal letter (streams)
│       │   ├── judge.py                # QA scoring + finalization
│       │   └── __init__.py
│       │
│       ├── orchestrator/                # AdvocAI FastAPI Sub-App
│       │   ├── app.py                  # Routes + SSE endpoints
│       │   ├── main.py                 # Pipeline orchestration
│       │   ├── auth/                   # JWT authentication
│       │   │   ├── router.py          # /api/auth endpoints
│       │   │   ├── db.py              # User & case DB functions
│       │   │   ├── config.py          # JWT configuration
│       │   │   └── __init__.py
│       │   └── __init__.py
│       │
│       ├── tools/                       # Shared utilities
│       │   ├── document_reader.py      # PDF/image reading
│       │   ├── io_utils.py             # File I/O helpers
│       │   ├── pdf_compiler.py         # ReportLab PDF assembly
│       │   ├── pubmed_search.py        # Clinical evidence fetch
│       │   └── __init__.py
│       │
│       ├── storage/                     # Persistence layer
│       │   ├── session_manager.py      # Session CRUD
│       │   ├── json/                   # JSON-based storage (fallback)
│       │   ├── postgres/               # PostgreSQL schema + queries
│       │   │   ├── schema.sql         # 🗄️ DB schema (auto-loaded)
│       │   │   ├── connection.py
│       │   │   ├── embeddings.py
│       │   │   ├── repository.py
│       │   │   └── __init__.py
│       │   └── __init__.py
│       │
│       ├── config/                      # Configuration
│       │   ├── settings.py             # App configuration
│       │   └── __init__.py
│       │
│       ├── sessions/                    # AdvocAI session storage
│       │
│       └── data/                        # Runtime data
│           ├── input/                   # Uploaded files
│           ├── output/                  # AI outputs
│           └── knowledge/
│               └── law_library.json    # IRDAI regulations
│
├── frontend/                            # Next.js 15 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root layout
│   │   │   ├── globals.css             # Tailwind tokens + utilities
│   │   │   ├── page.tsx                # 🏠 Home — drag & drop bill upload
│   │   │   ├── login/page.tsx          # 🔐 Login page
│   │   │   ├── register/page.tsx       # 📝 Registration page
│   │   │   ├── submit/page.tsx         # 📋 4-step appeal wizard
│   │   │   ├── history/page.tsx        # 📚 Case history dashboard
│   │   │   ├── results/page.tsx        # 📊 Bill audit results
│   │   │   └── case/[id]/page.tsx      # 🎬 Live case view + SSE stream
│   │   │
│   │   ├── components/                  # Reusable React components
│   │   │   ├── Header.tsx              # Navigation header
│   │   │   ├── Button.tsx              # Button variants
│   │   │   ├── Card.tsx                # Card containers
│   │   │   ├── Input.tsx               # Form inputs
│   │   │   ├── Badge.tsx               # Status badges
│   │   │   ├── Toast.tsx               # Notifications
│   │   │   └── index.ts                # Component exports
│   │   │
│   │   └── lib/
│   │       ├── api.ts                  # API client + auth helpers
│   │       ├── history.ts              # localStorage history management
│   │       └── toast.ts                # Toast notification system
│   │
│   ├── next.config.ts                  # Next.js configuration
│   ├── tsconfig.json                   # TypeScript configuration
│   ├── package.json                    # npm dependencies
│   ├── Dockerfile                      # Frontend container
│   └── README.md
│
├── docs/                                # Documentation
│   ├── medguard_ai_architecture.svg    # Architecture diagram
│   ├── MedGuard-AI-v1.pptx            # Presentation slides (v1)
│   ├── MedGuard-AI-v2.pptx            # Presentation slides (v2)
│   └── Documentation Draft 1.docx     # Draft documentation
│
├── docker-compose.yml                   # Full stack orchestration
├── .env.example                         # Environment template
├── INTEGRATION_GUIDE.md                 # 🔌 Backend-Frontend integration docs
├── INTEGRATION_SUMMARY.md               # 📋 Integration checklist
├── launch.bat                           # Windows: start all services + browser
├── start.bat                            # Windows: start backend
├── test_e2e.py                          # End-to-end API tests
├── README.md                            # 📖 Project documentation
└── package.json                         # Root-level npm scripts
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** with npm
- **Git**
- **Docker Desktop** (for containerized setup — recommended)
- **Groq API Key** (free tier at [console.groq.com](https://console.groq.com))
  - Without this, the app will use mock responses, but functionality is full
  - Used for LLaMA3-70B inference in all agents

---

### Quick Start with Docker (Recommended)

This is the fastest way to get the entire stack running with all three services (PostgreSQL, Backend, Frontend).

**1. Clone and enter project**
```bash
git clone https://github.com/Viraj281105/MedGuard-AI.git
cd MedGuard-AI
```

**2. Set your Groq API key**

Option A — Environment variable (Windows PowerShell):
```powershell
$env:GROQ_API_KEY = "gsk_your_key_here"
```

Option B — Create `.env` file in project root:
```bash
echo GROQ_API_KEY=gsk_your_key_here > .env
```

**3. Build and run with Docker Compose**
```bash
docker-compose up --build
```

**4. Wait for services to start** (~2-3 minutes)

Watch the logs for:
```
db        | PostgreSQL 16 ready to accept connections
backend   | Application startup complete
frontend  | ready - started server on 0.0.0.0:3000
```

**5. Open in browser**
```
Frontend:  http://localhost:3000
Backend:   http://localhost:8000
API Docs:  http://localhost:8000/docs
```

---

### Manual Setup (Local Development)

If you prefer to run services locally without Docker:

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Or (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy ..\env.example .env
# Or (macOS/Linux)
cp ../.env.example .env

# Edit .env and add your GROQ_API_KEY

# Start server
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend available at: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

#### Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend available at: `http://localhost:3000`

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# ═══════════════════════════════════════════════════════════════════════
# LLM Configuration
# ═══════════════════════════════════════════════════════════════════════
LLM_BACKEND=groq                              # Primary LLM backend
GROQ_API_KEY=gsk_your_groq_api_key_here       # Get from console.groq.com
GROQ_MODEL=llama3-70b-8192                    # LLaMA 3 70B (recommended)
                                              # Alternative: llama3-8b-8192

# Ollama (optional — for fully local/offline setup)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# ═══════════════════════════════════════════════════════════════════════
# Database Configuration
# ═══════════════════════════════════════════════════════════════════════
POSTGRES_HOST=localhost                       # Use 'db' inside Docker
POSTGRES_PORT=5432
POSTGRES_DB=advocai
POSTGRES_USER=postgres
POSTGRES_PASSWORD=advocai123
PERSISTENCE_BACKEND=postgres                  # Use 'json' for file-based fallback

# ═══════════════════════════════════════════════════════════════════════
# Authentication
# ═══════════════════════════════════════════════════════════════════════
JWT_SECRET=your_secret_key_change_in_production
ACCESS_TOKEN_EXPIRE_MINUTES=1440              # 24 hours

# ═══════════════════════════════════════════════════════════════════════
# Optional Services
# ═══════════════════════════════════════════════════════════════════════
PUBMED_API_KEY=                               # Leave empty if not using PubMed
```

---

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
