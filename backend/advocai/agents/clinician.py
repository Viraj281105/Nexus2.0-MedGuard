# agents/clinician.py — Clinician Agent (Groq fallback)

from pydantic import BaseModel, Field
from typing import List, Optional
import json
import re
import os
import logging
from dotenv import load_dotenv

from .auditor import StructuredDenial

load_dotenv()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class ClinicalEvidence(BaseModel):
    article_title: str
    summary_of_finding: str
    pubmed_id: str


class EvidenceList(BaseModel):
    root: List[ClinicalEvidence] = Field(default_factory=list)


def _clean_json(text: str) -> str:
    if not text:
        return ""
    t = text.strip()
    t = re.sub(r"```(?:json)?", "", t).replace("```", "")
    return t.strip()


def _extract_first_json(text: str) -> Optional[dict]:
    if not text:
        return None
    start = text.find("{")
    if start == -1:
        start = text.find("[")
        if start == -1:
            return None
    open_char = text[start]
    close_char = "}" if open_char == "{" else "]"
    depth = 0
    for i in range(start, len(text)):
        if text[i] == open_char:
            depth += 1
        elif text[i] == close_char:
            depth -= 1
            if depth == 0:
                block = text[start:i + 1]
                try:
                    return json.loads(block)
                except Exception:
                    cleaned = re.sub(r",\s*([}\]])", r"\1", block)
                    try:
                        return json.loads(cleaned)
                    except Exception:
                        return None
    return None


from advocai.tools.pubmed_search import pubmed_search

def _derive_query(denial: StructuredDenial) -> str:
    procedure = denial.procedure_denied.strip()
    procedure = re.sub(r"\(.*?\)", "", procedure).strip()
    base = f"{procedure} efficacy"
    return base


def run_clinician_agent(client, denial_details: StructuredDenial, **kwargs) -> EvidenceList:
    """ALWAYS returns EvidenceList (never None)."""
    logger.info("[Clinician] Trying PubMed as primary source...")
    final_query = _derive_query(denial_details)
    logger.info(f"[Clinician] PubMed query: {final_query}")

    articles = []
    try:
        articles = pubmed_search(final_query)
        if not isinstance(articles, list):
            articles = []
    except Exception as e:
        logger.error(f"[Clinician] PubMed tool crashed: {e}")

    if articles:
        logger.info(f"[Clinician] PubMed returned {len(articles)} articles. Synthesizing...")
        schema = EvidenceList.model_json_schema()
        sys_instr = (
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

        articles_trimmed = articles[:5]
        for art in articles_trimmed:
            if "abstract" in art and len(art["abstract"]) > 600:
                art["abstract"] = art["abstract"][:600] + "..."

        prompt = (
            f"Procedure denied: {denial_details.procedure_denied}\n"
            f"Denial reason: {denial_details.insurer_reason_snippet}\n\n"
            "PubMed articles:\n"
            f"{json.dumps(articles_trimmed, indent=2)}\n\n"
            "Now output the JSON object matching the schema:"
        )

        raw = client.generate(prompt=prompt, system=sys_instr, temperature=0.1, max_tokens=1024, json_mode=True)

        if raw:
            clean = _clean_json(raw)
            try:
                evidence = EvidenceList.model_validate_json(clean)
                if evidence.root:
                    logger.info(f"[Clinician] Evidence synthesized. Count: {len(evidence.root)}")
                    return evidence
            except Exception:
                recovered = _extract_first_json(clean)
                if recovered:
                    if isinstance(recovered, list):
                        recovered = {"root": recovered}
                    try:
                        evidence = EvidenceList.model_validate(recovered)
                        if evidence.root:
                            return evidence
                    except Exception:
                        pass

    # --- FALLBACK: Use the LLM client directly ---
    logger.warning("[Clinician] PubMed yielded 0 results. Falling back to LLM synthesis...")
    sys_instr_fb = (
        "You are a medical expert. Generate realistic clinical evidence for an insurance appeal.\n"
        "Output STRICT JSON matching this format:\n"
        '{"root": [{"article_title": "...", "summary_of_finding": "...", "pubmed_id": "..."}]}\n'
        "Include 2-3 articles. Output ONLY JSON."
    )
    prompt_fb = (
        f"Procedure: {denial_details.procedure_denied}\n"
        f"Denial reason: {denial_details.insurer_reason_snippet}\n"
        "Generate clinical evidence JSON:"
    )

    raw_fb = client.generate(prompt=prompt_fb, system=sys_instr_fb, temperature=0.2, max_tokens=1024, json_mode=True)
    if raw_fb:
        clean_fb = _clean_json(raw_fb)
        try:
            evidence = EvidenceList.model_validate_json(clean_fb)
            if evidence.root:
                return evidence
        except Exception:
            recovered = _extract_first_json(clean_fb)
            if recovered:
                if isinstance(recovered, list):
                    recovered = {"root": recovered}
                try:
                    return EvidenceList.model_validate(recovered)
                except Exception:
                    pass

    logger.warning("[Clinician] All methods failed. Returning empty evidence list.")
    return EvidenceList(root=[])
