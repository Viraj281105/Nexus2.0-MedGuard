# orchestrator/main.py — Pipeline Orchestrator (Groq primary, Ollama fallback)

import os
import sys
import json
import logging
import requests
from typing import Any, Union, Callable

from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from pydantic import BaseModel

# Agents
from advocai.agents.auditor import run_auditor_agent, StructuredDenial
from advocai.agents.clinician import run_clinician_agent, EvidenceList
from advocai.agents.regulatory import run_regulatory_agent
from advocai.agents.barrister import run_barrister_agent
from advocai.agents.judge import run_judge_agent

# Session Manager
from advocai.storage.session_manager import SessionManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s - Orchestrator - %(levelname)s - %(message)s")
logger = logging.getLogger("AdvocaiOrchestrator")


# -------------------------------------------------------------
# Groq Client — primary LLM backend for cloud deployment
# -------------------------------------------------------------
class GroqClient:
    """
    Wrapper around Groq API that provides the same .generate() interface
    as the OllamaClient, so all agents work with either backend.
    """

    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.model = model or os.getenv("GROQ_MODEL", "llama3-70b-8192")

        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY is not set. Cannot initialize GroqClient.")

        try:
            from groq import Groq
            self._client = Groq(api_key=self.api_key)
            logger.info(f"GroqClient initialized — model: {self.model}")
        except ImportError:
            raise RuntimeError("groq package not installed. Run: pip install groq")

    def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.0,
        max_tokens: int = 2048,
        json_mode: bool = False,
        stream_callback: Callable[[str], None] = None,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            if stream_callback:
                kwargs["stream"] = True
                stream = self._client.chat.completions.create(**kwargs)
                full_text = []
                for chunk in stream:
                    content = chunk.choices[0].delta.content or ""
                    if content:
                        stream_callback(content)
                        full_text.append(content)
                return "".join(full_text).strip()
            else:
                response = self._client.chat.completions.create(**kwargs)
                return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Groq generate failed: {e}")
            return ""


# -------------------------------------------------------------
# Ollama Client — optional local LLM backend
# -------------------------------------------------------------
class OllamaClient:
    """Wrapper around Ollama's local REST API."""

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "mistral"):
        self.base_url = base_url
        self.model = model
        self._verify_connection()

    def _verify_connection(self):
        try:
            r = requests.get(f"{self.base_url}/api/tags", timeout=5)
            r.raise_for_status()
            logger.info(f"Ollama connected at {self.base_url} — model: {self.model}")
        except Exception as e:
            logger.fatal(f"Cannot reach Ollama at {self.base_url}: {e}")
            raise RuntimeError(f"Ollama not reachable: {e}")

    def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.0,
        max_tokens: int = 2048,
        json_mode: bool = False,
        stream_callback: Callable[[str], None] = None,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }

        if json_mode:
            payload["format"] = "json"

        if stream_callback:
            payload["stream"] = True

        try:
            if stream_callback:
                r = requests.post(f"{self.base_url}/api/chat", json=payload, stream=True, timeout=120)
                r.raise_for_status()
                full_text = []
                for line in r.iter_lines():
                    if line:
                        data = json.loads(line)
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            stream_callback(chunk)
                            full_text.append(chunk)
                return "".join(full_text).strip()
            else:
                r = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=120)
                r.raise_for_status()
                return r.json().get("message", {}).get("content", "").strip()
        except Exception as e:
            logger.error(f"Ollama generate failed: {e}")
            return ""


def initialize_llm_client():
    """
    Initialize the appropriate LLM client based on LLM_BACKEND env var.
    Defaults to Groq (cloud) for deployment; falls back to Ollama for local dev.
    """
    backend = os.getenv("LLM_BACKEND", "groq").lower()

    if backend == "groq":
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key:
            try:
                return GroqClient(api_key=api_key)
            except Exception as e:
                logger.warning(f"Groq init failed: {e}. Trying Ollama fallback...")
        else:
            logger.warning("GROQ_API_KEY not set. Trying Ollama fallback...")

    # Fallback to Ollama
    try:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "mistral")
        return OllamaClient(base_url=base_url, model=model)
    except Exception as e:
        logger.error(f"Ollama also failed: {e}")

    # Last resort: try Groq even if not primary
    if backend != "groq":
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key:
            try:
                return GroqClient(api_key=api_key)
            except Exception:
                pass

    logger.fatal("No LLM backend available. Set GROQ_API_KEY or start Ollama.")
    return None


# Keep old name as alias
initialize_gemini_client = initialize_llm_client
initialize_ollama_client = initialize_llm_client


