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
from advocai.orchestrator.auth.db import UserRecord

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

# In-memory session store
SESSIONS: dict = {}


@app.post("/api/submit")
async def submit_case(
    denial_pdf: UploadFile = File(...),
    policy_pdf: UploadFile = File(...),
    patient_name: str = Form(...),
    insurer_name: str = Form(...),
    procedure_denied: str = Form(...),
    denial_date: str = Form(""),
    notes: str = Form(""),
):
    session_id = f"case_{uuid.uuid4().hex[:12]}"
    session_dir = Path(f"sessions/{session_id}")
    session_dir.mkdir(parents=True, exist_ok=True)

    denial_ext = Path(denial_pdf.filename).suffix.lower()
    if denial_ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        denial_ext = ".pdf"
    policy_ext = Path(policy_pdf.filename).suffix.lower()
    if policy_ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        policy_ext = ".pdf"

    denial_path = session_dir / f"denial{denial_ext}"
    policy_path = session_dir / f"policy{policy_ext}"

    denial_path.write_bytes(await denial_pdf.read())
    policy_path.write_bytes(await policy_pdf.read())

    SESSIONS[session_id] = {
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

    asyncio.create_task(_run_pipeline_task(session_id))
    return {"session_id": session_id, "status": "queued"}


@app.get("/api/cases")
async def list_cases():
    """Return all in-memory cases (simplified for hackathon)."""
    cases = []
    for sid, session in SESSIONS.items():
        cases.append({
            "session_id": sid,
            "status": session["status"],
            "patient_name": session.get("meta", {}).get("patient_name", ""),
            "procedure_denied": session.get("meta", {}).get("procedure_denied", ""),
        })
    return {"cases": cases}


@app.delete("/api/case/{session_id}", status_code=204)
async def delete_case(session_id: str):
    if session_id in SESSIONS:
        del SESSIONS[session_id]


async def _run_pipeline_task(session_id: str):
    session = SESSIONS[session_id]
    session["status"] = "running"

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
        emit({"type": "error", "message": str(e)})


@app.get("/api/case/{session_id}/stream")
async def stream_case(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        session = SESSIONS[session_id]
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
async def get_status(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    session = SESSIONS[session_id]
    return {"session_id": session_id, "status": session["status"], "events": session["events"]}


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
