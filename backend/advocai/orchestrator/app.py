"""
orchestrator/app.py — AdvocAI FastAPI Application

Main entry point for the AdvocAI API server.
Provides endpoints for:
- Case submission and processing
- Real-time event streaming (SSE)
- Case management (list, delete, status, result)
- Appeal rescoring with judge feedback
- PDF packet download
"""

import asyncio
import json
import os
import uuid
import logging

from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file at project root
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from typing import Annotated, AsyncGenerator

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

# Authentication module
from .auth import router as auth_router, ensure_users_table
from .auth.config import DEMO_MODE
from pydantic import BaseModel
from .auth.db import UserRecord, create_case, get_user_cases, get_case_by_id, delete_case, update_case_status

# Mock user for demo mode
class MockUser:
    id = 1
    email = "demo@medguard.ai"

# Main pipeline orchestration
from .main import orchestrate_advocai_workflow, initialize_llm_client

# Session management utilities
from ..storage.session_manager import get_cases_for_user, delete_case_for_user

# Configure logging
logger = logging.getLogger("AdvocAI.App")
# Configure file handler for persistent logs
log_dir = Path('logs')
log_dir.mkdir(exist_ok=True)
file_handler = logging.FileHandler(log_dir / 'backend.log')
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.propagate = False

# ==============================================================================
# FASTAPI APPLICATION SETUP
# ==============================================================================

app = FastAPI(title="AdvocAI API", version="2.0.0")



@app.on_event("startup")
async def startup():
    """
    Initialize application on startup.
    Ensures users table exists in PostgreSQL (if available).
    Initializes database schema from schema.sql if using PostgreSQL.
    """
    logger.info("=" * 60)
    logger.info("AdvocAI Backend Startup")
    logger.info("=" * 60)
    
    if DEMO_MODE:
        logger.warning("⚠️  DEMO MODE ENABLED - Authentication Bypassed!")
        logger.warning("    All endpoints accessible without JWT token")
        logger.warning("    Demo user: demo@advocai.local (ID: 999)")
    else:
        logger.info("✓ Authentication required - Production mode")
    logger.info("=" * 60)
    
    try:
        ensure_users_table()
        logger.info("✓ Database initialization complete")
    except Exception as error:
        logger.warning(f"⚠️  Could not ensure users table (DB may not be available): {error}")
        logger.warning("   Some features may be unavailable. Check your database connection.")


# Configure CORS to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Allow all origins (adjust for production)
    allow_credentials=True,
    allow_methods=["*"],           # Allow all HTTP methods
    allow_headers=["*"],           # Allow all headers
)

# ==============================================================================
# IN-MEMORY SESSION STORE
# ==============================================================================

# Active session storage for real-time event streaming.
# Persisted data (cases, users) is stored in PostgreSQL.
# This dict holds ephemeral data for active processing sessions only.
ACTIVE_SESSIONS: dict = {}


# ==============================================================================
# CASE SUBMISSION ENDPOINT
# ==============================================================================

@app.post("/api/submit")
async def submit_case(background_tasks: BackgroundTasks,
    # Optional: bill PDF (for bill analysis)
    bill_pdf: UploadFile = File(None),
    # Optional: claim PDF (for denial analysis)
    claim_pdf: UploadFile = File(None),
    # Required: insurance policy document
    policy_pdf: UploadFile = File(...),
    # Case metadata fields
    patient_name: str = Form(...),
    insurer_name: str = Form(...),
    procedure_billed: str = Form(None),
    claim_issue: str = Form(None),
    bill_date: str = Form(""),
    claim_date: str = Form(""),
    notes: str = Form(""),
    analysis_type: str = Form("bill"),
):
    """
    Submit a new case for AI analysis.
    
    Requires valid JWT token in Authorization header.
    
    Workflow:
    1. Validate input (at least one of bill_pdf or claim_pdf)
    2. Create session directory and save uploaded files
    3. Create database record for the case
    4. Initialize in-memory session for event streaming
    5. Launch async pipeline task
    6. Return session_id to client
    """
    # Determine which document was submitted (bill or claim/denial letter)
    denial_document = bill_pdf or claim_pdf
    if not denial_document:
        raise HTTPException(status_code=400, detail="Either bill_pdf or claim_pdf is required")
    
    # Extract procedure/issue from form data
    procedure_denied = procedure_billed or claim_issue or ""
    denial_date = bill_date or claim_date or ""
    
    # Generate unique session ID and create session directory
    session_id = str(uuid.uuid4())
    session_dir = Path(f"sessions/{session_id}")
    session_dir.mkdir(parents=True, exist_ok=True)

    # Determine file extensions for saved documents
    denial_extension = Path(denial_document.filename).suffix.lower()
    if denial_extension not in [".pdf", ".jpg", ".jpeg", ".png"]:
        denial_extension = ".pdf"
    
    policy_extension = Path(policy_pdf.filename).suffix.lower()
    if policy_extension not in [".pdf", ".jpg", ".jpeg", ".png"]:
        policy_extension = ".pdf"

    # Build file paths and save uploaded files
    denial_path = session_dir / f"denial{denial_extension}"
    policy_path = session_dir / f"policy{policy_extension}"

    denial_path.write_bytes(await denial_document.read())
    policy_path.write_bytes(await policy_pdf.read())

    try:
        # Step 1: Create database record for the case
        case = create_case(
            user_id=MockUser.id,
            patient_name=patient_name,
            insurer_name=insurer_name,
            procedure_denied=procedure_denied,
            denial_date=denial_date,
            notes=notes,
            denial_path=str(denial_path),
            policy_path=str(policy_path),
            status="queued",
        )
        
        # Step 2: Use UUID from database for consistency
        actual_session_id = str(case.session_id)
        
        # Step 3: Initialize in-memory event store for real-time updates
        ACTIVE_SESSIONS[actual_session_id] = {
            "status": "queued",
            "events": [],
            "result": None,
            "meta": {
                "patient_name": patient_name,
                "insurer_name": insurer_name,
                "procedure_denied": procedure_denied,
                "denial_date": denial_date,
                "notes": notes,
                "denial_path": str(denial_path),
                "policy_path": str(policy_path),
            },
        }

        # Step 4: Launch async pipeline task (non-blocking)
        logger.info(f"Launching pipeline for session {actual_session_id}")
        background_tasks.add_task(_run_pipeline_task, actual_session_id)
        
        return {"session_id": actual_session_id, "status": "queued"}
    
    except Exception as error:
        logger.error(f"Error creating case: {error}")
        raise HTTPException(status_code=500, detail=f"Error creating case: {str(error)}")


