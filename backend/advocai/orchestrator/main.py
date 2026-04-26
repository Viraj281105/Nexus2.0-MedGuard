# orchestrator/main.py — Pipeline Orchestrator (Groq primary, Ollama fallback)
"""
Main orchestration module for the AdvocAI multi-agent pipeline.

Coordinates the sequential execution of:
1. Auditor Agent - Extract denial details
2. Clinician Agent - Gather clinical evidence
3. Regulatory Agent - Find legal/regulatory basis
4. Barrister Agent - Draft appeal letter
5. Judge Agent - Evaluate and provide feedback

Supports debate loop (iterative improvement) between Barrister and Judge.
"""

import os
import sys
import json
import logging
import requests
from typing import Any, Union, Callable

from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file at project root
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from pydantic import BaseModel

# Import all agent functions
from ..agents.auditor import run_auditor_agent, StructuredDenial
from ..agents.clinician import run_clinician_agent, EvidenceList
from ..agents.regulatory import run_regulatory_agent
from ..agents.barrister import run_barrister_agent
from ..agents.judge import run_judge_agent

# Session management for checkpointing and resume
from ..storage.session_manager import SessionManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - Orchestrator - %(levelname)s - %(message)s"
)
logger = logging.getLogger("AdvocaiOrchestrator")


# ==============================================================================
# LLM CLIENT IMPLEMENTATIONS
# ==============================================================================

# ------------------------------------------------------------------------------
# Groq Client — primary LLM backend for cloud deployment
# ------------------------------------------------------------------------------
class GroqClient:
    """
    Wrapper around Groq API that provides the same .generate() interface
    as the OllamaClient, so all agents work with either backend.
    
    Features:
    - Supports streaming responses via stream_callback
    - JSON mode for structured outputs
    - Configurable temperature and max tokens
    """

    def __init__(self, api_key: str = None, model: str = None):
        """
        Initialize Groq API client.
        
        Args:
            api_key: Groq API key (falls back to GROQ_API_KEY env var)
            model: Model name (falls back to GROQ_MODEL env var, default: llama3-70b-8192)
        """
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
        """
        Generate a response from the LLM.
        
        Args:
            prompt: User prompt content
            system: System instruction (optional)
            temperature: Sampling temperature (0.0 = deterministic)
            max_tokens: Maximum tokens in response
            json_mode: If True, enforce JSON output format
            stream_callback: Optional callback for streaming chunks
            
        Returns:
            Generated text response
        """
        # Build messages array
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        # Prepare API call parameters
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        # Enable JSON mode if requested
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            # Handle streaming request
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
            
            # Non-streaming request
            else:
                response = self._client.chat.completions.create(**kwargs)
                return response.choices[0].message.content.strip()
                
        except Exception as error:
            logger.error(f"Groq generate failed: {error}")
            return ""


