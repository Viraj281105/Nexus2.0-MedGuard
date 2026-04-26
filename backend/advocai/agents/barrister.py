# agents/barrister.py — Barrister Agent (Appeal Letter Drafter)
"""
Barrister Agent: Crafts legally persuasive appeal letters by synthesizing
clinical evidence, regulatory findings, and denial details into a structured
formal document ready for submission to insurance companies.
"""

from typing import Optional, Dict, Any, List
import logging
import json
import os

from .auditor import StructuredDenial
from .clinician import EvidenceList

# Configure logging
logger = logging.getLogger("BarristerAgent")
logger.setLevel(logging.INFO)

# Directory for debug output (if needed)
DEBUG_OUTPUT_DIR = "data/output"

def _detect_jurisdiction(denial: any) -> str:
    """
    Detect jurisdiction — prefers the auditor's pre-detected value,
    falls back to heuristic scan if not present.
    """
    # Trust auditor's detection first (set in run_auditor_agent)
    auditor_jurisdiction = getattr(denial, "jurisdiction", "") or ""
    if auditor_jurisdiction and auditor_jurisdiction != "unknown":
        return "india" if "india" in auditor_jurisdiction.lower() else "us"

    # Fallback: heuristic scan across all denial fields
    text = " ".join([
        getattr(denial, "insurer_reason_snippet", "") or "",
        getattr(denial, "policy_clause_text", "") or "",
        getattr(denial, "denial_code", "") or "",
        getattr(denial, "procedure_denied", "") or "",
    ]).lower()

    indian_signals = [
        "irdai", "cghs", "irda", "tpa", "star health", "niva bupa",
        "hdfc ergo", "care health", "medi assist", "rs.", "rupees", "₹",
        "apollo", "fortis", "kokilaben", "manipal", "narayana", "rc-",
        "bima", "lokpal",
    ]
    return "india" if any(s in text for s in indian_signals) else "us"

def extract_legal_points(reg: Any) -> List[Dict[str, Any]]:
    """
    Extract structured legal points from regulatory agent output.
    
    Handles multiple input formats (dict, list, string JSON) gracefully.
    
    Args:
        reg: Regulatory agent output - can be dict, list, string, or None
        
    Returns:
        List of legal point dictionaries, each containing statute/summary/argument
    """
    # Handle None or empty input
    if not reg:
        return []
    
    # Parse string JSON if needed
    if isinstance(reg, str):
        try:
            reg = json.loads(reg)
        except Exception:
            return []
    
    # Handle system error case
    if reg.get("violation") == "SYSTEM_ERROR":
        return []
    
    # Extract legal_points field (supports both list and dict formats)
    legal_points = reg.get("legal_points", [])
    
    if isinstance(legal_points, list):
        # Filter out non-dictionary items
        return [point for point in legal_points if isinstance(point, dict)]
    
    if isinstance(legal_points, dict):
        # Single point wrapped in dict
        return [legal_points]
    
    return []


def format_clinical_evidence(evidence: Any) -> str:
    """
    Format clinical evidence objects into readable markdown-like text.
    
    Handles EvidenceList Pydantic models, raw lists, and edge cases.
    
    Args:
        evidence: EvidenceList object or raw list of evidence items
        
    Returns:
        Formatted string with bullet points for each clinical study
    """
    try:
        # Extract root items from Pydantic model if present
        if hasattr(evidence, "root"):
            items = evidence.root
        elif isinstance(evidence, list):
            items = evidence
        else:
            return "- No clinical evidence provided."
        
        # Handle empty evidence
        if not items:
            return "- No clinical evidence provided."
        
        # Format each evidence item
        formatted_lines = []
        for item in items:
            # Extract fields supporting both attribute and dict access
            title = (
                getattr(item, "article_title", None) or 
                item.get("article_title", "Untitled Article")
            )
            summary = (
                getattr(item, "summary_of_finding", None) or 
                item.get("summary_of_finding", "No summary provided.")
            )
            pmid = (
                getattr(item, "pubmed_id", None) or 
                item.get("pubmed_id", "N/A")
            )
            
            formatted_lines.append(
                f"- {title}: {summary} (PubMed: {pmid})"
            )
        
        return "\n".join(formatted_lines)
        
    except Exception as formatting_error:
        logger.error(f"Failed to format clinical evidence: {formatting_error}")
        return "- Clinical evidence formatting error."


