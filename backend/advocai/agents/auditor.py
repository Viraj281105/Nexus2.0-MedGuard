# agents/auditor.py — Auditor Agent
"""
Auditor Agent: Extracts structured denial information from insurer denial letters
and policy documents. Maps raw text into a standardized format for downstream agents.
"""

from pydantic import BaseModel, Field
from ..tools.document_reader import extract_text_from_document
from typing import List, Optional, Dict, Any, ClassVar
import re
import json
import logging

# Configure logging
logger = logging.getLogger("AuditorAgent")
logger.setLevel(logging.INFO)


class StructuredDenial(BaseModel):
    """
    Auditor Agent → unified structured memory object.
    
    This schema represents the standardized output format that all subsequent agents
    (Clinician, Regulatory, Barrister, Judge) will consume.
    
    Attributes:
        denial_code: Reference code from insurer's denial notice
        insurer_reason_snippet: Direct quote of the insurer's denial rationale
        policy_clause_text: Relevant policy language supporting or contradicting denial
        procedure_denied: Name/code of the denied medical procedure/service
        confidence_score: Model's confidence in extraction (0.0 to 1.0)
        raw_evidence_chunks: Preserved original text segments for audit trail
    """
    _SCHEMA: ClassVar[dict] = {}
    denial_code: str
    insurer_reason_snippet: str
    policy_clause_text: str
    procedure_denied: str
    confidence_score: float
    raw_evidence_chunks: List[str] = Field(default_factory=list)


# Populate schema class variable after class definition
if not StructuredDenial._SCHEMA:
    StructuredDenial._SCHEMA = StructuredDenial.model_json_schema()


def find_relevant_policy_snippet(full_policy_text: str) -> str:
    """
    Extract the most relevant section of a policy document for denial analysis.
    
    Searches for exclusion-related keywords and returns surrounding context.
    
    Args:
        full_policy_text: Complete insurance policy document text
        
    Returns:
        Relevant policy excerpt (up to ~1500 characters per matched section)
    """
    # Keywords that indicate exclusion or limitation clauses
    exclusion_keywords = [
        "EXCLUSIONS", "EXCLUSIONS AND LIMITATIONS", "EXPERIMENTAL",
        "INVESTIGATIVE", "UNPROVEN", "CLINICAL TRIAL", "NOT COVERED"
    ]
    
    # Search for each keyword in the policy text
    for keyword in exclusion_keywords:
        # Match up to 1500 chars before and after keyword
        pattern = rf".{{0,1500}}{re.escape(keyword)}.{{0,1500}}"
        match = re.search(pattern, full_policy_text, re.IGNORECASE | re.DOTALL)
        
        if match:
            matched_block = match.group(0)
            # Split into paragraphs for cleaner extraction
            paragraphs = re.split(r"\n{2,}", matched_block)
            
            # Find paragraph containing the keyword
            for para in paragraphs:
                if any(keyword in para.upper() for keyword in exclusion_keywords):
                    return para.strip()
            
            return matched_block.strip()
    
    # Fallback: return first 4000 characters if no exclusions found
    snippet = full_policy_text[:4000]
    return snippet.rsplit("\n", 1)[0].strip()


