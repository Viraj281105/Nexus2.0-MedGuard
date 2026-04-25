"""
orchestrator/auth/db.py
PostgreSQL helpers for the users table.

Provides database operations for:
- User management (create, read)
- Case/session management (create, read, update, delete)
- Session-to-user ownership tracking
"""

import os
import uuid
from dataclasses import dataclass
from typing import Optional

import psycopg2
import psycopg2.extras


# ==============================================================================
# DATABASE CONNECTION
# ==============================================================================

def _get_conn():
    """
    Establish and return a PostgreSQL database connection.
    
    Uses environment variables for configuration with sensible defaults.
    
    Environment variables:
        POSTGRES_HOST: Database server host (default: 127.0.0.1)
        POSTGRES_PORT: Database server port (default: 5432)
        POSTGRES_DB: Database name (default: advocai)
        POSTGRES_USER: Database username (default: postgres)
        POSTGRES_PASSWORD: Database password (default: empty string)
    
    Returns:
        psycopg2 connection object
    """
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "advocai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


# ==============================================================================
# TABLE SCHEMAS
# ==============================================================================

# Users table schema
# ------------------
# Stores authentication credentials for system users.
# 
# Columns:
# - id: Auto-incrementing primary key
# - email: Unique user email (used for login)
# - hashed_password: bcrypt/argon2 hashed password (never plain text)
# - created_at: Timestamp of account creation
# - updated_at: Timestamp of last update
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

# Sessions table schema (assumed to exist - defined elsewhere or by migration)
# NOTE: The sessions table and user_sessions junction table are expected to exist.
# They are NOT created by this module to maintain separation of concerns.
# Expected schemas:
# 
# sessions table:
# - session_id: UUID primary key
# - patient_name, insurer_name, procedure_denied, denial_date, notes
# - denial_path, policy_path: File paths to uploaded documents
# - status: queued, processing, completed, failed
# - created_at, updated_at: Timestamps
# 
# user_sessions junction table:
# - user_id: Foreign key to users.id
# - session_id: Foreign key to sessions.session_id
# - (user_id, session_id) unique constraint


# ==============================================================================
# USER MANAGEMENT
# ==============================================================================

