# tools/io_utils.py
"""Universal JSON & Model IO Utilities"""

import json
import re
import logging
import os
from typing import Optional, Dict, Any, Union
from pydantic import BaseModel

logger = logging.getLogger("io_utils")


def safe_save_model_json(model: BaseModel, path: str, *, ensure_ascii: bool = False, create_backup: bool = True) -> None:
    try:
        if create_backup and os.path.exists(path):
            bak = path + ".bak"
            if os.path.exists(bak):
                os.remove(bak)
            os.rename(path, bak)
        obj = model.model_dump()
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, indent=2, ensure_ascii=ensure_ascii)
    except Exception as e:
        logger.exception(f"[IO] Failed to save model JSON: {e}")


def save_llm_raw_dump(text: str, path: str):
    try:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
    except Exception as e:
        logger.error(f"[IO] Failed to write LLM dump: {e}")


def clean_llm_text(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    text = re.sub(r"```(?:json)?", "", text)
    text = text.replace("```", "")
    text = re.sub(r"<\/?(analysis|assistant|assistant_raw)[^>]*>", "", text)
    first = min([idx for idx in [text.find("{"), text.find("[")] if idx != -1] or [0])
    text = text[first:].strip()
    return text


def extract_first_json_object(text: str) -> Optional[Union[Dict[str, Any], list]]:
    if not text:
        return None
    text = clean_llm_text(text)
    try:
        return json.loads(text)
    except Exception:
        pass

    candidates = []
    obj = _extract_balanced(text, "{", "}")
    if obj:
        candidates.append(obj)
    arr = _extract_balanced(text, "[", "]")
    if arr:
        candidates.append(arr)

    for c in candidates:
        for cleaned in _cleanup_json_variants(c):
            try:
                return json.loads(cleaned)
            except Exception:
                continue
    return None


def _extract_balanced(text: str, open_char: str, close_char: str) -> Optional[str]:
    start = text.find(open_char)
    if start == -1:
        return None
    stack = []
    for i in range(start, len(text)):
        if text[i] == open_char:
            stack.append(open_char)
        elif text[i] == close_char:
            if stack:
                stack.pop()
                if not stack:
                    return text[start:i + 1]
    return None


def _cleanup_json_variants(candidate: str):
    variants = [candidate]
    cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
    variants.append(cleaned)
    cleaned2 = cleaned.replace("\u200b", "")
    variants.append(cleaned2)
    last = max(candidate.rfind("}"), candidate.rfind("]"))
    if last != -1:
        variants.append(candidate[:last + 1])
    return variants


def load_json_file(path: str) -> Optional[Union[Dict[str, Any], list]]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as e:
        logger.error(f"[IO] Failed loading JSON: {e}")
        return None
