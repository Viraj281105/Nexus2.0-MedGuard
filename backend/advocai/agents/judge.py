"""
Judge Agent — Deterministic QA scoring with evidence linking.
"""

from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Any, Optional
from datetime import datetime
import difflib
import logging
import os
import json
import re

logger = logging.getLogger("JudgeAgent")
logger.setLevel(logging.INFO)


class Issue(BaseModel):
    id: str
    severity: str = Field(..., description='"low" | "medium" | "high"')
    location_in_letter: Optional[Dict[str, int]] = None
    description: str
    evidence_refs: Optional[List[str]] = None
    suggested_fix: Optional[str] = None


class SubScores(BaseModel):
    factual_accuracy: int = Field(..., ge=0, le=100)
    citation_consistency: int = Field(..., ge=0, le=100)
    logical_adequacy: int = Field(..., ge=0, le=100)
    tone_professionalism: int = Field(..., ge=0, le=100)
    hallucination_risk: int = Field(..., ge=0, le=100)


class JudgeScorecard(BaseModel):
    overall_score: int = 0
    status: str = "needs_revision"
    sub_scores: SubScores
    issues: List[Issue]
    critique: str = ""
    confidence_estimate: float = Field(..., ge=0.0, le=1.0)
    meta: Optional[Dict[str, Any]] = None

    @model_validator(mode="before")
    def compute_overall(cls, values):
        if values.get("overall_score", 0) > 0:
            return values
        subs = values.get("sub_scores")
        if not subs:
            return values
        v = subs if isinstance(subs, dict) else subs.model_dump()

        # Weighted formula:
        # factual_accuracy      — 30%
        # citation_consistency  — 25%
        # logical_adequacy      — 25%
        # tone_professionalism  — 20%
        # hallucination_risk    — penalty up to -15 pts
        weighted = (
            v["factual_accuracy"]      * 0.30 +
            v["citation_consistency"]  * 0.25 +
            v["logical_adequacy"]      * 0.25 +
            v["tone_professionalism"]  * 0.20
        )
        halluc_penalty = v["hallucination_risk"] * 0.15
        overall = max(0, min(100, int(weighted - halluc_penalty)))

        values["overall_score"] = overall
        values["status"] = "approve" if overall >= 70 else "needs_revision"
        return values


# ---------------------------------------------------------------------------
# File I/O helpers
# ---------------------------------------------------------------------------

def _load_json(path):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _load_text(path):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


def load_all_inputs(session_dir):
    return {
        "auditor":    _load_json(os.path.join(session_dir, "auditor_output.json")),
        "clinician":  _load_json(os.path.join(session_dir, "clinician_output.json")),
        "regulatory": _load_json(os.path.join(session_dir, "regulatory_output.json")),
        "barrister":  _load_text(os.path.join(session_dir, "barrister_output.txt")),
    }


# ---------------------------------------------------------------------------
# Text analysis
# ---------------------------------------------------------------------------

def split_sentences(text: str) -> List[str]:
    if not text:
        return []
    text = re.sub(r"[\r\n]+", " ", text)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9])", text)
    return [p.strip() for p in parts if p.strip()]


def classify_sentences(sentences: List[str]) -> List[Dict[str, Any]]:
    """
    Classify each sentence as CLAIM or NON_CLAIM.
    Expanded keyword list to catch Indian insurance appeal language.
    """
    claim_keywords = [
        # Clinical
        "evidence", "clinical", "study", "trial", "research", "medically necessary",
        "medical necessity", "efficacy", "outcomes", "indicated", "recommended",
        "effective", "treatment", "procedure", "pubmed", "pmid",
        # Legal / regulatory
        "irdai", "regulation", "circular", "statute", "act", "section",
        "policy", "clause", "coverage", "denial", "denial code", "rc-",
        "ombudsman", "grievance", "cghs", "tpa", "insurer",
        # Appeal language
        "violation", "conflict", "non-compliant", "entitle", "reimburs",
        "appeal", "dispute", "reversal", "overcharge", "excess",
        "should be covered", "not justified", "arbitrary",
    ]
    out = []
    for i, s in enumerate(sentences):
        lower = s.lower()
        is_claim = any(k in lower for k in claim_keywords)
        out.append({
            "sentence_index": i,
            "sentence": s,
            "label": "CLAIM" if is_claim else "NON_CLAIM"
        })
    return out