# ------------------------------------------------------------------------------
# Ollama Client — optional local LLM backend
# ------------------------------------------------------------------------------
class OllamaClient:
    """Wrapper around Ollama's local REST API for self-hosted LLM inference."""

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "mistral"):
        """
        Initialize Ollama client.
        
        Args:
            base_url: Ollama API endpoint URL
            model: Model name to use (must be pulled locally)
        """
        self.base_url = base_url
        self.model = model
        self._verify_connection()

    def _verify_connection(self):
        """Verify that Ollama is reachable and running."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()
            logger.info(f"Ollama connected at {self.base_url} — model: {self.model}")
        except Exception as error:
            logger.fatal(f"Cannot reach Ollama at {self.base_url}: {error}")
            raise RuntimeError(f"Ollama not reachable: {error}")

    def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.0,
        max_tokens: int = 2048,
        json_mode: bool = False,
        stream_callback: Callable[[str], None] = None,
    ) -> str:
        """
        Generate a response from Ollama.
        
        Args:
            prompt: User prompt content
            system: System instruction (optional)
            temperature: Sampling temperature (0.0 = deterministic)
            max_tokens: Maximum tokens in response
            json_mode: If True, enforce JSON output format
            stream_callback: Optional callback for streaming chunks
            
        Returns:
            Generated text response
        """
        # Build messages array
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        # Prepare API payload
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }

        # Enable JSON mode if requested (Ollama uses "format" field)
        if json_mode:
            payload["format"] = "json"

        # Enable streaming if callback provided
        if stream_callback:
            payload["stream"] = True

        try:
            # Handle streaming request
            if stream_callback:
                response = requests.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    stream=True,
                    timeout=120
                )
                response.raise_for_status()
                full_text = []
                for line in response.iter_lines():
                    if line:
                        data = json.loads(line)
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            stream_callback(chunk)
                            full_text.append(chunk)
                return "".join(full_text).strip()
            
            # Non-streaming request
            else:
                response = requests.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=120
                )
                response.raise_for_status()
                return response.json().get("message", {}).get("content", "").strip()
                
        except Exception as error:
            logger.error(f"Ollama generate failed: {error}")
            return ""


# ------------------------------------------------------------------------------
# LLM Client Factory
# ------------------------------------------------------------------------------
def initialize_llm_client():
    """
    Initialize the appropriate LLM client based on LLM_BACKEND env var.
    
    Priority order:
    1. LLM_BACKEND = "groq" → Use Groq (cloud)
    2. Fallback to Ollama (local) if Groq fails
    3. Last resort: try Groq even if not primary
    
    Returns:
        LLM client instance (GroqClient or OllamaClient)
        Returns None if no backend available
    """
    backend = os.getenv("LLM_BACKEND", "groq").lower()

    # Try Groq (primary for deployment)
    if backend == "groq":
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key:
            try:
                return GroqClient(api_key=api_key)
            except Exception as error:
                logger.warning(f"Groq init failed: {error}. Trying Ollama fallback...")
        else:
            logger.warning("GROQ_API_KEY not set. Trying Ollama fallback...")

    # Fallback to Ollama (local development)
    try:
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "mistral")
        return OllamaClient(base_url=base_url, model=model)
    except Exception as error:
        logger.error(f"Ollama also failed: {error}")

    # Last resort: try Groq even if not primary (for flexibility)
    if backend != "groq":
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key:
            try:
                return GroqClient(api_key=api_key)
            except Exception:
                pass

    logger.fatal("No LLM backend available. Set GROQ_API_KEY or start Ollama.")
    return None


# Keep old function names as aliases for backward compatibility
initialize_gemini_client = initialize_llm_client
initialize_ollama_client = initialize_llm_client


# ==============================================================================
# FILE UTILITIES
# ==============================================================================

def save_json_to_file(obj: Any, path: str) -> bool:
    """
    Save an object to a JSON file (or plain text if not JSON-serializable).
    
    Handles:
    - Pydantic BaseModel objects
    - Dictionaries and lists
    - Strings (attempts JSON parse, falls back to raw text)
    - Other types (converted to string)
    
    Args:
        obj: Object to save
        path: Destination file path
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Ensure parent directory exists
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        
        # Handle Pydantic models
        if isinstance(obj, BaseModel):
            obj = obj.model_dump()
        
        # Handle structured data (JSON serializable)
        if isinstance(obj, (dict, list)):
            with open(path, "w", encoding="utf-8") as file:
                json.dump(obj, file, indent=2, ensure_ascii=False)
            return True
        
        # Handle string input
        if isinstance(obj, str):
            try:
                # Attempt to parse as JSON
                parsed = json.loads(obj)
                with open(path, "w", encoding="utf-8") as file:
                    json.dump(parsed, file, indent=2, ensure_ascii=False)
            except json.JSONDecodeError:
                # Not JSON, save as raw text
                with open(path, "w", encoding="utf-8") as file:
                    file.write(obj)
            return True
        
        # Fallback: convert to string
        with open(path, "w", encoding="utf-8") as file:
            json.dump(str(obj), file, indent=2, ensure_ascii=False)
        return True
        
    except Exception as error:
        logger.error(f"Failed to save file {path}: {error}")
        return False


