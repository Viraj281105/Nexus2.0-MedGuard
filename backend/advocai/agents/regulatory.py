"""
agents/regulatory.py — Regulatory Agent
Identifies relevant coverage mandates (ACA, ERISA, state statutes).
"""

import os
import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

_embedding_model = None

def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        model_path = os.path.join(os.path.dirname(__file__), "..", "models", "local-embedder")
        model_path = os.path.abspath(model_path)
        if os.path.exists(model_path):
            _embedding_model = SentenceTransformer(model_path)
        else:
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model

def _detect_jurisdiction(denial_data: dict) -> str:
    text = json.dumps(denial_data).lower()
    indian_signals = ["irdai", "cghs", "irda", "star health", "medi assist",
                      "rupees", "rs.", "tpa", "bima", "lokpal", "apollo"]
    if any(s in text for s in indian_signals):
        return "india"
    return "us"

def embed_query(query: str) -> Optional[list]:
    try:
        model = _get_embedding_model()
        embedding = model.encode(query, convert_to_numpy=True)
        return embedding.tolist()
    except Exception as e:
        logger.warning(f"Local embedding failed: {e}")
        return None


def retrieve_relevant_statutes(query: str, top_k: int = 5, postgres_url: Optional[str] = None) -> list:
    postgres_url = postgres_url or os.getenv("POSTGRES_URL")
    if postgres_url:
        try:
            from advocai.storage.postgres.embeddings import get_connection, is_pgvector_available, search_by_embedding, search_by_keyword
            conn = get_connection(postgres_url)
            if is_pgvector_available(conn):
                query_embedding = embed_query(query)
                if query_embedding:
                    results = search_by_embedding(conn, query_embedding, top_k=top_k)
                    conn.close()
                    if results:
                        return results
            results = search_by_keyword(conn, query, top_k=top_k)
            conn.close()
            if results:
                return results
        except ImportError:
            logger.warning("psycopg2 not installed — skipping DB search.")
        except Exception as e:
            logger.warning(f"DB search failed: {e}")

    return _search_law_library(query, top_k=top_k)


def _search_law_library(query: str, top_k: int = 5) -> list:
    library_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "knowledge", "law_library.json"))
    statutes = []
    try:
        with open(library_path, "r") as f:
            law_library = json.load(f)
        statutes = law_library if isinstance(law_library, list) else law_library.get("statutes", [])
    except FileNotFoundError:
        statutes = _builtin_statute_stubs()
    except Exception:
        statutes = _builtin_statute_stubs()

    query_words = set(query.lower().split())
    scored = []
    for statute in statutes:
        text = (statute.get("statute_text", "") + " " + statute.get("statute_name", "")).lower()
        score = sum(1 for word in query_words if word in text)
        if score > 0:
            scored.append((score, statute))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored[:top_k]]


def _builtin_statute_stubs() -> list:
    return [
        {"statute_name": "ACA §2713 — Preventive Care Coverage", "statute_text": "Requires non-grandfathered group health plans and insurers to provide coverage for preventive health services without cost-sharing.", "jurisdiction": "federal", "category": "preventive_care"},
        {"statute_name": "ERISA §502(a) — Civil Enforcement", "statute_text": "Authorizes participants or beneficiaries to bring civil actions to recover benefits due under the terms of a plan.", "jurisdiction": "federal", "category": "claims_enforcement"},
        {"statute_name": "ACA §2719 — Internal Appeals", "statute_text": "Requires group health plans and health insurance issuers to implement an effective internal appeals process for coverage determinations.", "jurisdiction": "federal", "category": "appeals"},
        {"statute_name": "Mental Health Parity and Addiction Equity Act (MHPAEA)", "statute_text": "Requires that financial requirements and treatment limitations for mental health benefits be no more restrictive than those applied to medical/surgical benefits.", "jurisdiction": "federal", "category": "mental_health"},
        {"statute_name": "ACA §1557 — Non-Discrimination", "statute_text": "Prohibits discrimination in health programs receiving federal financial assistance.", "jurisdiction": "federal", "category": "non_discrimination"},
    ]