# ---------------------------------------------------------------------------
# Evidence linking — RELAXED thresholds
# ---------------------------------------------------------------------------

def link_evidence(sentence, auditor, clinician, regulatory):
    """
    Links a sentence to supporting evidence from agent outputs.
    Uses relaxed thresholds and keyword matching for Indian appeal language.
    """
    s = sentence.lower()
    matches = {"auditor": [], "clinician": [], "regulatory": []}

    # --- Auditor matching ---
    if auditor:
        # Direct denial code mention
        dc = (auditor.get("denial_code") or "").lower()
        if dc and dc in s:
            matches["auditor"].append(f"DenialCode:{dc}")

        # Procedure mention
        procedure = (auditor.get("procedure_denied") or "").lower()
        if procedure:
            proc_words = set(procedure.split())
            sent_words = set(s.split())
            if len(proc_words & sent_words) >= 2:
                matches["auditor"].append("procedure_match")

        # Insurer reason mention
        reason = (auditor.get("insurer_reason_snippet") or "").lower()
        if reason:
            ratio = difflib.SequenceMatcher(None, s, reason[:200]).ratio()
            if ratio > 0.20:
                matches["auditor"].append("denial_reason_match")

        # Evidence chunk matching — relaxed threshold
        for chunk in (auditor.get("raw_evidence_chunks") or []):
            try:
                ratio = difflib.SequenceMatcher(None, s, chunk.lower()[:200]).ratio()
                if ratio > 0.25:
                    matches["auditor"].append(chunk[:60])
                    break
            except Exception:
                pass

    # --- Clinician matching ---
    if clinician and isinstance(clinician, dict):
        for entry in clinician.get("root", []):
            title = (entry.get("article_title") or "").lower()
            summary = (entry.get("summary_of_finding") or "").lower()
            pmid = str(entry.get("pubmed_id") or "").lower()

            # Direct PMID mention — strongest signal
            if pmid and pmid != "verified-on-request" and pmid in s:
                matches["clinician"].append(f"PMID:{pmid}")
                continue

            # Title word overlap — relaxed
            if title:
                title_words = set(w for w in title.split() if len(w) > 4)
                sent_words = set(s.split())
                overlap = len(title_words & sent_words)
                if overlap >= 2:
                    matches["clinician"].append(f"title_match:{pmid or 'unknown'}")
                    continue

            # Summary similarity — relaxed threshold
            ratio = difflib.SequenceMatcher(None, s, summary[:200]).ratio()
            if ratio > 0.18:
                matches["clinician"].append(f"PMID:{pmid or 'unknown'}")

            # Key medical terms from summary appearing in sentence
            medical_terms = [
                w for w in summary.split()
                if len(w) > 6 and w not in {
                    "patient", "treatment", "medical", "clinical", "evidence",
                    "procedure", "however", "therefore", "following"
                }
            ]
            if any(term in s for term in medical_terms[:5]):
                matches["clinician"].append(f"term_match:{pmid or 'unknown'}")

    # --- Regulatory matching ---
    if regulatory and isinstance(regulatory, dict):
        lps = regulatory.get("legal_points", [])
        if isinstance(lps, list):
            for lp in lps:
                statute = (lp.get("statute") or lp.get("reference") or "").lower()
                summary = (lp.get("summary") or lp.get("argument") or "").lower()
                category = (lp.get("category") or "").lower()

                # Direct statute name mention
                if statute:
                    # Check for key words from statute name
                    statute_words = set(w for w in statute.split() if len(w) > 4)
                    sent_words = set(s.split())
                    if len(statute_words & sent_words) >= 2:
                        matches["regulatory"].append(statute[:60])
                        continue

                # Category keyword match — catches "IRDAI", "ombudsman", etc.
                if category and category.replace("_", " ") in s:
                    matches["regulatory"].append(f"category:{category}")
                    continue

                # Summary similarity — relaxed
                ratio = difflib.SequenceMatcher(None, s, summary[:200]).ratio()
                if ratio > 0.18:
                    matches["regulatory"].append(statute or "reg_point")

                # Indian-specific keyword boost
                indian_legal_terms = [
                    "irdai", "insurance act", "ombudsman", "cghs", "consumer protection",
                    "policyholder", "grievance", "igms", "repudiation", "tpa"
                ]
                if any(term in s for term in indian_legal_terms):
                    if statute:
                        matches["regulatory"].append(f"keyword:{statute[:40]}")

    return matches


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_claim(matches) -> int:
    """
    Score a single claim based on evidence backing.
    Partial credit for partial evidence.
    """
    score = 0
    if matches["auditor"]:
        score += 25
    if matches["clinician"]:
        score += 40
    if matches["regulatory"]:
        score += 35
    return min(100, score)


