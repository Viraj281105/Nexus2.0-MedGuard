# config/settings.py — Global configuration for AdvocAI
"""
Global configuration module for the AdvocAI system.

Loads environment variables and provides centralized access to:
- LLM backend settings (Groq/Ollama)
- Database connection parameters
- File system paths
- Feature flags
- Agent execution order
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ==============================================================================
# ENVIRONMENT & BACKEND CONFIG
# ==============================================================================
"""
Persistence backend selection.

Options:
- "json": File-based JSON storage (default, good for development)
- "postgres": PostgreSQL database (for production)
"""
PERSISTENCE_BACKEND = os.getenv("PERSISTENCE_BACKEND", "json").lower()


# ==============================================================================
# DATABASE CONFIG (PostgreSQL)
# ==============================================================================
"""
PostgreSQL connection parameters.

Only used when PERSISTENCE_BACKEND = "postgres"
"""
DB_HOST = os.getenv("DB_HOST", "localhost")           # Database server hostname
DB_PORT = os.getenv("DB_PORT", "5432")                # PostgreSQL default port
DB_NAME = os.getenv("DB_NAME", "advocai")             # Database name
DB_USER = os.getenv("DB_USER", "postgres")            # Database username
DB_PASSWORD = os.getenv("DB_PASSWORD", "")            # Database password (empty for local dev)
DB_ENABLE_POOL = os.getenv("DB_ENABLE_POOL", "true").lower() == "true"  # Enable connection pooling


# ==============================================================================
# LLM CONFIG
# ==============================================================================
"""
Large Language Model configuration.

Supports two backends:
1. Groq (cloud) - Primary for deployment, high throughput
2. Ollama (local) - Optional for development, runs locally
"""

# ------------------------------------------------------------------------------
# Groq (cloud — primary for deployment)
# ------------------------------------------------------------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")          # API key from Groq Cloud
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-70b-8192")  # Default: Llama 3 70B

# ------------------------------------------------------------------------------
# Ollama (local — optional for development)
# ------------------------------------------------------------------------------
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")  # Local Ollama server
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")   # Default: Mistral 7B

# ------------------------------------------------------------------------------
# Backend Selection
# ------------------------------------------------------------------------------
# Which LLM backend to use: "groq" or "ollama"
LLM_BACKEND = os.getenv("LLM_BACKEND", "groq").lower()

# ------------------------------------------------------------------------------
# Embedding Model
# ------------------------------------------------------------------------------
# Local sentence-transformer model path for document embeddings (RAG)
EMBEDDING_MODEL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "models", "local-embedder")
)


# ==============================================================================
# SESSION & STORAGE PATHS
# ==============================================================================
"""
File system paths for data persistence.

All paths are absolute, derived from the project root directory.
"""

# Project root directory (two levels up from this file)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Data directory structure
DATA_DIR = os.path.join(BASE_DIR, "data")                     # Root data directory
INPUT_DIR = os.path.join(DATA_DIR, "input")                   # User uploaded files
OUTPUT_DIR = os.path.join(DATA_DIR, "output")                 # Agent outputs
SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")             # Session state storage
KNOWLEDGE_DIR = os.path.join(DATA_DIR, "knowledge")           # Knowledge base (IRDAI circulars, CGHS rates)
TOOLS_DIR = os.path.join(BASE_DIR, "tools")                   # Utility tools directory
MODELS_DIR = os.path.join(BASE_DIR, "models")                 # Downloaded ML models


# ==============================================================================
# FEATURE FLAGS
# ==============================================================================
"""
Feature toggles for system behavior.
"""

ENABLE_RESUME = True           # Allow resuming interrupted workflows
ENABLE_CHECKPOINTING = True    # Save intermediate state between agents
ENABLE_ERROR_LOGGING = True    # Log errors to disk for debugging
ENABLE_JSON_BACKUP = True      # Create JSON backups of all agent outputs


# ==============================================================================
# STAGE ORDER (single source of truth)
# ==============================================================================
"""
Deterministic execution order for the multi-agent pipeline.

Stages execute in this sequence:
1. auditor   - Extracts denial details from insurer letter
2. clinician - Searches PubMed for clinical evidence
3. regulatory - Looks up relevant IRDAI regulations
4. barrister - Drafts appeal letter
5. judge     - Evaluates letter quality and provides feedback
"""
STAGE_ORDER = [
    "auditor",
    "clinician",
    "regulatory",
    "barrister",
    "judge",
]


# ==============================================================================
# Create directories if missing
# ==============================================================================
"""
Ensure all required directories exist at startup.

Creates the following directories if they don't exist:
- DATA_DIR: Root data directory
- INPUT_DIR: For uploaded documents
- OUTPUT_DIR: For agent generation outputs
- SESSIONS_DIR: For session state persistence
"""

# List of critical directories to create
_required_directories = [
    DATA_DIR,
    INPUT_DIR,
    OUTPUT_DIR,
    SESSIONS_DIR,
]

# Create each directory (exist_ok=True prevents errors if already exists)
for directory_path in _required_directories:
    os.makedirs(directory_path, exist_ok=True)