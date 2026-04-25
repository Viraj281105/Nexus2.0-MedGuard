"""
orchestrator/auth/router.py
JWT authentication endpoints for AdvocAI

Provides authentication API routes:
- POST /api/auth/register - Create new user account
- POST /api/auth/login - Authenticate and get JWT token
- GET /api/auth/me - Get current user info (requires auth)
- POST /api/auth/logout - Client-side logout (no server state)
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import bcrypt
import jwt
from pydantic import BaseModel, EmailStr

from .db import get_user_by_email, create_user, UserRecord
from .config import JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, DEMO_MODE, DEMO_USER_ID, DEMO_USER_EMAIL

# ==============================================================================
# ROUTER SETUP
# ==============================================================================

# Create router with auth prefix and tags for API documentation
router = APIRouter(prefix="/api/auth", tags=["auth"])
# In demo mode, make bearer scheme optional; otherwise require it
bearer_scheme = HTTPBearer(auto_error=not DEMO_MODE)  # Handles Authorization: Bearer <token> header


# ==============================================================================
# PYDANTIC SCHEMAS (Request/Response Models)
# ==============================================================================

class RegisterRequest(BaseModel):
    """
    Request body for user registration.
    
    Attributes:
        email: Valid email address (validated by EmailStr)
        password: Plain text password (will be hashed before storage)
    """
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """
    Request body for user login.
    
    Attributes:
        email: User's email address
        password: Plain text password for verification
    """
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """
    Response body for successful authentication.
    
    Attributes:
        access_token: JWT token for subsequent authenticated requests
        token_type: Always "bearer" for HTTP Bearer authentication scheme
        user: User information object (id, email)
    """
    access_token: str
    token_type: str = "bearer"
    user: dict


# ==============================================================================
# AUTHENTICATION UTILITIES
# ==============================================================================

def hash_password(plain: str) -> str:
    """
    Hash a plain text password using bcrypt.
    
    Args:
        plain: Plain text password string
        
    Returns:
        bcrypt hashed password (encoded string)
    """
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a plain text password against a bcrypt hash.
    
    Args:
        plain: Plain text password to verify
        hashed: Stored bcrypt hash to compare against
        
    Returns:
        True if password matches, False otherwise
    """
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str) -> str:
    """
    Create a JWT access token for authenticated users.
    
    Token payload includes:
    - sub (subject): User ID (standard JWT claim)
    - email: User's email address
    - iat (issued at): Token creation timestamp
    - exp (expiration): Token expiry timestamp
    
    Args:
        user_id: User's database ID (converted to string)
        email: User's email address
        
    Returns:
        Encoded JWT token string
    """
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    
    Args:
        token: JWT token string from Authorization header
        
    Returns:
        Decoded payload as dictionary
        
    Raises:
        HTTPException 401: Token expired or invalid
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==============================================================================
# DEPENDENCY: Get Current User
# ==============================================================================

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)] = None,
) -> UserRecord:
    """
    FastAPI dependency to extract and validate the current authenticated user.
    
    In DEMO_MODE: Returns a mock demo user without requiring authentication.
    Otherwise: Extracts JWT from Authorization header, decodes it, fetches user from database.
    
    Args:
        credentials: HTTP Bearer token credentials (automatically injected, optional in demo mode)
        
    Returns:
        UserRecord object for the authenticated user (real or demo)
        
    Raises:
        HTTPException 401: Invalid token or user not found (when not in demo mode)
    """
    # Demo mode: bypass authentication
    if DEMO_MODE:
        return UserRecord(
            id=DEMO_USER_ID,
            email=DEMO_USER_EMAIL,
            hashed_password="",
        )
    
    # Production mode: require valid JWT
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    
    payload = decode_token(credentials.credentials)
    user = get_user_by_email(payload["email"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ==============================================================================
# AUTHENTICATION ENDPOINTS
# ==============================================================================

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """
    Register a new user account.
    
    Creates a new user with email/password, returns JWT token for immediate use.
    
    Validation:
    - Email must be unique (409 if already registered)
    - Password must be at least 8 characters (422 if too short)
    
    Args:
        body: RegisterRequest with email and password
        
    Returns:
        TokenResponse with access_token and user info
    """
    # Check if email already exists
    existing = get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # Validate password strength (minimum length)
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    
    # Create user and generate token
    user = create_user(email=body.email, hashed_password=hash_password(body.password))
    token = create_access_token(str(user.id), user.email)
    
    return TokenResponse(access_token=token, user={"id": str(user.id), "email": user.email})


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """
    Authenticate existing user.
    
    Verifies email/password combination and returns JWT token.
    
    Args:
        body: LoginRequest with email and password
        
    Returns:
        TokenResponse with access_token and user info
        
    Raises:
        HTTPException 401: Invalid email or password (generic message for security)
    """
    user = get_user_by_email(body.email)
    
    # Verify user exists AND password matches
    if not user or not verify_password(body.password, user.hashed_password):
        # Use generic message to prevent user enumeration attacks
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user={"id": str(user.id), "email": user.email})


@router.get("/me")
async def me(current_user: Annotated[UserRecord, Depends(get_current_user)]):
    """
    Get information about the currently authenticated user.
    
    Requires valid JWT token in Authorization header.
    
    Args:
        current_user: UserRecord (automatically injected via dependency)
        
    Returns:
        User information object (id, email)
    """
    return {"id": str(current_user.id), "email": current_user.email}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout():
    """
    Logout endpoint (client-side only).
    
    JWT tokens are stateless, so logout is handled client-side by discarding the token.
    This endpoint exists for API completeness and future extensibility (e.g., token blacklisting).
    
    Returns:
        204 No Content (empty response body)
    """
    return