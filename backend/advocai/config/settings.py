# config/settings.py — Global configuration for AdvocAI

import os
from dotenv import load_dotenv

load_dotenv()

# ------------------------------------------------------------------------------
# ENVIRONMENT & BACKEND CONFIG
# ------------------------------------------------------------------------------
PERSISTENCE_BACKEND = os.getenv("PERSISTENCE_BACKEND", "json").lower()


# ------------------------------------------------------------------------------
# DATABASE CONFIG (PostgreSQL)
# ------------------------------------------------------------------------------
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "advocai")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_ENABLE_POOL = os.getenv("DB_ENABLE_POOL", "true").lower() == "true"


# ------------------------------------------------------------------------------
# LLM CONFIG
# ------------------------------------------------------------------------------
# Groq (cloud — primary for deployment)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-70b-8192")

# Ollama (local — optional for development)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")

# Which LLM backend to use: "groq" or "ollama"
LLM_BACKEND = os.getenv("LLM_BACKEND", "groq").lower()

# Local embedding model path
EMBEDDING_MODEL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "models", "local-embedder")
)


# ------------------------------------------------------------------------------
# SESSION & STORAGE PATHS
# ------------------------------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

DATA_DIR = os.path.join(BASE_DIR, "data")
INPUT_DIR = os.path.join(DATA_DIR, "input")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")
KNOWLEDGE_DIR = os.path.join(DATA_DIR, "knowledge")
TOOLS_DIR = os.path.join(BASE_DIR, "tools")
MODELS_DIR = os.path.join(BASE_DIR, "models")


# ------------------------------------------------------------------------------
# FEATURE FLAGS
# ------------------------------------------------------------------------------
ENABLE_RESUME = True
ENABLE_CHECKPOINTING = True
ENABLE_ERROR_LOGGING = True
ENABLE_JSON_BACKUP = True


# ------------------------------------------------------------------------------
# STAGE ORDER (single source of truth)
# ------------------------------------------------------------------------------
STAGE_ORDER = [
    "auditor",
    "clinician",
    "regulatory",
    "barrister",
    "judge",
]


# ------------------------------------------------------------------------------
# Create directories if missing
# ------------------------------------------------------------------------------
for path in [DATA_DIR, INPUT_DIR, OUTPUT_DIR, SESSIONS_DIR]:
    os.makedirs(path, exist_ok=True)
