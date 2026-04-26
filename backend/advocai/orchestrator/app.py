"""
orchestrator/app.py — AdvocAI FastAPI Application
"""

import asyncio
import json
import os
import uuid
import logging

from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from typing import Annotated, AsyncGenerator

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .auth import router as auth_router, ensure_users_table
from .auth.config import DEMO_MODE
from pydantic import BaseModel
from .auth.db import UserRecord, create_case, get_user_cases, get_case_by_id, delete_case, update_case_status

class MockUser:
    id = 1
    email = "demo@medguard.ai"

from .main import orchestrate_advocai_workflow, initialize_llm_client
from ..storage.session_manager import get_cases_for_user, delete_case_for_user

logger = logging.getLogger("AdvocAI.App")
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
    logger.info("=" * 60)
    logger.info("AdvocAI Backend Startup")
    logger.info("=" * 60)
    if DEMO_MODE:
        logger.warning("⚠️  DEMO MODE ENABLED - Authentication Bypassed!")
    else:
        logger.info("✓ Authentication required - Production mode")
    logger.info("=" * 60)
    try:
        ensure_users_table()
        logger.info("✓ Database initialization complete")
    except Exception as error:
        logger.warning(f"⚠️  Could not ensure users table: {error}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# IN-MEMORY SESSION STORE
# ==============================================================================

ACTIVE_SESSIONS: dict = {}


# ==============================================================================
# CASE SUBMISSION ENDPOINT
# ==============================================================================

@app.post("/api/submit")
async def submit_case(
    background_tasks: BackgroundTasks,
    bill_pdf: UploadFile = File(None),
    claim_pdf: UploadFile = File(None),
    policy_pdf: UploadFile = File(...),
    patient_name: str = Form(...),
    insurer_name: str = Form(...),
    procedure_billed: str = Form(None),
    claim_issue: str = Form(None),
    bill_date: str = Form(""),
    claim_date: str = Form(""),
    notes: str = Form(""),
    analysis_type: str = Form("bill"),
):
    denial_document = bill_pdf or claim_pdf
    if not denial_document:
        raise HTTPException(status_code=400, detail="Either bill_pdf or claim_pdf is required")

    procedure_denied = procedure_billed or claim_issue or ""
    denial_date = bill_date or claim_date or ""

    session_id = str(uuid.uuid4())
    session_dir = Path(f"sessions/{session_id}")
    session_dir.mkdir(parents=True, exist_ok=True)

    denial_extension = Path(denial_document.filename).suffix.lower()
    if denial_extension not in [".pdf", ".jpg", ".jpeg", ".png"]:
        denial_extension = ".pdf"

    policy_extension = Path(policy_pdf.filename).suffix.lower()
    if policy_extension not in [".pdf", ".jpg", ".jpeg", ".png"]:
        policy_extension = ".pdf"

    denial_path = session_dir / f"denial{denial_extension}"
    policy_path = session_dir / f"policy{policy_extension}"

    denial_path.write_bytes(await denial_document.read())
    policy_path.write_bytes(await policy_pdf.read())

    try:
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

        actual_session_id = str(case.session_id)

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
async def delete_case_endpoint(session_id: str):
    try:
        success = delete_case(MockUser.id, session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Case not found")
        if session_id in ACTIVE_SESSIONS:
            del ACTIVE_SESSIONS[session_id]
    except Exception as error:
        logger.error(f"Error deleting case: {error}")
        raise HTTPException(status_code=500, detail=f"Error deleting case: {str(error)}")


# ==============================================================================
# ASYNC PIPELINE TASK
# ==============================================================================

async def _run_pipeline_task(session_id: str):
    """Background task that runs the multi-agent pipeline."""
    logger.info(f"_run_pipeline_task STARTED for {session_id}")
    session = ACTIVE_SESSIONS.get(session_id)
    if not session:
        logger.error(f"Session {session_id} not found in active sessions")
        return

    session["status"] = "running"
    update_case_status(session_id, "running")

    def emit(event: dict):
        session["events"].append(event)

    try:
        meta = session["meta"]

        result = await asyncio.to_thread(
            orchestrate_advocai_workflow,
            client=initialize_llm_client(),
            denial_path=meta["denial_path"],
            policy_path=meta["policy_path"],
            case_id=session_id,
            emit=emit,
        )

        session["result"] = result
        session["status"] = "done"
        update_case_status(session_id, "done")

        pdf_path = Path(f"sessions/{session_id}/appeal_packet.pdf")
        try:
            from ..tools.pdf_compiler import compile_appeal_packet
            compile_appeal_packet(
                case_dir=f"data/output/{session_id}",
                output_path=str(pdf_path),
            )
            logger.info(f"PDF compiled successfully: {pdf_path}")
        except Exception as pdf_error:
            logger.error(f"PDF compile failed for {session_id}: {pdf_error}", exc_info=True)

            try:
                appeal_text = ""
                if result and "barrister" in result:
                    barrister = result["barrister"]
                    appeal_text = (
                        barrister if isinstance(barrister, str)
                        else barrister.get("appeal_letter", str(barrister))
                    )

                if appeal_text:
                    from services.pdf_generator import create_appeal_pdf
                    create_appeal_pdf(appeal_text, str(pdf_path))
                    logger.info(f"Fallback PDF written to {pdf_path}")
                else:
                    logger.warning(f"No appeal text available for fallback PDF ({session_id})")
            except Exception as fallback_error:
                logger.error(f"Fallback PDF also failed: {fallback_error}", exc_info=True)

        # NOTE: No emit(pipeline_done) here — the live-stream loop sends
        # "close" when it detects session["status"] == "done". A redundant
        # pipeline_done event caused double eventSource.close() on the frontend.

    except Exception as error:
        session["status"] = "error"
        update_case_status(session_id, "error")
        emit({"type": "error", "message": str(error)})
        logger.error(f"Pipeline error for {session_id}: {error}")


# ==============================================================================
# REAL-TIME STREAMING (SSE)
# ==============================================================================

@app.get("/api/case/{session_id}/stream")
async def stream_case(session_id: str):
    """
    SSE endpoint for real-time pipeline updates.

    Waits up to 10 s for the session to appear (handles the race condition
    where the frontend connects before the background task has populated
    ACTIVE_SESSIONS).

    On late connect (pipeline already done), replays the full result as
    synthetic events so the frontend always renders the letter and score.
    """
    for _ in range(100):
        if session_id in ACTIVE_SESSIONS:
            break
        await asyncio.sleep(0.1)
    else:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    async def event_generator() -> AsyncGenerator[str, None]:
        if session_id not in ACTIVE_SESSIONS:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Session not found'})}\n\n"
            return

        session = ACTIVE_SESSIONS[session_id]

        # ── Late-connect replay: pipeline already finished ────────────────
        if session["status"] == "done" and session.get("result"):
            result = session["result"]

            # FIX 1: barrister result may be a dict, not a plain string.
            # Extract the letter text defensively before yielding it as a chunk.
            _b = result.get("barrister", "")
            # Handle all possible types: str, dict, Pydantic model, or anything else
            if isinstance(_b, str):
                barrister_letter = _b
            elif isinstance(_b, dict):
                barrister_letter = _b.get("appeal_letter") or _b.get("letter") or _b.get("text") or str(_b)
            elif hasattr(_b, "appeal_letter"):          # Pydantic model
                barrister_letter = str(_b.appeal_letter)
            elif hasattr(_b, "model_dump"):             # Pydantic v2
                d = _b.model_dump()
                barrister_letter = d.get("appeal_letter") or d.get("letter") or d.get("text") or str(d)
            elif hasattr(_b, "dict"):                   # Pydantic v1
                d = _b.dict()
                barrister_letter = d.get("appeal_letter") or d.get("letter") or d.get("text") or str(d)
            else:
                barrister_letter = str(_b)

            logger.info(f"REPLAY barrister_letter length: {len(barrister_letter)}, preview: {barrister_letter[:100]}")
            barrister_letter = (
                _b if isinstance(_b, str)
                else _b.get("appeal_letter", json.dumps(_b))
            )

            # 1. Stream the letter first — text panel must be populated before
            #    "close" fires and sets pipelineDone=true, otherwise the
            #    placeholder text renders instead of the letter.
            if barrister_letter:
                yield f"data: {json.dumps({'type': 'agent_stream', 'agent': 'barrister', 'chunk': barrister_letter})}\n\n"

            # 2. Mark every agent done. Skip agent_start events — jumping
            #    straight to "done" is correct for a completed-pipeline replay.
            #
            #    FIX 2: judge payload must be nested under "output" because
            #    the frontend reads data.output?.score (not data.score).
            #    We use "output" for all agents for consistency.
            for agent in ["auditor", "clinician", "regulatory", "barrister", "judge"]:
                agent_result = result.get(agent)
                if agent_result is None:
                    continue
                yield f"data: {json.dumps({'type': 'agent_done', 'agent': agent, 'output': agent_result})}\n\n"

            # 3. Close — triggers setPipelineDone(true) in the frontend.
            #    Letter is already in streamChunks by now so the panel renders
            #    the text rather than the "will appear here" placeholder.
            yield f"data: {json.dumps({'type': 'close'})}\n\n"
            return

        # ── Live-stream path (pipeline still running) ─────────────────────
        sent_index = 0
        max_wait = 120
        for _ in range(max_wait * 10):
            events = session["events"]
            while sent_index < len(events):
                event = events[sent_index]
                sent_index += 1
                yield f"data: {json.dumps(event)}\n\n"
            if session["status"] in ("done", "error"):
                yield f"data: {json.dumps({'type': 'close'})}\n\n"
                return
            await asyncio.sleep(0.1)

        yield f"data: {json.dumps({'type': 'timeout'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ==============================================================================
# STATUS & RESULT ENDPOINTS
# ==============================================================================

@app.get("/api/case/{session_id}/status")
async def get_status(session_id: str):
    case = get_case_by_id(MockUser.id, session_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    session = ACTIVE_SESSIONS.get(session_id, {})
    status = session.get("status") or case.status

    return {
        "session_id": session_id,
        "status": status,
        "events": session.get("events", []),
    }


@app.get("/api/case/{session_id}/result")
async def get_result(session_id: str):
    case = get_case_by_id(MockUser.id, session_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if case.status != "done":
        raise HTTPException(status_code=202, detail="Pipeline still running")

    session = ACTIVE_SESSIONS.get(session_id, {})
    return session.get("result", {})


# ==============================================================================
# RESCORING ENDPOINT
# ==============================================================================

class RescoreRequest(BaseModel):
    edited_text: str


@app.post("/api/case/{session_id}/rescore")
async def rescore_case(session_id: str, request: RescoreRequest):
    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not active")

    from ..storage.session_manager import SessionManager
    from .main import save_json_to_file, initialize_llm_client
    from ..agents.judge import run_judge_agent

    SessionManager.save_checkpoint(session_id, "barrister", {}, request.edited_text)
    case_output_dir = os.path.join("data", "output", session_id)
    os.makedirs(case_output_dir, exist_ok=True)
    save_json_to_file(request.edited_text, os.path.join(case_output_dir, "barrister_output.txt"))

    try:
        scorecard = await asyncio.to_thread(run_judge_agent, session_dir=case_output_dir)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

    scorecard_dump = scorecard.model_dump() if hasattr(scorecard, "model_dump") else scorecard
    save_json_to_file(scorecard_dump, os.path.join(case_output_dir, "judge_scorecard.json"))

    session = ACTIVE_SESSIONS[session_id]
    if session.get("result") and "barrister" in session["result"]:
        session["result"]["barrister"] = request.edited_text
        session["result"]["judge"] = scorecard_dump

    return {"judge": scorecard_dump}


# ==============================================================================
# DOWNLOAD ENDPOINT
# ==============================================================================

@app.get("/api/case/{session_id}/download")
async def download_packet(session_id: str):
    case = get_case_by_id(MockUser.id, session_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    pdf_path = Path(f"sessions/{session_id}/appeal_packet.pdf")

    if not pdf_path.exists():
        status = ACTIVE_SESSIONS.get(session_id, {}).get("status") or case.status
        if status in ("queued", "running"):
            raise HTTPException(status_code=202, detail="PDF not ready yet — pipeline still running")
        raise HTTPException(
            status_code=404,
            detail="PDF generation failed or is unavailable. Check backend logs."
        )

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"appeal_{session_id[:8]}.pdf",
    )


# ==============================================================================
# HEALTH CHECK ENDPOINT
# ==============================================================================

@app.get("/health")
async def health():
    return {"status": "ok", "active_sessions": len(ACTIVE_SESSIONS)}