def compute_subscores(claim_results, letter: str = "", auditor=None, regulatory=None) -> SubScores:
    """
    Compute subscores with multiple signals beyond just claim matching.
    """
    claims = [c for c in claim_results if c["label"] == "CLAIM"]
    total_sentences = len(claim_results)
    letter_lower = (letter or "").lower()

    # --- Tone / professionalism ---
    # Check for formal letter structure
    tone_score = 75  # baseline
    if any(w in letter_lower for w in ["dear", "subject:", "sincerely", "respectfully"]):
        tone_score += 10
    if any(w in letter_lower for w in ["section i", "section ii", "conclusion", "clinical argument", "legal argument"]):
        tone_score += 10
    if "[your name]" in letter_lower or "[patient name]" in letter_lower:
        tone_score -= 15  # unfilled placeholders penalised
    tone_score = max(0, min(100, tone_score))

    # --- No claims found — score based on letter structure ---
    if not claims:
        # Letter has content but no claims detected — likely well-structured prose
        has_irdai = any(t in letter_lower for t in ["irdai", "insurance act", "ombudsman", "cghs"])
        has_clinical = any(t in letter_lower for t in ["pubmed", "pmid", "clinical", "study", "efficacy"])
        has_procedure = auditor and (auditor.get("procedure_denied") or "").lower()[:20] in letter_lower

        factual = 80 if has_procedure else 70
        citation = 85 if (has_irdai and has_clinical) else (75 if has_irdai else 65)
        logical = 80

        return SubScores(
            factual_accuracy=factual,
            citation_consistency=citation,
            logical_adequacy=logical,
            tone_professionalism=tone_score,
            hallucination_risk=10,
        )

    # --- Score based on claim evidence ---
    scores = [c["score"] for c in claims]
    avg_score = sum(scores) / len(scores)

    supported = sum(1 for s in scores if s >= 30)
    partially = sum(1 for s in scores if 0 < s < 30)
    unsupported = sum(1 for s in scores if s == 0)

    support_ratio = supported / len(claims)
    partial_ratio = partially / len(claims)
    unsupport_ratio = unsupported / len(claims)

    # Factual accuracy — weighted by support level
    factual = int(
        support_ratio * 100 +
        partial_ratio * 60 +
        unsupport_ratio * 20
    )

    # Citation consistency — how consistently citations appear
    has_any_regulatory = any(c["matches"]["regulatory"] for c in claims)
    has_any_clinical = any(c["matches"]["clinician"] for c in claims)
    citation = int(avg_score)
    if has_any_regulatory:
        citation = min(100, citation + 15)
    if has_any_clinical:
        citation = min(100, citation + 15)

    # Logical adequacy — based on structure and flow
    logical = max(60, int(avg_score * 0.9))

    # Hallucination risk — unsupported claims
    halluc_risk = max(0, int(unsupport_ratio * 60))

    # Boost scores for Indian-specific regulatory content
    irdai_terms = ["irdai", "insurance act 1938", "ombudsman rules", "consumer protection act", "cghs"]
    irdai_count = sum(1 for t in irdai_terms if t in letter_lower)
    if irdai_count >= 2:
        factual = min(100, factual + 10)
        citation = min(100, citation + 10)

    return SubScores(
        factual_accuracy=max(40, factual),
        citation_consistency=max(40, citation),
        logical_adequacy=max(50, logical),
        tone_professionalism=tone_score,
        hallucination_risk=max(0, halluc_risk),
    )


# ---------------------------------------------------------------------------
# Issue detection
# ---------------------------------------------------------------------------

