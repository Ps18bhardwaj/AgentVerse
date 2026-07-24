"""Security, Cryptography, JWT, Password Validation & Authorization Dependencies for AgentVerse."""
from __future__ import annotations

import os
import re
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

import jwt
from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..db.models import AuditLog, User, UserSession

SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("JWT_SECRET") or "agentverse_production_jwt_super_secret_key_2026_change_in_env"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
REMEMBER_ME_REFRESH_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_bearer = HTTPBearer(auto_error=False)


import bcrypt as _bcrypt_lib

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    pw_bytes = password.encode("utf-8")[:72]
    salt = _bcrypt_lib.gensalt()
    return _bcrypt_lib.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against stored hash."""
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return _bcrypt_lib.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False



def validate_password_strength(password: str) -> Dict[str, Any]:
    """Validate password against enterprise security rules."""
    errors = []
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]", password):
        errors.append("Password must contain at least one special character.")

    score = 0
    if len(password) >= 8:
        score += 1
    if len(password) >= 12:
        score += 1
    if re.search(r"[A-Z]", password) and re.search(r"[a-z]", password):
        score += 1
    if re.search(r"\d", password):
        score += 1
    if re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]", password):
        score += 1

    return {
        "valid": len(errors) == 0,
        "score": score,  # 0 to 5
        "errors": errors,
    }


def create_access_token(user_id: str, role: str, permissions: List[str]) -> str:
    """Create a short-lived access JWT token."""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "role": role,
        "permissions": permissions,
        "type": "access",
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, remember_me: bool = False) -> tuple[str, datetime]:
    """Create a long-lived refresh token and return (token_string, expiration_datetime)."""
    days = REMEMBER_ME_REFRESH_EXPIRE_DAYS if remember_me else REFRESH_TOKEN_EXPIRE_DAYS
    expire = datetime.utcnow() + timedelta(days=days)
    jti = secrets.token_hex(16)
    payload = {
        "sub": user_id,
        "jti": jti,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, expire


def hash_token(token: str) -> str:
    """Hash token string for secure session database lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def decode_jwt(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")


def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[str] = None,
    username: str = "Anonymous",
    resource: str = "System",
    ip_address: str = "127.0.0.1",
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Create a persistent security audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        resource=resource,
        ip_address=ip_address,
        details=details or {},
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_client_ip(request: Request) -> str:
    """Extract real client IP address from request headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def get_user_agent_details(request: Request) -> tuple[str, str, str]:
    """Parse user agent into (device, browser, full_agent)."""
    ua = request.headers.get("User-Agent", "Unknown Browser")
    browser = "Browser"
    if "Chrome" in ua:
        browser = "Google Chrome"
    elif "Safari" in ua and "Chrome" not in ua:
        browser = "Apple Safari"
    elif "Firefox" in ua:
        browser = "Mozilla Firefox"
    elif "Edge" in ua:
        browser = "Microsoft Edge"

    device = "Desktop"
    if "Mobile" in ua or "Android" in ua or "iPhone" in ua:
        device = "Mobile Device"
    elif "iPad" in ua or "Tablet" in ua:
        device = "Tablet"

    return device, browser, ua


# Cookie helpers
COOKIE_MAX_AGE = REFRESH_TOKEN_EXPIRE_DAYS * 86400

def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set secure HTTP-only cookies on response."""
    is_secure = os.getenv("SECURE_COOKIES", "false").lower() in ("true", "1") or os.getenv("ENVIRONMENT") == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=15 * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=is_secure,
        max_age=COOKIE_MAX_AGE,
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear access and refresh token cookies."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


# FastAPI Security Dependencies
def get_token_from_request(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    access_token_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> str:
    """Extract token from Authorization header or HTTP-only cookie."""
    if bearer and bearer.credentials:
        return bearer.credentials
    if access_token_cookie:
        return access_token_cookie
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Please log in.",
    )


def get_current_user(
    token: str = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> User:
    """Fetch active authenticated user from JWT token."""
    payload = decode_jwt(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type. Access token required.",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found.")

    if user.account_status == "suspended":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account has been suspended.")
    if user.account_status == "locked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is temporarily locked due to failed attempts.")

    return user


def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    """Ensure user is active."""
    return user


def require_role(allowed_roles: List[str]):
    """Role-based access control dependency factory."""
    def dependency(user: User = Depends(get_current_user)) -> User:
        # System Owner has implicit access to all role-restricted routes
        if user.role == "System Owner":
            return user
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}",
            )
        return user
    return dependency


def require_permission(permission: str):
    """Permission-based authorization dependency factory."""
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role == "System Owner" or "admin:all" in (user.permissions or []):
            return user
        if permission not in (user.permissions or []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Permission '{permission}' required.",
            )
        return user
    return dependency
