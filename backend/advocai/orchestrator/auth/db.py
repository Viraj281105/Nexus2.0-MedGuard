"""
orchestrator/auth/db.py
PostgreSQL helpers for the users table.
"""

import os
import uuid
from dataclasses import dataclass
from typing import Optional

import psycopg2
import psycopg2.extras


def _get_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "advocai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


CREATE_USERS_TABLE = """
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
"""


def ensure_users_table() -> None:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(CREATE_USERS_TABLE)
        conn.commit()
    finally:
        conn.close()


@dataclass
class UserRecord:
    id: int
    email: str
    hashed_password: str
    created_at: object = None
    updated_at: object = None


def get_user_by_email(email: str) -> Optional[UserRecord]:
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, email, hashed_password, created_at, updated_at FROM users WHERE email = %s LIMIT 1", (email,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return UserRecord(**row)


def create_user(email: str, hashed_password: str) -> UserRecord:
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "INSERT INTO users (email, hashed_password) VALUES (%s, %s) RETURNING id, email, hashed_password, created_at, updated_at",
                (email, hashed_password),
            )
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()
    return UserRecord(**row)


# ============================================================
# Case/Session Management
# ============================================================

@dataclass
class CaseRecord:
    session_id: str
    patient_name: str
    insurer_name: str
    procedure_denied: str
    denial_date: str
    notes: str
    status: str
    denial_path: str
    policy_path: str
    created_at: object = None
    updated_at: object = None


def create_case(
    user_id: int,
    patient_name: str,
    insurer_name: str,
    procedure_denied: str,
    denial_date: str,
    notes: str,
    denial_path: str,
    policy_path: str,
    status: str = "queued",
) -> CaseRecord:
    """Create a new case session for a user."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Insert into sessions
            cur.execute(
                """INSERT INTO sessions 
                   (patient_name, insurer_name, procedure_denied, denial_date, notes, 
                    denial_path, policy_path, status) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s) 
                   RETURNING session_id, patient_name, insurer_name, procedure_denied, 
                            denial_date, notes, denial_path, policy_path, status, created_at, updated_at""",
                (patient_name, insurer_name, procedure_denied, denial_date, notes, denial_path, policy_path, status),
            )
            case_row = cur.fetchone()
            session_id = case_row['session_id']
            
            # Link user to session
            cur.execute(
                "INSERT INTO user_sessions (user_id, session_id) VALUES (%s, %s)",
                (user_id, session_id),
            )
        conn.commit()
    finally:
        conn.close()
    return CaseRecord(**case_row)


def get_user_cases(user_id: int) -> list[CaseRecord]:
    """Get all cases for a user."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT s.session_id, s.patient_name, s.insurer_name, s.procedure_denied, 
                          s.denial_date, s.notes, s.denial_path, s.policy_path, s.status, 
                          s.created_at, s.updated_at
                   FROM sessions s
                   JOIN user_sessions us ON s.session_id = us.session_id
                   WHERE us.user_id = %s
                   ORDER BY s.created_at DESC""",
                (user_id,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    return [CaseRecord(**row) for row in rows]


def get_case_by_id(user_id: int, session_id: str) -> Optional[CaseRecord]:
    """Get a specific case if it belongs to the user."""
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """SELECT s.session_id, s.patient_name, s.insurer_name, s.procedure_denied, 
                          s.denial_date, s.notes, s.denial_path, s.policy_path, s.status, 
                          s.created_at, s.updated_at
                   FROM sessions s
                   JOIN user_sessions us ON s.session_id = us.session_id
                   WHERE us.user_id = %s AND s.session_id = %s""",
                (user_id, session_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        return None
    return CaseRecord(**row)


def update_case_status(session_id: str, status: str) -> None:
    """Update the status of a case."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE sessions SET status = %s, updated_at = NOW() WHERE session_id = %s",
                (status, session_id),
            )
        conn.commit()
    finally:
        conn.close()


def delete_case(user_id: int, session_id: str) -> bool:
    """Delete a case if it belongs to the user."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            # Check ownership
            cur.execute(
                "SELECT 1 FROM user_sessions WHERE user_id = %s AND session_id = %s",
                (user_id, session_id),
            )
            if not cur.fetchone():
                return False
            
            # Delete the session (user_sessions will be deleted by CASCADE)
            cur.execute("DELETE FROM sessions WHERE session_id = %s", (session_id,))
        conn.commit()
        return True
    finally:
        conn.close()

