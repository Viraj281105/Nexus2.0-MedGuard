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

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

# Auth
from advocai.orchestrator.auth import router as auth_router, ensure_users_table
from pydantic import BaseModel
from advocai.orchestrator.auth.router import get_current_user
from advocai.orchestrator.auth.db import UserRecord, create_case, get_user_cases, get_case_by_id, delete_case, update_case_status

# Main pipeline
from advocai.orchestrator.main import orchestrate_advocai_workflow, initialize_llm_client

from advocai.storage.session_manager import get_cases_for_user, delete_case_for_user

logger = logging.getLogger("AdvocAI.App")

app = FastAPI(title="AdvocAI API", version="2.0.0")
app.include_router(auth_router)

@app.on_event("startup")
async def startup():
    try:
        ensure_users_table()
    except Exception as e:
        logger.warning(f"Could not ensure users table (DB may not be available): {e}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store for active sessions (events only)
# Persisted data goes to PostgreSQL
ACTIVE_SESSIONS: dict = {}


@app.post("/api/submit")
async def submit_case(
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
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    """Submit a new case for analysis. Requires authentication."""
    # Determine which document was submitted
    denial_doc = bill_pdf or claim_pdf
    if not denial_doc:
        raise HTTPException(status_code=400, detail="Either bill_pdf or claim_pdf is required")
    
    procedure_denied = procedure_billed or claim_issue or ""
    denial_date = bill_date or claim_date or ""
    
    session_id = str(uuid.uuid4())
    session_dir = Path(f"sessions/{session_id}")
    session_dir.mkdir(parents=True, exist_ok=True)

    denial_ext = Path(denial_doc.filename).suffix.lower()
    if denial_ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        denial_ext = ".pdf"
    policy_ext = Path(policy_pdf.filename).suffix.lower()
    if policy_ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        policy_ext = ".pdf"

    denial_path = session_dir / f"denial{denial_ext}"
    policy_path = session_dir / f"policy{policy_ext}"

    denial_path.write_bytes(await denial_doc.read())
    policy_path.write_bytes(await policy_pdf.read())

    try:
        # Create case in database
        case = create_case(
            user_id=current_user.id,
            patient_name=patient_name,
            insurer_name=insurer_name,
            procedure_denied=procedure_denied,
            denial_date=denial_date,
            notes=notes,
            denial_path=str(denial_path),
            policy_path=str(policy_path),
            status="queued",
        )
        
        # Store session ID as UUID for consistency
        actual_session_id = str(case.session_id)
        
        # Initialize in-memory event store
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

        asyncio.create_task(_run_pipeline_task(actual_session_id))
        return {"session_id": actual_session_id, "status": "queued"}
    
    except Exception as e:
        logger.error(f"Error creating case: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating case: {str(e)}")


@app.get("/api/cases")
async def list_cases(current_user: Annotated[UserRecord, Depends(get_current_user)] = None):
    """Return all cases for the authenticated user."""
    try:
        user_cases = get_user_cases(current_user.id)
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
    except Exception as e:
        logger.error(f"Error listing cases: {e}")
        raise HTTPException(status_code=500, detail=f"Error listing cases: {str(e)}")


@app.delete("/api/case/{session_id}", status_code=204)
async def delete_case_endpoint(
    session_id: str,
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    """Delete a case. Only the owner can delete."""
    try:
        success = delete_case(current_user.id, session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Case not found or not owned by user")
        
        # Clean up in-memory session if exists
        if session_id in ACTIVE_SESSIONS:
            del ACTIVE_SESSIONS[session_id]
    except Exception as e:
        logger.error(f"Error deleting case: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting case: {str(e)}")


async def _run_pipeline_task(session_id: str):
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

        # Compile PDF packet
        try:
            from advocai.tools.pdf_compiler import compile_appeal_packet
            compile_appeal_packet(
                case_dir=f"data/output/{session_id}",
                output_path=f"sessions/{session_id}/appeal_packet.pdf"
            )
        except Exception as pdf_err:
            logger.warning(f"PDF compile failed: {pdf_err}")

        emit({"type": "pipeline_done", "session_id": session_id})

    except Exception as e:
        session["status"] = "error"
        update_case_status(session_id, "error")
        emit({"type": "error", "message": str(e)})
        logger.error(f"Pipeline error for {session_id}: {e}")


@app.get("/api/case/{session_id}/stream")
async def stream_case(
    session_id: str,
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    """Stream case processing events. Requires authentication and ownership."""
    try:
        # Check ownership
        case = get_case_by_id(current_user.id, session_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found or not owned by user")
    except Exception as e:
        logger.error(f"Error checking case ownership: {e}")
        raise HTTPException(status_code=403, detail="Unauthorized")

    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not active")

    async def event_generator() -> AsyncGenerator[str, None]:
        session = ACTIVE_SESSIONS[session_id]
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
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@app.get("/api/case/{session_id}/status")
async def get_status(
    session_id: str,
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    """Get case status. Requires authentication and ownership."""
    try:
        case = get_case_by_id(current_user.id, session_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found or not owned by user")
    except Exception as e:
        logger.error(f"Error checking case ownership: {e}")
        raise HTTPException(status_code=403, detail="Unauthorized")

    session = ACTIVE_SESSIONS.get(session_id, {})
    return {
        "session_id": session_id,
        "status": case.status,
        "events": session.get("events", []),
    }


@app.get("/api/case/{session_id}/result")
async def get_result(
    session_id: str,
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    """Get case result. Requires authentication and ownership."""
    try:
        case = get_case_by_id(current_user.id, session_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found or not owned by user")
    except Exception as e:
        logger.error(f"Error checking case ownership: {e}")
        raise HTTPException(status_code=403, detail="Unauthorized")

    if case.status != "done":
        raise HTTPException(status_code=202, detail="Pipeline still running")
    
    session = ACTIVE_SESSIONS.get(session_id, {})
    return session.get("result", {})


class RescoreRequest(BaseModel):
    edited_text: str

@app.post("/api/case/{session_id}/rescore")
async def rescore_case(
    session_id: str,
    req: RescoreRequest,
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    """Rescore a case with edited text. Requires authentication and ownership."""
    try:
        case = get_case_by_id(current_user.id, session_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found or not owned by user")
    except Exception as e:
        logger.error(f"Error checking case ownership: {e}")
        raise HTTPException(status_code=403, detail="Unauthorized")

    if session_id not in ACTIVE_SESSIONS:
        raise HTTPException(status_code=404, detail="Session not active")

    from advocai.storage.session_manager import SessionManager
    from advocai.orchestrator.main import save_json_to_file, initialize_llm_client
    from advocai.agents.judge import run_judge_agent

    SessionManager.save_checkpoint(session_id, "barrister", {}, req.edited_text)
    case_output_dir = os.path.join("data", "output", session_id)
    os.makedirs(case_output_dir, exist_ok=True)
    save_json_to_file(req.edited_text, os.path.join(case_output_dir, "barrister_output.txt"))

    try:
        scorecard = await asyncio.to_thread(run_judge_agent, session_dir=case_output_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    scorecard_dump = scorecard.model_dump() if hasattr(scorecard, "model_dump") else scorecard
    save_json_to_file(scorecard_dump, os.path.join(case_output_dir, "judge_scorecard.json"))

    session = ACTIVE_SESSIONS[session_id]
    if session.get("result") and "barrister" in session["result"]:
        session["result"]["barrister"] = req.edited_text
        session["result"]["judge"] = scorecard_dump

    return {"judge": scorecard_dump}


@app.get("/api/case/{session_id}/download")
async def download_packet(
    session_id: str,
    current_user: Annotated[UserRecord, Depends(get_current_user)] = None,
):
    """Download case appeal packet. Requires authentication and ownership."""
    try:
        case = get_case_by_id(current_user.id, session_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found or not owned by user")
    except Exception as e:
        logger.error(f"Error checking case ownership: {e}")
        raise HTTPException(status_code=403, detail="Unauthorized")

    pdf_path = Path(f"sessions/{session_id}/appeal_packet.pdf")
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not yet generated")
    return FileResponse(path=str(pdf_path), media_type="application/pdf", filename=f"appeal_{session_id}.pdf")


@app.get("/health")
async def health():
    return {"status": "ok", "active_sessions": len(ACTIVE_SESSIONS)}


@app.get("/api/case/{session_id}/result")
async def get_result(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    session = SESSIONS[session_id]
    if session["status"] != "done":
        raise HTTPException(status_code=202, detail="Pipeline still running")
    return session["result"]


class RescoreRequest(BaseModel):
    edited_text: str

@app.post("/api/case/{session_id}/rescore")
async def rescore_case(session_id: str, req: RescoreRequest):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    from advocai.storage.session_manager import SessionManager
    from advocai.orchestrator.main import save_json_to_file, initialize_llm_client
    from advocai.agents.judge import run_judge_agent

    SessionManager.save_checkpoint(session_id, "barrister", {}, req.edited_text)
    case_output_dir = os.path.join("data", "output", session_id)
    os.makedirs(case_output_dir, exist_ok=True)
    save_json_to_file(req.edited_text, os.path.join(case_output_dir, "barrister_output.txt"))

    try:
        scorecard = await asyncio.to_thread(run_judge_agent, session_dir=case_output_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    scorecard_dump = scorecard.model_dump() if hasattr(scorecard, "model_dump") else scorecard
    save_json_to_file(scorecard_dump, os.path.join(case_output_dir, "judge_scorecard.json"))

    session = SESSIONS[session_id]
    if session.get("result") and "barrister" in session["result"]:
        session["result"]["barrister"] = req.edited_text
        session["result"]["judge"] = scorecard_dump

    return {"judge": scorecard_dump}


@app.get("/api/case/{session_id}/download")
async def download_packet(session_id: str):
    pdf_path = Path(f"sessions/{session_id}/appeal_packet.pdf")
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not yet generated")
    return FileResponse(path=str(pdf_path), media_type="application/pdf", filename=f"appeal_{session_id}.pdf")


@app.get("/health")
async def health():
    return {"status": "ok", "sessions": len(SESSIONS)}