def _builtin_india_statute_stubs() -> list:
    return [
        {
            "statute_name": "IRDAI (Health Insurance) Regulations 2016",
            "statute_text": (
                "Regulation 17 mandates that insurers provide specific, documented "
                "reasons for each denial with exact policy clause references. "
                "Vague or generic denial codes without clause-level justification "
                "are non-compliant. Insurer must respond to appeals within 15 working days."
            ),
            "jurisdiction": "india",
            "category": "claims_procedure",
        },
        {
            "statute_name": "Insurance Act 1938 §45",
            "statute_text": (
                "No insurer may repudiate a claim after 3 years from policy commencement "
                "on any ground. Within 3 years, repudiation must be backed by documented "
                "evidence of deliberate misrepresentation — not merely tariff disagreement."
            ),
            "jurisdiction": "india",
            "category": "repudiation",
        },
        {
            "statute_name": "Insurance Ombudsman Rules 2017",
            "statute_text": (
                "Insured may escalate to the Insurance Ombudsman within 1 year of the "
                "insurer's final decision. Ombudsman awards are binding on the insurer "
                "up to Rs. 30 lakhs. Pune jurisdiction: bimalokpal.pune@cioins.co.in."
            ),
            "jurisdiction": "india",
            "category": "grievance_redressal",
        },
        {
            "statute_name": "IRDAI Circular IRDA/HLT/REG/CIR/070/03/2020 — Standardisation of Health Insurance",
            "statute_text": (
                "Insurers cannot apply CGHS rate caps to deny or reduce claims unless "
                "the rate schedule was explicitly disclosed to the insured at policy "
                "issuance and forms part of the agreed tariff schedule. Retrospective "
                "application of rate caps without prior disclosure is non-compliant."
            ),
            "jurisdiction": "india",
            "category": "tariff_disputes",
        },
        {
            "statute_name": "Consumer Protection Act 2019",
            "statute_text": (
                "Unfair trade practice or deficiency in insurance service is actionable "
                "before the District/State/National Consumer Disputes Redressal Commission. "
                "Arbitrary claim denials without adequate clinical review constitute "
                "deficiency in service under Section 2(11)."
            ),
            "jurisdiction": "india",
            "category": "consumer_protection",
        },
        {
            "statute_name": "IRDAI (Protection of Policyholders' Interests) Regulations 2017",
            "statute_text": (
                "Regulation 9 requires insurers to settle or reject claims within 30 days "
                "of receiving all required documents. Partial denials must be accompanied "
                "by a detailed written explanation referencing specific policy exclusions. "
                "Failure to do so entitles the insured to interest on delayed amounts."
            ),
            "jurisdiction": "india",
            "category": "policyholder_protection",
        },
    ]

def _ollama_regulatory_reasoning(denial_data: dict, client) -> dict:
    jurisdiction = _detect_jurisdiction(denial_data)

    if jurisdiction == "india":
        law_context = "Indian health insurance law (IRDAI Regulations, Insurance Act 1938, Consumer Protection Act 2019, Insurance Ombudsman Rules 2017)"
        format_note = "Cite only Indian statutes and IRDAI circulars. Do NOT cite ERISA, ACA, MHPAEA, or any US law."
    else:
        law_context = "US health insurance law (ACA, ERISA, state mandates)"
        format_note = "Cite US federal and relevant state statutes."

    sys_instr = (
        f"You are a legal expert in {law_context}.\n"
        f"{format_note}\n"
        "Output STRICT JSON ONLY. No markdown. No explanation.\n"
        "Follow this exact format:\n"
        '{"legal_points": [{"statute": "...", "summary": "...", "jurisdiction": "...", "category": "..."}]}'
    )

    prompt = (
        "A patient insurance claim was denied.\n"
        f"Procedure: {denial_data.get('procedure_denied', 'Unknown')}\n"
        f"Denial reason: {denial_data.get('insurer_reason_snippet', 'Unknown')}\n"
        f"Denial code: {denial_data.get('denial_code', 'Unknown')}\n\n"
        f"List 3 to 5 specific {jurisdiction.upper()} statutes or regulations that support an appeal.\n"
        "For each, explain precisely how it applies to this denial.\n"
        "Output the JSON object now:"
    )

    raw = client.generate(prompt=prompt, system=sys_instr, temperature=0.1, max_tokens=1024, json_mode=True)
    if not raw:
        return _stub_fallback(jurisdiction)
    try:
        return json.loads(raw)
    except Exception:
        start = raw.find("{")
        if start != -1:
            cleaned = re.sub(r",\s*([}\]])", r"\1", raw[start:])
            try:
                return json.loads(cleaned)
            except Exception:
                pass
    return _stub_fallback(jurisdiction)


def _stub_fallback(jurisdiction: str = "us") -> dict:
    stubs = _builtin_india_statute_stubs() if jurisdiction == "india" else _builtin_statute_stubs()
    return {
        "legal_points": [
            {
                "statute": s["statute_name"],
                "summary": s["statute_text"][:300],
                "jurisdiction": s["jurisdiction"],
                "category": s["category"],
            }
            for s in stubs[:3]
        ],
        "retrieval_method": "builtin_stub_fallback",
    }

def run_regulatory_agent(denial_data: dict, postgres_url: Optional[str] = None, client=None, **kwargs) -> dict:
    jurisdiction = _detect_jurisdiction(denial_data)  # ADD THIS LINE

    procedure = denial_data.get("procedure_denied", "")
    denial_reason = denial_data.get("insurer_reason_snippet", "")
    denial_code = denial_data.get("denial_code", "")

    query = f"Insurance claim denied for: {procedure}. Denial reason: {denial_reason}. Denial code: {denial_code}. Find relevant {'Indian IRDAI' if jurisdiction == 'india' else 'US federal'} statutes."

    statutes = retrieve_relevant_statutes(query=query, top_k=5, postgres_url=postgres_url)

    if not statutes:
        if client is not None:
            return _ollama_regulatory_reasoning(denial_data, client)
        return _stub_fallback(jurisdiction)  # PASS JURISDICTION

    legal_points = [
        {"statute": s.get("statute_name", "Unknown"), "summary": s.get("statute_text", "")[:1500],
         "jurisdiction": s.get("jurisdiction", "federal"), "category": s.get("category", "general"),
         "similarity_score": s.get("similarity", None)}
        for s in statutes
    ]

    retrieval_method = "pgvector_cosine" if statutes and statutes[0].get("similarity") is not None else "in_memory_keyword"
    return {"legal_points": legal_points, "retrieval_method": retrieval_method, "query_used": query, "statute_count": len(legal_points)}
