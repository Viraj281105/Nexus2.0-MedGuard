# storage/json/json_store.py — Lightweight JSON-based persistence engine

import os
import json
from typing import Optional, Dict
from datetime import datetime


class JSONStore:
    """
    File-based storage backend for AdvocAI.
    Used for local debugging or where Postgres is not available.
    """

    BASE_DIR = "sessions"

    @staticmethod
    def _session_dir(session_id: str) -> str:
        return os.path.join(JSONStore.BASE_DIR, session_id)

    @staticmethod
    def _checkpoint_path(session_id: str, stage: str) -> str:
        return os.path.join(JSONStore._session_dir(session_id), "checkpoints", f"{stage}.json")

    @staticmethod
    def _metadata_path(session_id: str) -> str:
        return os.path.join(JSONStore._session_dir(session_id), "metadata.json")

    @staticmethod
    def _error_dir(session_id: str) -> str:
        return os.path.join(JSONStore._session_dir(session_id), "errors")

    @staticmethod
    def create_session(session_id: str, metadata: dict = None):
        session_path = JSONStore._session_dir(session_id)
        os.makedirs(session_path, exist_ok=True)
        metadata_path = JSONStore._metadata_path(session_id)
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata or {}, f, indent=2, ensure_ascii=False)

    @staticmethod
    def save_checkpoint(session_id: str, stage: str, output: dict, raw_text: str = None):
        checkpoint_dir = os.path.join(JSONStore._session_dir(session_id), "checkpoints")
        os.makedirs(checkpoint_dir, exist_ok=True)
        payload = {
            "stage": stage,
            "timestamp": datetime.utcnow().isoformat(),
            "output_json": output,
            "raw_text": raw_text,
        }
        path = JSONStore._checkpoint_path(session_id, stage)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

    @staticmethod
    def load_checkpoint(session_id: str, stage: str) -> Optional[Dict]:
        path = JSONStore._checkpoint_path(session_id, stage)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def log_error(session_id: str, stage: str, message: str, error_type: str = None, traceback: str = None):
        err_dir = JSONStore._error_dir(session_id)
        os.makedirs(err_dir, exist_ok=True)
        filename = datetime.utcnow().strftime("%Y-%m-%dT%H-%M-%S.json")
        path = os.path.join(err_dir, filename)
        payload = {
            "stage": stage,
            "timestamp": datetime.utcnow().isoformat(),
            "error_message": message,
            "error_type": error_type,
            "traceback": traceback,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

    @staticmethod
    def stage_completed(session_id: str, stage: str) -> bool:
        return os.path.exists(JSONStore._checkpoint_path(session_id, stage))

    @staticmethod
    def get_last_completed_stage(session_id: str) -> Optional[str]:
        checkpoints_dir = os.path.join(JSONStore._session_dir(session_id), "checkpoints")
        if not os.path.exists(checkpoints_dir):
            return None
        stages_order = ["auditor", "clinician", "regulatory", "barrister", "judge"]
        completed = []
        for stage in stages_order:
            if JSONStore.stage_completed(session_id, stage):
                completed.append(stage)
        return completed[-1] if completed else None
