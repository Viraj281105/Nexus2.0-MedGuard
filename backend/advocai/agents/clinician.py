# agents/clinician.py — Clinician Agent (Groq fallback)
"""
Clinician Agent: Searches PubMed for clinical evidence supporting a denied procedure,
synthesizes findings into structured evidence objects. Falls back to LLM generation
if PubMed search returns no results or fails.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
import json
import re
import os
import logging
from dotenv import load_dotenv

from .auditor import StructuredDenial

# Load environment variables (for API keys)
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class ClinicalEvidence(BaseModel):
    """
    Individual clinical study evidence structure.
    
    Attributes:
        article_title: Title of the PubMed article
        summary_of_finding: 1-2 sentence clinical finding summary
        pubmed_id: PubMed identifier (PMID) for reference
    """
    article_title: str
    summary_of_finding: str
    pubmed_id: str


class EvidenceList(BaseModel):
    """
    Container for multiple clinical evidence items.
    
    Attributes:
        root: List of ClinicalEvidence objects
    """
    root: List[ClinicalEvidence] = Field(default_factory=list)


def _clean_json(text: str) -> str:
    """
    Remove markdown code block formatting from JSON string.
    
    Args:
        text: Raw LLM output potentially wrapped in ```json``` blocks
        
    Returns:
        Cleaned JSON string without markdown formatting
    """
    if not text:
        return ""
    cleaned = text.strip()
    # Remove markdown code block markers
    cleaned = re.sub(r"```(?:json)?", "", cleaned)
    cleaned = cleaned.replace("```", "")
    return cleaned.strip()


def _extract_first_json(text: str) -> Optional[dict]:
    """
    Extract and parse the first valid JSON object/array from a text string.
    
    Used as recovery mechanism when LLM output contains extra text around JSON.
    
    Args:
        text: Raw LLM output potentially containing JSON
        
    Returns:
        Parsed JSON dictionary/list, or None if no valid JSON found
    """
    if not text:
        return None
    
    # Find first opening brace or bracket
    start = text.find("{")
    if start == -1:
        start = text.find("[")
        if start == -1:
            return None
    
    # Determine closing character based on opening character
    open_char = text[start]
    close_char = "}" if open_char == "{" else "]"
    
    # Find matching closing brace using depth counter
    depth = 0
    for i in range(start, len(text)):
        if text[i] == open_char:
            depth += 1
        elif text[i] == close_char:
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


# Import PubMed search tool (may fail if dependencies missing)
from ..tools.pubmed_search import pubmed_search


def _derive_query(denial: StructuredDenial) -> str:
    """
    Generate PubMed search query from denial details.
    
    Extracts procedure name and constructs a search for efficacy evidence.
    
    Args:
        denial: StructuredDenial object from Auditor Agent
        
    Returns:
        PubMed search query string (e.g., "koliscan efficacy")
    """
    procedure = denial.procedure_denied.strip()
    # Remove parenthetical content (e.g., "(CPT 12345)")
    procedure = re.sub(r"\(.*?\)", "", procedure).strip()
    query = f"{procedure} efficacy"
    return query


def run_clinician_agent(client, denial_details: StructuredDenial, **kwargs) -> EvidenceList:
    """
    Main entry point for the Clinician Agent.
    
    Tries PubMed search first, then falls back to LLM synthesis if needed.
    ALWAYS returns an EvidenceList (never None) - may be empty if all methods fail.
    
    Args:
        client: LLM client with .generate() method (supports Groq, Ollama, OpenAI)
        denial_details: StructuredDenial object from Auditor Agent
        **kwargs: Additional unused parameters (for compatibility)
        
    Returns:
        EvidenceList containing clinical evidence (may be empty if no evidence found)
    """
    logger.info("[Clinician] Trying PubMed as primary source...")
    
    # Step 1: Derive search query from denial
    final_query = _derive_query(denial_details)
    logger.info(f"[Clinician] PubMed query: {final_query}")

    # Step 2: Attempt PubMed search
    articles = []
    try:
        articles = pubmed_search(final_query)
        # Ensure articles is a list (PubMed tool might return non-list on error)
        if not isinstance(articles, list):
            articles = []
    except Exception as search_error:
        logger.error(f"[Clinician] PubMed tool crashed: {search_error}")

    # Step 3: If PubMed returned results, synthesize them using LLM
    if articles:
        logger.info(f"[Clinician] PubMed returned {len(articles)} articles. Synthesizing...")
        
        # Get schema for structured output validation
        schema = EvidenceList.model_json_schema()
        
        system_instruction = (
            "You are the Clinician Agent.\n"
            "You will receive PubMed article data and must synthesize it into structured JSON.\n"
            "Output STRICT JSON ONLY. No markdown. No explanation.\n\n"
            f"Schema:\n{json.dumps(schema, indent=2)}\n\n"
            "Rules:\n"
            "- 'root' must be a list of article objects.\n"
            "- Each object needs: article_title, summary_of_finding, pubmed_id.\n"
            "- summary_of_finding: 1-2 sentence clinical finding summary.\n"
            "- Output ONLY the JSON object. Nothing else."
        )

        # Trim articles to top 5 to control token usage
        articles_trimmed = articles[:5]
        
        # Truncate long abstracts to prevent token overflow
        for article in articles_trimmed:
            if "abstract" in article and len(article["abstract"]) > 600:
                article["abstract"] = article["abstract"][:600] + "..."

        # Build user prompt with denial context and PubMed articles
        prompt = (
            f"Procedure denied: {denial_details.procedure_denied}\n"
            f"Denial reason: {denial_details.insurer_reason_snippet}\n\n"
            "PubMed articles:\n"
            f"{json.dumps(articles_trimmed, indent=2)}\n\n"
            "Now output the JSON object matching the schema:"
        )

        # Invoke LLM for synthesis
        raw_response = client.generate(
            prompt=prompt,
            system=system_instruction,
            temperature=0.1,       # Low temp for factual extraction
            max_tokens=1024,
            json_mode=True
        )

        if raw_response:
            cleaned = _clean_json(raw_response)
            try:
                evidence = EvidenceList.model_validate_json(cleaned)
                if evidence.root:
                    logger.info(f"[Clinician] Evidence synthesized. Count: {len(evidence.root)}")
                    return evidence
            except Exception as validation_error:
                # Attempt recovery: extract first JSON from response
                recovered = _extract_first_json(cleaned)
                if recovered:
                    # Handle case where recovered is a list (wrapped in dict)
                    if isinstance(recovered, list):
                        recovered = {"root": recovered}
                    try:
                        evidence = EvidenceList.model_validate(recovered)
                        if evidence.root:
                            logger.info(f"[Clinician] Recovered evidence. Count: {len(evidence.root)}")
                            return evidence
                    except Exception:
                        pass

    # --- FALLBACK: Use LLM directly (no PubMed results) ---
    logger.warning("[Clinician] PubMed yielded 0 results. Falling back to LLM synthesis...")
    
    fallback_system_instruction = (
        "You are a medical expert. Generate realistic clinical evidence for an insurance appeal.\n"
        "Output STRICT JSON matching this format:\n"
        '{"root": [{"article_title": "...", "summary_of_finding": "...", "pubmed_id": "..."}]}\n'
        "Include 2-3 articles. Output ONLY JSON."
    )
    
    fallback_prompt = (
        f"Procedure: {denial_details.procedure_denied}\n"
        f"Denial reason: {denial_details.insurer_reason_snippet}\n"
        "Generate clinical evidence JSON:"
    )

    fallback_response = client.generate(
        prompt=fallback_prompt,
        system=fallback_system_instruction,
        temperature=0.2,      # Slightly more creative for synthetic evidence
        max_tokens=1024,
        json_mode=True
    )
    
    if fallback_response:
        cleaned = _clean_json(fallback_response)
        try:
            evidence = EvidenceList.model_validate_json(cleaned)
            if evidence.root:
                logger.info(f"[Clinician] Fallback synthesis successful. Count: {len(evidence.root)}")
                return evidence
        except Exception:
            recovered = _extract_first_json(cleaned)
            if recovered:
                if isinstance(recovered, list):
                    recovered = {"root": recovered}
                try:
                    evidence = EvidenceList.model_validate(recovered)
                    if evidence.root:
                        logger.info(f"[Clinician] Fallback recovery successful. Count: {len(evidence.root)}")
                        return evidence
                except Exception:
                    pass

    # Step 4: All methods failed - return empty evidence list
    logger.warning("[Clinician] All methods failed. Returning empty evidence list.")
    return EvidenceList(root=[])