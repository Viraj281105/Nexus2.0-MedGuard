# storage/postgres/connection.py

import os
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from dotenv import load_dotenv

load_dotenv()

class PostgresConnection:
    """Centralized PostgreSQL connection pool for AdvocAI."""

    _pool = None

    @staticmethod
    def initialize():
        if PostgresConnection._pool is None:
            try:
                PostgresConnection._pool = SimpleConnectionPool(
                    minconn=1,
                    maxconn=10,
                    host=os.getenv("POSTGRES_HOST", "localhost"),
                    port=os.getenv("POSTGRES_PORT", "5432"),
                    database=os.getenv("POSTGRES_DB", "advocai"),
                    user=os.getenv("POSTGRES_USER", "postgres"),
                    password=os.getenv("POSTGRES_PASSWORD", ""),
                    connect_timeout=5
                )
            except Exception as e:
                raise RuntimeError(f"Failed to initialize PostgreSQL pool: {e}")

    @staticmethod
    def get_connection():
        if PostgresConnection._pool is None:
            PostgresConnection.initialize()
        try:
            return PostgresConnection._pool.getconn()
        except Exception as e:
            raise RuntimeError(f"Could not get DB connection: {e}")

    @staticmethod
    def return_connection(conn):
        try:
            PostgresConnection._pool.putconn(conn)
        except Exception as e:
            pass

    @staticmethod
    def close_all():
        if PostgresConnection._pool:
            PostgresConnection._pool.closeall()