def run_barrister_agent(
    client,
    denial_details: StructuredDenial = None,
    clinical_evidence: EvidenceList = None,
    regulatory_evidence: Dict[str, Any] = None,
    critique: str = None,
    emit: Any = None,
    **kwargs
) -> Optional[str]:
    """
    Main entry point for the Barrister Agent.
    
    Orchestrates appeal letter generation by synthesizing denial details,
    clinical evidence, regulatory findings, and optional judge critique.
    
    Args:
        client: LLM client with .generate() method (supports streaming callbacks)
        denial_details: StructuredDenial object from Auditor Agent
        clinical_evidence: EvidenceList from Clinician Agent
        regulatory_evidence: Regulatory agent findings dictionary
        critique: Optional rejection feedback from Judge Agent for revision
        emit: Callback function for streaming progress updates
        **kwargs: Additional unused parameters (for compatibility)
        
    Returns:
        Formatted appeal letter as string, or None if generation fails
    """
    
    # Alias inputs for cleaner code
    denial = denial_details
    clinical = clinical_evidence
    regulatory = regulatory_evidence

    # Step 1: Format clinical evidence for LLM prompt
    clinical_text = format_clinical_evidence(clinical)
    
    # Step 2: Extract and format legal points from regulatory evidence
    legal_points = extract_legal_points(regulatory)

    if legal_points:
        # Build bullet list from legal points
        legal_text = "\n".join(
            f"- {point.get('statute', 'Statute')}: "
            f"{point.get('summary', point.get('argument', 'No summary'))}"
            for point in legal_points
        )
    else:
        legal_text = "- No statutory or regulatory arguments produced."

    # Step 3: Build system instruction for the LLM
    jurisdiction = _detect_jurisdiction(denial)
    logger.info(f"[Barrister] Jurisdiction resolved to: {jurisdiction}")

    if jurisdiction == "india":
        jurisdiction_instruction = (
            "You are handling an Indian health insurance dispute governed by IRDAI regulations.\n"
            "Cite ONLY Indian law: IRDAI Regulations, Insurance Act 1938, Consumer Protection Act 2019, "
            "Insurance Ombudsman Rules 2017, and IRDAI circulars.\n"
            "Do NOT cite ERISA, ACA, MHPAEA, or any US statute — these have no legal force in India.\n"
            "Reference CGHS rate schedule disputes where relevant.\n"
            "Mention escalation path: Grievance Officer → IRDAI IGMS portal → Insurance Ombudsman.\n"
        )
    else:
        jurisdiction_instruction = (
            "You are handling a US health insurance dispute.\n"
            "Cite relevant federal law: ACA, ERISA, MHPAEA, and applicable state mandates.\n"
        )

    system_instruction = (
        f"You are the Barrister Agent — a senior appellate attorney specializing in health insurance disputes.\n"
        f"{jurisdiction_instruction}"
        "Your job is to produce a polished, persuasive, fully structured appeal letter.\n"
        "Write in formal legal prose. No placeholders. No incomplete sections.\n"
        "Ground every clinical claim in the provided PubMed evidence — cite article titles and PMIDs explicitly.\n"
        "Ground every legal claim in the provided regulatory findings — cite statute names explicitly.\n"
        "Do not hallucinate statutes, PMIDs, or clinical facts not present in the provided evidence.\n"
        "Do not add any commentary before or after the letter.\n"
        "Output the letter text only."
    )


    # Step 4: Add critique context if this is a revision attempt
    if critique:
        system_instruction += (
            f"\n\nIMPORTANT DEBATE FEEDBACK: The Judge agent rejected your previous draft. "
            f"Critique: '{critique}'. You MUST revise your letter to address these issues."
        )

    # Step 5: Build user prompt with all evidence
    prompt = f"""Draft a complete formal insurance appeal letter using ONLY the information provided below.

    DENIAL DETAILS
    --------------
    Procedure: {denial.procedure_denied}
    Denial Code: {denial.denial_code}
    Insurer Reason: {denial.insurer_reason_snippet}
    Policy Clause: {denial.policy_clause_text}

    CLINICAL EVIDENCE (cite these explicitly — use article titles and PMIDs in the letter body)
    -----------------
    {clinical_text}

    REGULATORY FINDINGS (cite these explicitly — use statute names in the letter body)
    -------------------
    {legal_text}

    REQUIRED STRUCTURE
    ------------------
    1. Subject line: reference the procedure, denial code, and policy/claim number if available.
    2. Opening paragraph: identify the denial, the denied procedure, and state intent to appeal.
    3. Section I — Clinical Argument:
    - For each piece of clinical evidence, name the study and PMID explicitly.
    - Explain how it directly demonstrates medical necessity for the denied procedure.
    - Counter the insurer's specific denial reason with the evidence.
    4. Section II — Legal Argument:
    - For each regulatory finding, name the statute/regulation explicitly.
    - Explain precisely how the insurer's denial violates or conflicts with it.
    - Do NOT cite any law not listed in the REGULATORY FINDINGS above.
    5. Conclusion:
    - Firm, specific request for full reversal of the denial.
    - State the escalation path if the appeal is rejected.
    - Request written response within the regulatory timeframe.

    IMPORTANT: Do not invent any facts, PMIDs, statute numbers, or clinical findings 
    not present in the sections above. If evidence is limited, argue from what is provided.

    Write the full letter now:"""


    # Step 6: Define streaming callback (if emit function provided)
    def stream_callback(chunk: str):
        """Forward streaming chunks to UI via emit callback."""
        if emit:
            emit({"type": "agent_stream", "agent": "barrister", "chunk": chunk})

    # Step 7: Invoke LLM
    logger.info("[Barrister] Sending prompt to LLM...")
    appeal_text = client.generate(
        prompt=prompt,
        system=system_instruction,
        temperature=0.3,       # Slight creativity for persuasive language
        max_tokens=2048,       # Enough for full appeal letter
        json_mode=False,       # Output free text, not JSON
        stream_callback=stream_callback
    )

    # Step 8: Validate response quality
    if not appeal_text or len(appeal_text.strip()) < 100:
        logger.error("[Barrister] Empty or too-short response from LLM.")
        return None

    # Step 9: Return cleaned appeal letter
    appeal_text = appeal_text.strip()
    logger.info(f"[Barrister] Appeal letter generated ({len(appeal_text)} characters).")
    return appeal_text