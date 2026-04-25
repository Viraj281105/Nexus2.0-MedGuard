"""
storage/postgres/embeddings.py
Handles storing and querying statute embeddings using pgvector.
"""

import logging
from typing import Optional
import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)


def get_connection(postgres_url: str):
    return psycopg2.connect(postgres_url)


def store_embedding(conn, statute_id: int, embedding: list) -> bool:
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE statutes SET embedding = %s WHERE id = %s", (embedding, statute_id))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Failed to store embedding for statute {statute_id}: {e}")
        conn.rollback()
        return False


def search_by_embedding(conn, query_embedding: list, top_k: int = 5) -> list:
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, statute_name, statute_text, jurisdiction, category,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM statutes WHERE embedding IS NOT NULL
                ORDER BY embedding <=> %s::vector LIMIT %s
                """,
                (query_embedding, query_embedding, top_k)
            )
            results = cur.fetchall()
        return [dict(row) for row in results]
    except Exception as e:
        logger.warning(f"pgvector search failed: {e}")
        return []


def search_by_keyword(conn, query: str, top_k: int = 5) -> list:
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, statute_name, statute_text, jurisdiction, category,
                       ts_rank(to_tsvector('english', statute_text), plainto_tsquery('english', %s)) AS similarity
                FROM statutes
                WHERE to_tsvector('english', statute_text) @@ plainto_tsquery('english', %s)
                ORDER BY similarity DESC LIMIT %s
                """,
                (query, query, top_k)
            )
            results = cur.fetchall()
        return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Keyword fallback search also failed: {e}")
        return []


def is_pgvector_available(conn) -> bool:
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            return cur.fetchone() is not None
    except Exception:
        return False


def get_statutes_without_embeddings(conn) -> list:
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, statute_name, statute_text FROM statutes WHERE embedding IS NULL")
            return [dict(row) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"Failed to fetch statutes without embeddings: {e}")
        return []