def _extract_snippet(stage: str, output: Any) -> dict:
    """
    Extract a small preview snippet from agent output for UI display.
    
    Args:
        stage: Agent name (auditor, clinician, regulatory, barrister, judge)
        output: Agent output object
        
    Returns:
        Dictionary with relevant preview fields
    """
    try:
        if stage == "auditor":
            data = output.model_dump() if isinstance(output, BaseModel) else output
            return {
                "procedure_denied": data.get("procedure_denied", ""),
                "denial_code": data.get("denial_code", "")
            }
        
        if stage == "clinician":
            data = output.model_dump() if isinstance(output, BaseModel) else output
            articles = data.get("root", data.get("articles", []))
            return {"article_count": len(articles)}
        
        if stage == "regulatory":
            data = output if isinstance(output, dict) else {}
            points = data.get("legal_points", [])
            return {
                "statute_count": len(points),
                "top_statute": points[0].get("statute", "") if points else ""
            }
        
        if stage == "barrister":
            text = output if isinstance(output, str) else str(output)
            preview = text[:120] + "..." if len(text) > 120 else text
            return {"preview": preview}
        
        if stage == "judge":
            data = output.model_dump() if isinstance(output, BaseModel) else output
            return {"score": data.get("overall_score", 0), "status": data.get("status", "")}
    
    except Exception:
        pass
    
    return {}


# ==============================================================================
# SAFE EXECUTION WRAPPER (with checkpointing)
# ==============================================================================

def safe_execute(
    stage: str,
    session_id: str,
    function,
    *args,
    emit: Callable[[dict], None] = lambda event: None,
    force: bool = False,
    **kwargs
):
    """
    Execute an agent with checkpointing and error handling.
    
    Features:
    - Skips execution if checkpoint exists (unless force=True)
    - Saves output to session storage
    - Emits events for UI streaming
    - Propagates errors with proper logging
    
    Args:
        stage: Agent name
        session_id: Current session identifier
        function: Agent function to execute
        *args: Positional arguments for the function
        emit: Callback for streaming events
        force: If True, force re-execution even if checkpoint exists
        **kwargs: Keyword arguments for the function
        
    Returns:
        Agent output
    """
    import time

    # Check if we can skip this stage (checkpoint exists)
    if not force and SessionManager.should_skip_stage(session_id, stage):
        logger.info(f"[{stage.upper()}] Skipped — checkpoint exists.")
        output = SessionManager.load_checkpoint(session_id, stage)
        emit({
            "type": "agent_done",
            "agent": stage,
            "elapsed_ms": 0,
            "output": _extract_snippet(stage, output)
        })
        return output

    # Execute the agent
    logger.info(f"[{stage.upper()}] Starting...")
    emit({"type": "agent_start", "agent": stage})
    start_time = time.time()

    try:
        output = function(*args, **kwargs)
        
        # Validate output
        if output is None or output == "":
            raise RuntimeError(f"{stage} returned no output.")

        # Prepare checkpoint data based on output type
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

        # Save checkpoint for resume capability
        SessionManager.save_checkpoint(
            session_id=session_id,
            stage=stage,
            output_json=checkpoint_json,
            raw_text=raw_text
        )
        
        # Emit completion event
        elapsed_ms = int((time.time() - start_time) * 1000)
        emit({
            "type": "agent_done",
            "agent": stage,
            "elapsed_ms": elapsed_ms,
            "output": _extract_snippet(stage, output)
        })
        
        logger.info(f"[{stage.upper()}] Success — checkpoint saved.")
        return output

    except Exception as error:
        logger.exception(f"[{stage.upper()}] FAILED.")
        emit({"type": "agent_error", "agent": stage, "message": str(error)})
        SessionManager.mark_failure(session_id, stage, str(error), error_type=type(error).__name__)
        raise error


# ==============================================================================
# MAIN ORCHESTRATOR FUNCTION
# ==============================================================================