def extract_first_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract and parse the first valid JSON object from a text string.
    
    Used as recovery mechanism when LLM doesn't output pure JSON.
    
    Args:
        text: Raw LLM output potentially containing JSON
        
    Returns:
        Parsed JSON dictionary, or None if no valid JSON found
    """
    if not text:
        return None
    
    # Find first opening brace
    start = text.find("{")
    if start == -1:
        return None
    
    # Find matching closing brace using depth counter
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                json_block = text[start:i + 1]
                try:
                    return json.loads(json_block)
                except Exception:
                    # Attempt to fix trailing commas
                    cleaned = re.sub(r",\s*([}\]])", r"\1", json_block)
                    try:
                        return json.loads(cleaned)
                    except Exception:
                        return None
    return None


def run_auditor_agent(
    client, 
    denial_path: str, 
    policy_path: str, 
    **kwargs
) -> Optional[StructuredDenial]:
    """
    Main entry point for the Auditor Agent.
    
    Orchestrates document extraction, policy snippet discovery, LLM inference,
    and structured output validation.
    
    Args:
        client: LLM client with .generate() method (supports Groq/Ollama/OpenAI)
        denial_path: File path to insurer's denial letter (PDF/image/txt)
        policy_path: File path to insurance policy document
        **kwargs: Additional unused parameters (for compatibility)
        
    Returns:
        StructuredDenial object with extracted denial information,
        or None if processing fails
    """
    
    # Step 1: Extract text from input documents
    logger.info("[Auditor] Extracting text from documents...")
    denial_result = extract_text_from_document(denial_path)
    policy_result = extract_text_from_document(policy_path)

    # Validate extraction succeeded
    if denial_result.get("error") or policy_result.get("error"):
        logger.error(
            "Document reader failed: %s",
            denial_result.get("error") or policy_result.get("error")
        )
        return None

    denial_text = denial_result.get("full_text_content", "").strip()
    policy_text = policy_result.get("full_text_content", "").strip()

    if not denial_text or not policy_text:
        logger.error("One or both input documents are empty.")
        return None

    # Step 2: Build evidence chunks for audit trail
    segments = []
    segments.extend(denial_result.get("segments", []))
    segments.extend(policy_result.get("segments", []))
    # Filter for meaningful segments (min 30 chars)
    evidence_chunks = [
        seg.strip() for seg in segments 
        if seg and len(seg.strip()) > 30
    ][:24]  # Limit to 24 chunks to control token usage

    # Step 3: Isolate relevant policy excerpt
    policy_excerpt = find_relevant_policy_snippet(policy_text)
    
    # Trim inputs to prevent token overflow
    denial_text_trimmed = denial_text[:8000]
    policy_excerpt_trimmed = policy_excerpt[:4000]

    # Step 4: Prepare LLM system instruction (strict JSON output)
    system_instruction = (
        "You are the Auditor Agent.\n"
        "Extract only facts from the insurer's denial letter and policy.\n"
        "Output STRICT JSON ONLY. No markdown. No explanation. No extra text.\n"
        "Follow this exact JSON format:\n"
        "{\n"
        '  "denial_code": "string",\n'
        '  "insurer_reason_snippet": "string",\n'
        '  "policy_clause_text": "string",\n'
        '  "procedure_denied": "string",\n'
        '  "confidence_score": 0.95,\n'
        '  "raw_evidence_chunks": []\n'
        "}\n\n"
        "Rules:\n"
        "- If a field is missing in source text, use empty string or 0.0.\n"
        "- Do NOT hallucinate.\n"
        "- 'raw_evidence_chunks' MUST be an empty list [].\n"
        "- Output ONLY the JSON object. Nothing else."
    )

    # Step 5: Build user prompt with denial letter and policy excerpt
    user_prompt = (
        "--- DENIAL LETTER ---\n"
        f"{denial_text_trimmed}\n\n"
        "--- RELEVANT POLICY EXCERPT ---\n"
        f"{policy_excerpt_trimmed}\n\n"
        "Now output the JSON object:"
    )

    # Step 6: Invoke LLM with JSON mode enabled
    logger.info("[Auditor] Sending prompt to LLM...")
    raw_response = client.generate(
        prompt=user_prompt,
        system=system_instruction,
        temperature=0.0,      # Deterministic output for consistent extraction
        max_tokens=1024,
        json_mode=True
    )

    if not raw_response:
        logger.error("[Auditor] Empty response from LLM.")
        return None

    # Step 7: Parse and validate structured output
    try:
        structured_denial = StructuredDenial.model_validate_json(raw_response)
    except Exception:
        # Attempt recovery: extract first JSON from response
        logger.warning("[Auditor] Strict JSON parse failed, attempting recovery.")
        recovered_json = extract_first_json(raw_response)
        
        if not recovered_json:
            logger.error("[Auditor] Could not recover JSON from response.")
            return None
        
        try:
            structured_denial = StructuredDenial.model_validate(recovered_json)
        except Exception as validation_error:
            logger.error(f"[Auditor] Recovery JSON invalid: {validation_error}")
            return None

    # Step 8: Attach evidence chunks for auditability
    structured_denial.raw_evidence_chunks = evidence_chunks
    
    logger.info(
        f"[Auditor] SUCCESS — Denial Code: {structured_denial.denial_code}, "
        f"Procedure: {structured_denial.procedure_denied}"
    )
    return structured_denial