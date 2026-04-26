# storage/postgres/connection.py

import os
import logging
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()
logger = logging.getLogger("PostgresConnection")

class PostgresConnection:
    """Centralized PostgreSQL connection pool for AdvocAI."""

    _pool = None
    _schema_initialized = False

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
                logger.info("PostgreSQL connection pool initialized")
                
                # Initialize schema on first connection
                PostgresConnection._initialize_schema()
            except Exception as e:
                raise RuntimeError(f"Failed to initialize PostgreSQL pool: {e}")

    @staticmethod
    def _initialize_schema():
        """Load and execute schema.sql to create all tables."""
        if PostgresConnection._schema_initialized:
            return
            
        try:
            schema_path = Path(__file__).parent / "schema.sql"
            if not schema_path.exists():
                logger.warning(f"Schema file not found: {schema_path}")
                return
                
            conn = PostgresConnection.get_connection()
            try:
                with open(schema_path, 'r') as f:
                    schema_sql = f.read()
                
                cur = conn.cursor()
                cur.execute(schema_sql)
                conn.commit()
                logger.info("PostgreSQL schema initialized successfully")
                PostgresConnection._schema_initialized = True
            except psycopg2.Error as e:
                conn.rollback()
                logger.warning(f"Error initializing schema: {e}")
            finally:
                cur.close()
                PostgresConnection.return_connection(conn)
        except Exception as e:
            logger.error(f"Failed to initialize schema: {e}")

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