def ensure_users_table() -> None:
    """
    Ensure the users table exists in the database.
    
    Creates the table and required indexes if they don't already exist.
    Should be called during application startup.
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(CREATE_USERS_TABLE)
        conn.commit()
    finally:
        conn.close()


@dataclass
class UserRecord:
    """
    Data class representing a user record from the database.
    
    Attributes:
        id: User's unique identifier
        email: User's email address
        hashed_password: Securely hashed password
        created_at: Account creation timestamp
        updated_at: Last update timestamp
    """
    id: int
    email: str
    hashed_password: str
    created_at: object = None
    updated_at: object = None


def get_user_by_email(email: str) -> Optional[UserRecord]:
    """
    Retrieve a user record by email address.
    
    Args:
        email: User's email address to look up
        
    Returns:
        UserRecord object if found, None otherwise
    """
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                "SELECT id, email, hashed_password, created_at, updated_at FROM users WHERE email = %s LIMIT 1",
                (email,)
            )
            row = cursor.fetchone()
    finally:
        conn.close()
    
    if not row:
        return None
    return UserRecord(**row)


def create_user(email: str, hashed_password: str) -> UserRecord:
    """
    Create a new user in the database.
    
    Args:
        email: User's email address (must be unique)
        hashed_password: Pre-hashed password (caller handles hashing)
        
    Returns:
        UserRecord with the newly created user's data
    """
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                "INSERT INTO users (email, hashed_password) VALUES (%s, %s) RETURNING id, email, hashed_password, created_at, updated_at",
                (email, hashed_password),
            )
            row = cursor.fetchone()
        conn.commit()
    finally:
        conn.close()
    
    return UserRecord(**row)


# ==============================================================================
# CASE/SESSION MANAGEMENT
# ==============================================================================

@dataclass
class CaseRecord:
    """
    Data class representing a case/session record.
    
    Attributes:
        session_id: Unique identifier for the session (UUID)
        patient_name: Name of the patient
        insurer_name: Name of the insurance company
        procedure_denied: The medical procedure that was denied
        denial_date: Date of the denial letter
        notes: Additional case notes
        status: Current workflow status (queued, processing, completed, failed)
        denial_path: File path to uploaded denial letter
        policy_path: File path to uploaded policy document
        created_at: Session creation timestamp
        updated_at: Last update timestamp
    """
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
    """
    Create a new case session for a user.
    
    Creates a session record and links it to the user via user_sessions table.
    
    Args:
        user_id: ID of the user creating the case
        patient_name: Name of the patient
        insurer_name: Name of the insurance company
        procedure_denied: The medical procedure that was denied
        denial_date: Date of the denial letter
        notes: Additional case notes
        denial_path: File path to uploaded denial letter
        policy_path: File path to uploaded policy document
        status: Initial workflow status (default: "queued")
        
    Returns:
        CaseRecord with the newly created case data
    """
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            # Step 1: Insert into sessions table
            cursor.execute(
                """INSERT INTO sessions 
                   (patient_name, insurer_name, procedure_denied, denial_date, notes, 
                    denial_path, policy_path, status) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s) 
                   RETURNING session_id, patient_name, insurer_name, procedure_denied, 
                            denial_date, notes, denial_path, policy_path, status, created_at, updated_at""",
                (patient_name, insurer_name, procedure_denied, denial_date, notes, denial_path, policy_path, status),
            )
            case_row = cursor.fetchone()
            session_id = case_row['session_id']
            
            # Step 2: Link user to session in junction table
            cursor.execute(
                "INSERT INTO user_sessions (user_id, session_id) VALUES (%s, %s)",
                (user_id, session_id),
            )
        conn.commit()
    finally:
        conn.close()
    
    return CaseRecord(**case_row)


def get_user_cases(user_id: int) -> list[CaseRecord]:
    """
    Get all cases for a specific user.
    
    Args:
        user_id: ID of the user whose cases to retrieve
        
    Returns:
        List of CaseRecord objects, ordered by created_at descending (newest first)
    """
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                """SELECT s.session_id, s.patient_name, s.insurer_name, s.procedure_denied, 
                          s.denial_date, s.notes, s.denial_path, s.policy_path, s.status, 
                          s.created_at, s.updated_at
                   FROM sessions s
                   JOIN user_sessions us ON s.session_id = us.session_id
                   WHERE us.user_id = %s
                   ORDER BY s.created_at DESC""",
                (user_id,),
            )
            rows = cursor.fetchall()
    finally:
        conn.close()
    
    return [CaseRecord(**row) for row in rows]


def get_case_by_id(user_id: int, session_id: str) -> Optional[CaseRecord]:
    """
    Get a specific case if it belongs to the user.
    
    Security check: Ensures the case belongs to the requesting user.
    
    Args:
        user_id: ID of the user requesting the case
        session_id: Unique identifier of the case
        
    Returns:
        CaseRecord if found and belongs to user, None otherwise
    """
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                """SELECT s.session_id, s.patient_name, s.insurer_name, s.procedure_denied, 
                          s.denial_date, s.notes, s.denial_path, s.policy_path, s.status, 
                          s.created_at, s.updated_at
                   FROM sessions s
                   JOIN user_sessions us ON s.session_id = us.session_id
                   WHERE us.user_id = %s AND s.session_id = %s""",
                (user_id, session_id),
            )
            row = cursor.fetchone()
    finally:
        conn.close()
    
    if not row:
        return None
    return CaseRecord(**row)


def update_case_status(session_id: str, status: str) -> None:
    """
    Update the status of a case.
    
    Also updates the updated_at timestamp automatically.
    
    Args:
        session_id: Unique identifier of the case
        status: New status value (e.g., "processing", "completed", "failed")
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE sessions SET status = %s, updated_at = NOW() WHERE session_id = %s",
                (status, session_id),
            )
        conn.commit()
    finally:
        conn.close()


def delete_case(user_id: int, session_id: str) -> bool:
    """
    Delete a case if it belongs to the user.
    
    Security check: Verifies ownership before deletion.
    The user_sessions reference will be deleted via CASCADE automatically.
    
    Args:
        user_id: ID of the user requesting deletion
        session_id: Unique identifier of the case to delete
        
    Returns:
        True if case was deleted, False if case not found or not owned by user
    """
    conn = _get_conn()
    try:
        with conn.cursor() as cursor:
            # Step 1: Verify ownership
            cursor.execute(
                "SELECT 1 FROM user_sessions WHERE user_id = %s AND session_id = %s",
                (user_id, session_id),
            )
            if not cursor.fetchone():
                return False
            
            # Step 2: Delete the session (user_sessions will be deleted by CASCADE)
            cursor.execute("DELETE FROM sessions WHERE session_id = %s", (session_id,))
        conn.commit()
        return True
    finally:
        conn.close()