def orchestrate_advocai_workflow(
    client,
    denial_path: str,
    policy_path: str,
    case_id: str,
    emit: Callable[[dict], None] = lambda event: None
) -> dict:
    """
    Main orchestration function for the AdvocAI multi-agent pipeline.
    
    Executes agents in sequence with debate loop between Barrister and Judge.
    
    Workflow:
    1. Auditor - Extracts structured denial information
    2. Clinician - Searches PubMed for clinical evidence
    3. Regulatory - Finds relevant legal/regulatory citations
    4. Barrister - Drafts appeal letter
    5. Judge - Evaluates letter and provides score
    
    If Judge score < 80, triggers debate loop:
    - Barrister revises letter based on Judge feedback
    - Judge re-evaluates
    - Continues up to max_debates (2) or until score >= 80
    
    Args:
        client: LLM client (GroqClient or OllamaClient)
        denial_path: Path to denial letter document
        policy_path: Path to insurance policy document
        case_id: Unique case identifier for this session
        emit: Callback for streaming events to UI
        
    Returns:
        Dictionary containing all agent outputs
    """
    logger.info("=== AdvocAI Workflow Initiated ===")

    # Start session with metadata
    session_id = SessionManager.start_new_session(metadata={"case_id": case_id})
    logger.info(f"Session ID: {session_id}")

    # Create case-specific output directory
    case_output_dir = os.path.join("data", "output", case_id)
    os.makedirs(case_output_dir, exist_ok=True)

    # --------------------------------------------------------------------------
    # STEP 1 — Auditor Agent
    # --------------------------------------------------------------------------
    structured_denial = safe_execute(
        "auditor", session_id, run_auditor_agent,
        client=client, denial_path=denial_path, policy_path=policy_path, emit=emit
    )
    save_json_to_file(structured_denial, os.path.join(case_output_dir, "auditor_output.json"))

    # --------------------------------------------------------------------------
    # STEP 2 — Clinician Agent
    # --------------------------------------------------------------------------
    clinical_evidence = safe_execute(
        "clinician", session_id, run_clinician_agent,
        client=client, denial_details=structured_denial, emit=emit
    )
    save_json_to_file(clinical_evidence, os.path.join(case_output_dir, "clinician_output.json"))

    # --------------------------------------------------------------------------
    # STEP 3 — Regulatory Agent
    # --------------------------------------------------------------------------
    regulatory_result = safe_execute(
        "regulatory", session_id, run_regulatory_agent,
        client=client, denial_data=structured_denial.model_dump(), emit=emit
    )
    save_json_to_file(regulatory_result, os.path.join(case_output_dir, "regulatory_output.json"))

    # --------------------------------------------------------------------------
    # STEP 4 & 5 — Barrister + Judge Debate Loop
    # --------------------------------------------------------------------------
    max_debates = 2          # Maximum revision attempts
    debate_count = 0
    final_appeal_text = None
    scorecard = None
    critique = None

    while True:
        # Barrister: Draft or revise appeal letter
        final_appeal_text = safe_execute(
            "barrister", session_id, run_barrister_agent,
            client=client, denial_details=structured_denial,
            clinical_evidence=clinical_evidence, regulatory_evidence=regulatory_result,
            critique=critique, emit=emit, force=(debate_count > 0)
        )
        save_json_to_file(final_appeal_text, os.path.join(case_output_dir, "barrister_output.txt"))

        # Judge: Evaluate the letter
        scorecard = safe_execute(
            "judge", session_id, run_judge_agent,
            session_dir=case_output_dir, emit=emit, force=(debate_count > 0)
        )

        # Save judge output
        scorecard_dump = scorecard.model_dump() if hasattr(scorecard, "model_dump") else scorecard
        save_json_to_file(scorecard_dump, os.path.join(case_output_dir, "judge_scorecard.json"))

        # Extract overall score
        overall_score = scorecard_dump.get("overall_score", 0) if isinstance(scorecard_dump, dict) else 0
        
        # Exit conditions: good score OR max debates reached
        if overall_score >= 80 or debate_count >= max_debates:
            break

        # Trigger another revision round
        critique = scorecard_dump.get("recommendation", "Improve the letter.")
        logger.info(f"=== DEBATE TRIGGERED === Score: {overall_score}. Critique: {critique}")
        emit({"type": "agent_pending", "agent": "judge"})
        debate_count += 1

    logger.info("=== AdvocAI Workflow Complete ===")

    # Return all agent outputs
    return {
        "auditor": structured_denial.model_dump() if isinstance(structured_denial, BaseModel) else structured_denial,
        "clinician": clinical_evidence.model_dump() if isinstance(clinical_evidence, BaseModel) else clinical_evidence,
        "regulatory": regulatory_result,
        "barrister": final_appeal_text,
        "judge": scorecard.model_dump() if isinstance(scorecard, BaseModel) else scorecard,
    }