# ==============================================================================
# CASE MANAGEMENT ENDPOINTS
# ==============================================================================

@app.get("/api/cases")
async def list_cases():
    """
    List all cases from the database.
    
    Returns a simplified case list with key metadata.
    """
    try:
        user_cases = get_user_cases(MockUser.id)
        cases = [
            {
                "session_id": str(case.session_id),
                "status": case.status,
                "patient_name": case.patient_name,
                "procedure_denied": case.procedure_denied,
                "denial_date": case.denial_date,
                "created_at": case.created_at.isoformat() if case.created_at else None,
            }
            for case in user_cases
        ]
        return {"cases": cases}
    except Exception as error:
        logger.error(f"Error listing cases: {error}")
        raise HTTPException(status_code=500, detail=f"Error listing cases: {str(error)}")


@app.delete("/api/case/{session_id}", status_code=204)
async def delete_case_endpoint(
    session_id: str,
):
    """
    Delete a case by session_id.
    
    Also removes the case from the in-memory active sessions store.
    """
    try:
        # Delete from database
        success = delete_case(MockUser.id, session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Clean up in-memory session if exists
        if session_id in ACTIVE_SESSIONS:
            del ACTIVE_SESSIONS[session_id]
    
    except Exception as error:
        logger.error(f"Error deleting case: {error}")
        raise HTTPException(status_code=500, detail=f"Error deleting case: {str(error)}")


# ==============================================================================
# ASYNC PIPELINE TASK
# ==============================================================================

async def _run_pipeline_task(session_id: str):
    """
    Background task that runs the multi-agent pipeline.
    
    Updates database status and emits events to the SSE stream.
    
    Args:
        session_id: Unique identifier for the case
    """
    logger.info(f"_run_pipeline_task STARTED for {session_id}")
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        logger.error(f"Session {session_id} not found in active sessions")
        return
    
    # Update status to running
    session["status"] = "running"
    update_case_status(session_id, "running")

    def emit(event: dict):
        """Helper function to add events to session event log."""
        session["events"].append(event)

    try:
        meta = session["meta"]
        
        # Run the main orchestration workflow (blocking, run in thread pool)
        result = await asyncio.to_thread(
            orchestrate_advocai_workflow,
            client=initialize_llm_client(),
            denial_path=meta["denial_path"],
            policy_path=meta["policy_path"],
            case_id=session_id,
            emit=emit,
        )

        # Update session with successful result
        session["result"] = result
        session["status"] = "done"
        update_case_status(session_id, "done")

        # Compile PDF appeal packet from agent outputs
        try:
            from ..tools.pdf_compiler import compile_appeal_packet
            compile_appeal_packet(
                case_dir=f"data/output/{session_id}",
                output_path=f"sessions/{session_id}/appeal_packet.pdf"
            )
        except Exception as pdf_error:
            logger.warning(f"PDF compile failed: {pdf_error}")

        # Signal completion to SSE stream
        emit({"type": "pipeline_done", "session_id": session_id})

    except Exception as error:
        # Handle pipeline failure
        session["status"] = "error"
        update_case_status(session_id, "error")
        emit({"type": "error", "message": str(error)})
        logger.error(f"Pipeline error for {session_id}: {error}")


# ==============================================================================
# REAL-TIME STREAMING (SSE)
# ==============================================================================

@app.get("/api/case/{session_id}/stream")
async def stream_case(
    session_id: str,
):
    """
    Server-Sent Events (SSE) endpoint for real-time case processing updates.
    
    Streams events as they are generated by the pipeline.
    """
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not active")

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events for the client."""
        session = ACTIVE_SESSIONS[session_id]
        sent_index = 0
        max_wait = 120  # Maximum wait time in seconds (120 sec = 2 minutes)

        # Loop until timeout or completion
        for _ in range(max_wait * 10):  # Check every 0.1 seconds
            events = session["events"]
            
            # Send any new events
            while sent_index < len(events):
                event = events[sent_index]
                sent_index += 1
                yield f"data: {json.dumps(event)}\n\n"

            # Exit if pipeline is complete or errored
            if session["status"] in ("done", "error"):
                yield f"data: {json.dumps({'type': 'close'})}\n\n"
                return

            await asyncio.sleep(0.1)  # Small delay to prevent CPU spinning

        # Timeout reached
        yield f"data: {json.dumps({'type': 'timeout'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Connection": "keep-alive",
        },
    )


# ==============================================================================
# STATUS & RESULT ENDPOINTS
# ==============================================================================

@app.get("/api/case/{session_id}/status")
async def get_status(
    session_id: str,
):
    """
    Get the current status of a case.
    
    Returns both persisted database status and in-memory event log.
    """
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    session = ACTIVE_SESSIONS.get(session_id, {})
    case = get_case_by_id(MockUser.id, session_id)
    status = case.status if case else "unknown"
    
    return {
        "session_id": session_id,
        "status": status,
        "events": session.get("events", []),
    }


@app.get("/api/case/{session_id}/result")
async def get_result(
    session_id: str,
):
    """
    Get the final result of a completed case.
    
    Returns all agent outputs (auditor, clinician, regulatory, barrister, judge).
    """
    case = get_case_by_id(MockUser.id, session_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Check if pipeline is still running
    if case.status != "done":
        raise HTTPException(status_code=202, detail="Pipeline still running")
    
    session = ACTIVE_SESSIONS.get(session_id, {})
    return session.get("result", {})


# ==============================================================================
# RESCORING ENDPOINT
# ==============================================================================

class RescoreRequest(BaseModel):
    """
    Request body for rescoring a case with edited appeal text.
    
    Attributes:
        edited_text: User-edited version of the appeal letter
    """
    edited_text: str


@app.post("/api/case/{session_id}/rescore")
async def rescore_case(
    session_id: str,
    request: RescoreRequest,
):
    """
    Rescore a case with user-edited appeal text.
    
    Re-runs the Judge agent on the edited text and updates the session.
    """
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not active")

    from ..storage.session_manager import SessionManager
    from .main import save_json_to_file, initialize_llm_client
    from ..agents.judge import run_judge_agent

    # Save edited text as barrister output
    SessionManager.save_checkpoint(session_id, "barrister", {}, request.edited_text)
    case_output_dir = os.path.join("data", "output", session_id)
    os.makedirs(case_output_dir, exist_ok=True)
    save_json_to_file(request.edited_text, os.path.join(case_output_dir, "barrister_output.txt"))

    # Run Judge agent on edited text
    try:
        scorecard = await asyncio.to_thread(run_judge_agent, session_dir=case_output_dir)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

    # Save scorecard to disk
    scorecard_dump = scorecard.model_dump() if hasattr(scorecard, "model_dump") else scorecard
    save_json_to_file(scorecard_dump, os.path.join(case_output_dir, "judge_scorecard.json"))

    # Update in-memory session with new data
    session = ACTIVE_SESSIONS[session_id]
    if session.get("result") and "barrister" in session["result"]:
        session["result"]["barrister"] = request.edited_text
        session["result"]["judge"] = scorecard_dump

    return {"judge": scorecard_dump}


# ==============================================================================
# DOWNLOAD ENDPOINT
# ==============================================================================

@app.get("/api/case/{session_id}/download")
async def download_packet(
    session_id: str,
):
    """
    Download the complete appeal packet as a PDF.
    """
    pdf_path = Path(f"sessions/{session_id}/appeal_packet.pdf")
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not yet generated")
    
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"appeal_{session_id}.pdf"
    )


# ==============================================================================
# HEALTH CHECK ENDPOINT
# ==============================================================================

@app.get("/health")
async def health():
    """
    Health check endpoint for monitoring and load balancers.
    """
    return {"status": "ok", "active_sessions": len(ACTIVE_SESSIONS)}