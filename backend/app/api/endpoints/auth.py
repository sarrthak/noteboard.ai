from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _error_reference() -> str:
    """Create a short correlation reference for server-side auth logs."""
    return uuid4().hex[:12]


def _diagnostic_result(ok: bool, detail: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"ok": ok}
    if detail:
        result["detail"] = detail
    return result


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Register a new user.
    
    - **email**: User's email address (must be unique)
    - **password**: User's password (min 8 characters)
    - **full_name**: User's full name (optional)
    """
    request_ref = _error_reference()
    try:
        # Check if user already exists
        result = await db.execute(select(User).where(User.email == user_in.email))
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists",
            )

        # Create new user
        user = User(
            email=user_in.email,
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            is_active=True,
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        logger.exception(
            "AUTH_REGISTER_ERROR ref={} email={}", request_ref, user_in.email
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed. Reference: {request_ref}",
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """
    OAuth2 compatible token login.
    
    - **username**: User's email address
    - **password**: User's password
    
    Returns a JWT access token.
    """
    request_ref = _error_reference()
    try:
        # Find user by email (OAuth2 uses 'username' field)
        result = await db.execute(select(User).where(User.email == form_data.username))
        user = result.scalar_one_or_none()

        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user",
            )

        # Create access token
        access_token = create_access_token(subject=str(user.id))

        return Token(access_token=access_token)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "AUTH_LOGIN_ERROR ref={} username={}", request_ref, form_data.username
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed. Reference: {request_ref}",
        )


@router.get("/diagnostics")
async def auth_diagnostics(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_diagnostic_key: Annotated[
        str | None, Header(alias="X-Diagnostic-Key")
    ] = None,
) -> dict[str, Any]:
    """Run quick checks for auth-critical dependencies and primitives."""
    if not settings.AUTH_DIAGNOSTIC_ENABLED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if not settings.AUTH_DIAGNOSTIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTH_DIAGNOSTIC_KEY is not configured",
        )

    if x_diagnostic_key != settings.AUTH_DIAGNOSTIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid diagnostic key",
        )

    checks: dict[str, dict[str, Any]] = {}
    ok = True

    try:
        await db.execute(text("SELECT 1"))
        checks["database_connection"] = _diagnostic_result(True)
    except Exception as exc:
        ok = False
        checks["database_connection"] = _diagnostic_result(False, type(exc).__name__)

    try:
        await db.execute(select(User.id).limit(1))
        checks["users_table_query"] = _diagnostic_result(True)
    except Exception as exc:
        ok = False
        checks["users_table_query"] = _diagnostic_result(False, type(exc).__name__)

    try:
        probe_password = "diagnostic-password"
        probe_hash = get_password_hash(probe_password)
        if not verify_password(probe_password, probe_hash):
            raise RuntimeError("password verification failed")
        checks["password_hashing"] = _diagnostic_result(True)
    except Exception as exc:
        ok = False
        checks["password_hashing"] = _diagnostic_result(False, type(exc).__name__)

    try:
        token = create_access_token(subject="diagnostic-user")
        payload = decode_access_token(token)
        if payload is None or payload.get("sub") != "diagnostic-user":
            raise RuntimeError("token roundtrip failed")
        checks["jwt_roundtrip"] = _diagnostic_result(True)
    except Exception as exc:
        ok = False
        checks["jwt_roundtrip"] = _diagnostic_result(False, type(exc).__name__)

    return {
        "ok": ok,
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": checks,
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Get current authenticated user's information.
    """
    return current_user
