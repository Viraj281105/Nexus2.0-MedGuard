# tools/document_reader.py
"""
Robust PDF Text Extraction Utility
Handles PDFs and images with pypdf + optional LLaVA OCR.
"""

from pypdf import PdfReader
from typing import List, Dict, Any
import re
import os
import logging
import base64
import requests

logger = logging.getLogger(__name__)


def _normalize_unicode(text: str) -> str:
    if not text:
        return ""
    replacements = {"fi": "fi", "fl": "fl", "ffi": "ffi", "ffl": "ffl", "\u2013": "-", "\u2014": "-", "\u00a0": " "}
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text


def clean_text_segment(text: str) -> str:
    if not text:
        return ""
    text = _normalize_unicode(text)
    text = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", text)
    text = re.sub(r"[\r\n]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def extract_text_from_image(file_path: str) -> Dict[str, Any]:
    try:
        with open(file_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

        payload = {
            "model": "llava",
            "messages": [{"role": "user", "content": "Extract all text from this document exactly as it appears. Do not add any commentary or explanation. Just return the raw text.", "images": [encoded_string]}],
            "stream": False,
            "options": {"temperature": 0.0}
        }

        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        r = requests.post(f"{base_url}/api/chat", json=payload, timeout=120)
        r.raise_for_status()

        text = r.json().get("message", {}).get("content", "").strip()

        return {
            "source_file": file_path,
            "metadata": {"type": "image"},
            "full_text_content": text,
            "segments": [text] if len(text) < 2000 else [text[i:i+2000] for i in range(0, len(text), 2000)],
            "page_count": 1,
            "success": True,
        }
    except Exception as e:
        logger.error(f"[IMAGE ERROR] Failed to process image {file_path}: {e}")
        return {"error": f"Failed to process image: {e}", "success": False, "full_text_content": "", "segments": [], "page_count": 0}


def extract_text_from_document(file_path: str) -> Dict[str, Any]:
    ext = os.path.splitext(file_path)[1].lower()
    if ext in [".jpg", ".jpeg", ".png"]:
        return extract_text_from_image(file_path)

    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}", "success": False, "full_text_content": "", "segments": [], "page_count": 0}

    try:
        reader = PdfReader(file_path)
    except Exception as e:
        logger.error(f"[PDF ERROR] Cannot open {file_path}: {e}")
        return {"error": f"Failed to open PDF: {e}", "success": False, "full_text_content": "", "segments": [], "page_count": 0}

    segments: List[str] = []
    full_text_buffer = []

    for i, page in enumerate(reader.pages):
        try:
            raw = page.extract_text()
        except Exception as e:
            logger.warning(f"[PDF Warning] Page {i+1} failed extraction: {e}")
            raw = ""
        raw = raw or ""
        cleaned = clean_text_segment(raw)
        full_text_buffer.append(f"\n\n--- PAGE {i+1} ---\n\n{cleaned}")

        para_candidates = re.split(r"(?:\n\s*\n|\u2022|\n\d+\.)", raw, flags=re.MULTILINE)
        for seg in para_candidates:
            seg = clean_text_segment(seg)
            if seg and len(seg) > 40:
                segments.append(seg)

    segments = segments[:60]

    metadata = {}
    try:
        raw_meta = reader.metadata or {}
        for k, v in raw_meta.items():
            metadata[str(k)] = str(v) if v is not None else None
    except Exception:
        metadata = {}

    return {
        "source_file": file_path,
        "metadata": metadata,
        "full_text_content": "\n".join(full_text_buffer).strip(),
        "segments": segments,
        "page_count": len(reader.pages),
        "success": True,
    }
