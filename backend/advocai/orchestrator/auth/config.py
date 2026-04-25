"""
orchestrator/auth/config.py
Auth settings from environment.

This module provides JWT (JSON Web Token) configuration for authentication.
All sensitive values can be overridden via environment variables.
"""

import os
import secrets

# ==============================================================================
# JWT CONFIGURATION
# ==============================================================================

# JWT Secret Key
# -----------------
# Used to sign and verify JWT tokens.
# If not provided via environment variable, generates a cryptographically secure
# random 32-byte (256-bit) key using secrets.token_hex().
# 
# IMPORTANT: In production, always set JWT_SECRET in .env file.
# A random key will invalidate all sessions when the server restarts.
JWT_SECRET: str = os.getenv("JWT_SECRET", secrets.token_hex(32))

# JWT Signing Algorithm
# ---------------------
# HS256 = HMAC-SHA256 (symmetric signing using the secret key)
# This is the industry standard for JWT.
JWT_ALGORITHM: str = "HS256"

# Access Token Expiration (minutes)
# ---------------------------------
# How long a JWT token remains valid after issuance.
# Default: 1440 minutes = 24 hours.
# 
# Can be overridden via ACCESS_TOKEN_EXPIRE_MINUTES environment variable.
# 
# Common values:
# - 15  : Short session (high security, banking apps)
# - 60  : One hour (typical web apps)
# - 480 : 8 hours (workday session)
# - 1440: 24 hours (default, convenient for users)
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))