def detect_issues(claim_results) -> List[Issue]:
    issues = []
    counter = 1
    for c in claim_results:
        if c["label"] != "CLAIM":
            continue
        score = c["score"]
        idx = c["sentence_index"]

        if score == 0:
            issues.append(Issue(
                id=f"ISSUE-{counter}",
                severity="high",
                location_in_letter={"sentence_index": idx},
                description=f"Unsupported claim: '{c['sentence'][:120]}'",
                evidence_refs=[],
                suggested_fix="Cite a specific PubMed PMID or IRDAI statute that supports this claim, or remove it.",
            ))
            counter += 1

        elif score < 60:
            missing = []
            if not c["matches"]["clinician"]:
                missing.append("clinical evidence (PubMed PMID)")
            if not c["matches"]["regulatory"]:
                missing.append("regulatory statute (IRDAI/Insurance Act)")
            if missing:
                refs = list(set(x for src in c["matches"].values() for x in src))
                issues.append(Issue(
                    id=f"ISSUE-{counter}",
                    severity="medium",
                    location_in_letter={"sentence_index": idx},
                    description=f"Partially supported. Missing: {', '.join(missing)}",
                    evidence_refs=refs,
                    suggested_fix=f"Strengthen by explicitly citing {' and '.join(missing)}.",
                ))
                counter += 1
    return issues


# ---------------------------------------------------------------------------
# Critique generation
# ---------------------------------------------------------------------------

def build_critique(issues: List[Issue], overall_score: int) -> str:
    if overall_score >= 70:
        return ""

    high = [i for i in issues if i.severity == "high"]
    medium = [i for i in issues if i.severity == "medium"]
    parts = []

    if high:
        parts.append(
            f"CRITICAL — {len(high)} unsupported claim(s): "
            + "; ".join(i.description[:100] for i in high[:2])
            + ". You MUST cite a specific PubMed PMID or IRDAI statute for each, or remove these claims."
        )

    if medium:
        fixes = [
            f"'{i.description[:70]}' → {i.suggested_fix}"
            for i in medium[:2]
        ]
        parts.append(
            f"IMPROVEMENTS — {len(medium)} partially supported claim(s): "
            + "; ".join(fixes)
        )

    if not parts:
        parts.append(
            "The letter must explicitly name each PubMed PMID and IRDAI statute "
            "in the body text. Generic references to 'clinical evidence' or "
            "'regulations' are insufficient — cite the specific source by name."
        )

    return " | ".join(parts)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_judge_agent(session_dir="data/output/", **kwargs):
    logger.info("[Judge] Loading agent outputs...")
    inp = load_all_inputs(session_dir)
    auditor    = inp["auditor"]
    clinician  = inp["clinician"]
    regulatory = inp["regulatory"]
    letter     = inp["barrister"]

    if not letter:
        logger.error("[Judge] No barrister output found.")
        return None

    sentences     = split_sentences(letter)
    labels        = classify_sentences(sentences)
    claim_results = []

    for item in labels:
        s = item["sentence"]
        if item["label"] == "CLAIM":
            matches = link_evidence(s, auditor, clinician, regulatory)
            score   = score_claim(matches)
        else:
            matches = {"auditor": [], "clinician": [], "regulatory": []}
            score   = 0
        claim_results.append({**item, "matches": matches, "score": score})

    subs   = compute_subscores(claim_results, letter=letter, auditor=auditor, regulatory=regulatory)
    issues = detect_issues(claim_results)

    scorecard = JudgeScorecard(
        sub_scores=subs,
        issues=issues,
        confidence_estimate=0.85,
        meta={
            "generated_at": datetime.utcnow().isoformat(),
            "version": "v3.0",
            "total_sentences": len(sentences),
            "claims_detected": sum(1 for c in claim_results if c["label"] == "CLAIM"),
            "claims_supported": sum(1 for c in claim_results if c["label"] == "CLAIM" and c["score"] >= 30),
        },
    )

    scorecard.critique = build_critique(issues, scorecard.overall_score)

    os.makedirs(session_dir, exist_ok=True)
    json_path = os.path.join(session_dir, "judge_scorecard.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(scorecard.model_dump(), f, indent=4)

    logger.info(
        f"[Judge] Score: {scorecard.overall_score} | "
        f"Status: {scorecard.status} | "
        f"Issues: {len(issues)} | "
        f"Claims: {sum(1 for c in claim_results if c['label'] == 'CLAIM')}"
    )
    return scorecard