"""
MedGuard AI + AdvocAI — Unified Backend
=========================================
Single FastAPI entry point that serves both:
  1. The original MedGuard bill-auditing flow (upload → overcharges → quick appeal)
  2. The full AdvocAI 5-agent denial appeal pipeline (submit → stream → download)
"""

import os
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# ── MedGuard services (bill auditing) ────────────────────────────────
from services.ocr_parser import parse_bill
from services.anomaly_detector import detect_anomalies
# from services.speech_parser import parse_audio  # Disabled for demo
from services.pdf_generator import create_appeal_pdf
from agents.orchestrator import AgentOrchestrator

# ── AdvocAI sub-application ──────────────────────────────────────────
from advocai.orchestrator.app import app as advocai_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("MedGuard.Main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== MedGuard AI + AdvocAI Backend Starting ===")
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("outputs", exist_ok=True)
    os.makedirs("sessions", exist_ok=True)
    os.makedirs("data/output", exist_ok=True)
    os.makedirs("data/input", exist_ok=True)
    yield
    logger.info("=== Backend Shutting Down ===")


app = FastAPI(
    title="MedGuard AI",
    description="AI-powered medical bill auditing + insurance denial appeal system",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount AdvocAI as sub-routes on the same app
# All advocai routes (e.g. /api/submit, /api/case/*, /api/auth/*) are included
app.mount("/advocai", advocai_app)

# Also duplicate the key advocai routes on the main app for cleaner frontend access
from advocai.orchestrator.app import (
    submit_case, list_cases, delete_case, stream_case,
    get_status, get_result, rescore_case, download_packet, health,
)
from advocai.orchestrator.auth.router import router as auth_router

app.include_router(auth_router)

# Re-register AdvocAI endpoints on main app
app.add_api_route("/api/submit", submit_case, methods=["POST"])
app.add_api_route("/api/cases", list_cases, methods=["GET"])
app.add_api_route("/api/case/{session_id}", delete_case, methods=["DELETE"])
app.add_api_route("/api/case/{session_id}/stream", stream_case, methods=["GET"])
app.add_api_route("/api/case/{session_id}/status", get_status, methods=["GET"])
app.add_api_route("/api/case/{session_id}/result", get_result, methods=["GET"])
app.add_api_route("/api/case/{session_id}/rescore", rescore_case, methods=["POST"])
app.add_api_route("/api/case/{session_id}/download", download_packet, methods=["GET"])


# ── MedGuard Endpoints (Bill Auditing) ───────────────────────────────

session_data = {}

@app.get("/")
async def root():
    return {
        "service": "MedGuard AI + AdvocAI",
        "version": "2.0.0",
        "endpoints": {
            "bill_audit": "/api/upload",
            "appeal_pipeline": "/api/submit",
            "auth": "/api/auth/login",
            "health": "/health",
        }
    }


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "MedGuard AI + AdvocAI", "version": "2.0.0"}


@app.post("/api/upload")
async def upload_bill(file: UploadFile = File(...)):
    """Upload a hospital bill for CGHS rate auditing."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in [".pdf", ".png", ".jpg", ".jpeg"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    file_path = Path("uploads") / file.filename
    file_bytes = await file.read()
    file_path.write_bytes(file_bytes)

    try:
        parsed_items = parse_bill(file_bytes, file.filename)
        audit_result = detect_anomalies(parsed_items)

        result = {
            "filename": file.filename,
            "parsed_items": parsed_items,
            "overcharges": audit_result["overcharges"],
            "savings_estimate": audit_result["savings_estimate"],
        }

        session_data["last_upload"] = result
        return result

    except Exception as e:
        logger.error(f"Upload processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    """Upload a voice input (Hinglish) for speech-to-text parsing via Whisper."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
        
    file_bytes = await file.read()
    try:
        transcription = parse_audio(file_bytes, file.filename)
        return {"filename": file.filename, "transcription": transcription}
    except Exception as e:
        logger.error(f"Audio processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-appeal")
async def generate_appeal():
    """Quick appeal generation from the last bill audit results."""
    data = session_data.get("last_upload")
    if not data:
        raise HTTPException(status_code=400, detail="No bill data. Upload a bill first.")

    try:
        orchestrator = AgentOrchestrator()
        appeal = await orchestrator.generate_appeal(data)

        # Generate PDF document instead of txt
        appeal_filename = "appeal_letter.pdf"
        appeal_path = Path("outputs") / appeal_filename
        
        actual_path = create_appeal_pdf(appeal, str(appeal_path))
        actual_filename = os.path.basename(actual_path)

        return {
            "appeal_text": appeal,
            "download_url": f"/api/download-appeal/{actual_filename}",
        }

    except Exception as e:
        logger.error(f"Appeal generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download-appeal/{filename}")
async def download_appeal(filename: str):
    file_path = Path("outputs") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    media_type = "application/pdf" if filename.endswith(".pdf") else "text/plain"
    return FileResponse(path=str(file_path), media_type=media_type, filename=filename)