# -------------------------------------------------------------
# Robust JSON/text saving utility
# -------------------------------------------------------------
def save_json_to_file(obj: Any, path: str) -> bool:
    try:
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        if isinstance(obj, BaseModel):
            obj = obj.model_dump()
        if isinstance(obj, (dict, list)):
            with open(path, "w", encoding="utf-8") as f:
                json.dump(obj, f, indent=2, ensure_ascii=False)
            return True
        if isinstance(obj, str):
            try:
                parsed = json.loads(obj)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(parsed, f, indent=2, ensure_ascii=False)
            except json.JSONDecodeError:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(obj)
            return True
        with open(path, "w", encoding="utf-8") as f:
            json.dump(str(obj), f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Failed to save file {path}: {e}")
        return False


def _extract_snippet(stage: str, output: Any) -> dict:
    try:
        if stage == "auditor":
            d = output.model_dump() if isinstance(output, BaseModel) else output
            return {"procedure_denied": d.get("procedure_denied", ""), "denial_code": d.get("denial_code", "")}
        if stage == "clinician":
            d = output.model_dump() if isinstance(output, BaseModel) else output
            articles = d.get("root", d.get("articles", []))
            return {"article_count": len(articles)}
        if stage == "regulatory":
            d = output if isinstance(output, dict) else {}
            points = d.get("legal_points", [])
            return {"statute_count": len(points), "top_statute": points[0].get("statute", "") if points else ""}
        if stage == "barrister":
            text = output if isinstance(output, str) else str(output)
            return {"preview": text[:120] + "..." if len(text) > 120 else text}
        if stage == "judge":
            d = output.model_dump() if isinstance(output, BaseModel) else output
            return {"score": d.get("overall_score", 0), "status": d.get("status", "")}
    except Exception:
        pass
    return {}


def safe_execute(stage: str, session_id: str, function, *args,
                 emit: Callable[[dict], None] = lambda e: None, force: bool = False, **kwargs):
    import time

    if not force and SessionManager.should_skip_stage(session_id, stage):
        logger.info(f"[{stage.upper()}] Skipped — checkpoint exists.")
        output = SessionManager.load_checkpoint(session_id, stage)
        emit({"type": "agent_done", "agent": stage, "elapsed_ms": 0, "output": _extract_snippet(stage, output)})
        return output

    logger.info(f"[{stage.upper()}] Starting...")
    emit({"type": "agent_start", "agent": stage})
    t0 = time.time()

    try:
        output = function(*args, **kwargs)
        if output is None or output == "":
            raise RuntimeError(f"{stage} returned no output.")

        if isinstance(output, dict):
            checkpoint_json = output
            raw_text = None
        elif isinstance(output, BaseModel):
            checkpoint_json = output.model_dump()
            raw_text = None
        elif isinstance(output, str):
            checkpoint_json = {}
            raw_text = output
        else:
            checkpoint_json = {"value": str(output)}
            raw_text = str(output)

        SessionManager.save_checkpoint(session_id=session_id, stage=stage, output_json=checkpoint_json, raw_text=raw_text)
        elapsed = int((time.time() - t0) * 1000)
        emit({"type": "agent_done", "agent": stage, "elapsed_ms": elapsed, "output": _extract_snippet(stage, output)})
        logger.info(f"[{stage.upper()}] Success — checkpoint saved.")
        return output

    except Exception as e:
        logger.exception(f"[{stage.upper()}] FAILED.")
        emit({"type": "agent_error", "agent": stage, "message": str(e)})
        SessionManager.mark_failure(session_id, stage, str(e), error_type=type(e).__name__)
        raise e


# -------------------------------------------------------------
# MAIN ORCHESTRATOR
# -------------------------------------------------------------
def orchestrate_advocai_workflow(client, denial_path: str, policy_path: str, case_id: str,
                                 emit: Callable[[dict], None] = lambda e: None):
    logger.info("=== AdvocAI Workflow Initiated ===")

    session_id = SessionManager.start_new_session(metadata={"case_id": case_id})
    logger.info(f"Session ID: {session_id}")

    case_output_dir = os.path.join("data", "output", case_id)
    os.makedirs(case_output_dir, exist_ok=True)

    # STEP 1 — Auditor
    structured_denial = safe_execute("auditor", session_id, run_auditor_agent, client=client,
                                      denial_path=denial_path, policy_path=policy_path, emit=emit)
    save_json_to_file(structured_denial, os.path.join(case_output_dir, "auditor_output.json"))

    # STEP 2 — Clinician
    clinical_evidence = safe_execute("clinician", session_id, run_clinician_agent, client=client,
                                      denial_details=structured_denial, emit=emit)
    save_json_to_file(clinical_evidence, os.path.join(case_output_dir, "clinician_output.json"))

    # STEP 3 — Regulatory
    regulatory_result = safe_execute("regulatory", session_id, run_regulatory_agent, client=client,
                                      denial_data=structured_denial.model_dump(), emit=emit)
    save_json_to_file(regulatory_result, os.path.join(case_output_dir, "regulatory_output.json"))

    # STEP 4 & 5 — Debate Loop
    max_debates = 2
    debates = 0
    final_appeal_text = None
    scorecard = None
    critique = None

    while True:
        final_appeal_text = safe_execute("barrister", session_id, run_barrister_agent, client=client,
                                          denial_details=structured_denial, clinical_evidence=clinical_evidence,
                                          regulatory_evidence=regulatory_result, critique=critique, emit=emit,
                                          force=(debates > 0))
        save_json_to_file(final_appeal_text, os.path.join(case_output_dir, "barrister_output.txt"))

        scorecard = safe_execute("judge", session_id, run_judge_agent, session_dir=case_output_dir,
                                  emit=emit, force=(debates > 0))

        scorecard_dump = scorecard.model_dump() if hasattr(scorecard, "model_dump") else scorecard
        save_json_to_file(scorecard_dump, os.path.join(case_output_dir, "judge_scorecard.json"))

        overall_score = scorecard_dump.get("overall_score", 0) if isinstance(scorecard_dump, dict) else 0
        if overall_score >= 80 or debates >= max_debates:
            break

        critique = scorecard_dump.get("recommendation", "Improve the letter.")
        logger.info(f"=== DEBATE TRIGGERED === Score: {overall_score}. Critique: {critique}")
        emit({"type": "agent_pending", "agent": "judge"})
        debates += 1

    logger.info("=== AdvocAI Workflow Complete ===")

    return {
        "auditor": structured_denial.model_dump() if isinstance(structured_denial, BaseModel) else structured_denial,
        "clinician": clinical_evidence.model_dump() if isinstance(clinical_evidence, BaseModel) else clinical_evidence,
        "regulatory": regulatory_result,
        "barrister": final_appeal_text,
        "judge": scorecard.model_dump() if isinstance(scorecard, BaseModel) else scorecard,
    }
