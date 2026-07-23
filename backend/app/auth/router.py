"""Production FastAPI Router for Auth, IAM, OAuth, Sessions, Workspaces, Admin Panel & Audit Logs."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..db.models import AuditLog, User, UserSession, Workspace, WorkspaceMember
from .oauth import exchange_oauth_code, get_oauth_login_url
from .security import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_jwt,
    get_client_ip,
    get_current_active_user,
    get_current_user,
    get_user_agent_details,
    hash_password,
    hash_token,
    log_audit_event,
    require_role,
    set_auth_cookies,
    validate_password_strength,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication & IAM"])


# --- PYDANTIC REQUEST & RESPONSE SCHEMAS ---
class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    phone_number: Optional[str] = None
    password: str = Field(..., min_length=8)
    terms_accepted: bool = True


class LoginRequest(BaseModel):
    email_or_username: str
    password: str
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class VerifyEmailRequest(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    notification_preferences: Optional[Dict[str, Any]] = None


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class WorkspaceInviteRequest(BaseModel):
    email: EmailStr
    role: str = "Member"  # Admin, Manager, Member, Guest


class AdminStatusRequest(BaseModel):
    status: str  # active, suspended, locked


class AdminRoleRequest(BaseModel):
    role: str  # System Owner, Admin, Manager, Member, Guest


class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


# --- HELPERS ---
def format_user_dict(user: User, db: Session) -> Dict[str, Any]:
    """Serialize User model into standard response payload."""
    active_ws = None
    if user.workspace:
        ws = db.query(Workspace).filter(Workspace.id == user.workspace).first()
        if ws:
            active_ws = {"id": ws.id, "name": ws.name, "owner_id": ws.owner_id}

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "name": f"{user.first_name} {user.last_name}",
        "username": user.username,
        "email": user.email,
        "phone_number": user.phone_number,
        "profile_picture": user.profile_picture,
        "role": user.role,
        "permissions": user.permissions or [],
        "organization": user.organization,
        "workspace": user.workspace,
        "active_workspace": active_ws,
        "account_status": user.account_status,
        "email_verified": user.email_verified,
        "two_factor_enabled": user.two_factor_enabled,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "timezone": user.timezone,
        "language": user.language,
        "theme": user.theme,
        "notification_preferences": user.notification_preferences or {},
        "api_keys": user.api_keys or [],
        "connected_accounts": user.connected_accounts or [],
    }


# --- REGISTRATION ENDPOINT ---
@router.post("/register")
def register(
    req: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Register new user account. First user becomes System Owner."""
    # Check if username or email already exists
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(400, "Email address is already registered.")

    if db.query(User).filter(User.username == req.username.lower()).first():
        raise HTTPException(400, "Username is already taken.")

    # Validate password strength
    strength = validate_password_strength(req.password)
    if not strength["valid"]:
        raise HTTPException(400, f"Password weak: {'; '.join(strength['errors'])}")

    # Check First User Rule
    total_users = db.query(User).count()
    is_first_user = total_users == 0

    role = "System Owner" if is_first_user else "Member"
    permissions = [
        "admin:all",
        "documents:manage",
        "workspaces:manage",
        "users:manage",
        "agents:execute",
        "workflows:manage",
        "connectors:manage",
    ] if is_first_user else ["documents:read", "documents:write", "agents:execute", "workflows:manage"]

    email_verification_token = secrets.token_hex(32)

    user = User(
        first_name=req.first_name.strip(),
        last_name=req.last_name.strip(),
        username=req.username.strip().lower(),
        email=req.email.strip().lower(),
        phone_number=req.phone_number,
        password_hash=hash_password(req.password),
        role=role,
        permissions=permissions,
        account_status="active",
        email_verified=is_first_user,  # First user automatically verified
        email_verification_token=None if is_first_user else email_verification_token,
        last_login=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create initial workspace for user
    ws_name = f"{user.first_name}'s Workspace" if not is_first_user else "System Main Workspace"
    workspace = Workspace(name=ws_name, owner_id=user.id)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)

    # Create WorkspaceMember
    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="Owner")
    db.add(member)
    user.workspace = workspace.id
    db.commit()

    # Generate tokens & session
    access_token = create_access_token(user.id, user.role, user.permissions)
    refresh_token, expires_at = create_refresh_token(user.id, remember_me=True)

    device, browser, _ = get_user_agent_details(request)
    ip_addr = get_client_ip(request)

    session_entry = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        device=device,
        browser=browser,
        ip_address=ip_addr,
        expires_at=expires_at,
    )
    db.add(session_entry)
    db.commit()

    # Audit logging
    log_audit_event(
        db,
        action="REGISTER",
        user_id=user.id,
        username=user.username,
        resource="User Registration",
        ip_address=ip_addr,
        details={"role": role, "is_first_user": is_first_user, "workspace_id": workspace.id},
    )

    set_auth_cookies(response, access_token, refresh_token)

    return {
        "message": "Registration successful.",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": format_user_dict(user, db),
    }


# --- LOGIN ENDPOINT ---
@router.post("/login")
def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticate user with email or username + password."""
    identifier = req.email_or_username.strip().lower()
    user = db.query(User).filter((User.email == identifier) | (User.username == identifier)).first()

    ip_addr = get_client_ip(request)

    if not user:
        log_audit_event(db, action="FAILED_LOGIN", username=identifier, ip_address=ip_addr, details={"reason": "User not found"})
        raise HTTPException(401, "Invalid credentials.")

    if user.account_status == "suspended":
        log_audit_event(db, action="FAILED_LOGIN", user_id=user.id, username=user.username, ip_address=ip_addr, details={"reason": "Account suspended"})
        raise HTTPException(403, "Your account has been suspended. Please contact administrator.")

    if user.account_status == "locked":
        log_audit_event(db, action="FAILED_LOGIN", user_id=user.id, username=user.username, ip_address=ip_addr, details={"reason": "Account locked"})
        raise HTTPException(403, "Account locked due to too many failed attempts. Reset your password.")

    if not verify_password(req.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= 5:
            user.account_status = "locked"
        db.commit()

        log_audit_event(
            db,
            action="FAILED_LOGIN",
            user_id=user.id,
            username=user.username,
            ip_address=ip_addr,
            details={"failed_attempts": user.failed_login_attempts},
        )
        raise HTTPException(401, "Invalid credentials.")

    # Successful Login
    user.failed_login_attempts = 0
    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(user.id, user.role, user.permissions or [])
    refresh_token, expires_at = create_refresh_token(user.id, remember_me=req.remember_me)

    device, browser, _ = get_user_agent_details(request)

    session_entry = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        device=device,
        browser=browser,
        ip_address=ip_addr,
        expires_at=expires_at,
    )
    db.add(session_entry)
    db.commit()

    log_audit_event(db, action="LOGIN", user_id=user.id, username=user.username, ip_address=ip_addr)

    set_auth_cookies(response, access_token, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": format_user_dict(user, db),
    }


# --- LOGOUT ENDPOINT ---
@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke session and clear cookies."""
    if refresh_token_cookie:
        token_h = hash_token(refresh_token_cookie)
        session_entry = db.query(UserSession).filter(UserSession.refresh_token_hash == token_h).first()
        if session_entry:
            session_entry.is_revoked = True
            db.commit()

    if current_user:
        log_audit_event(db, action="LOGOUT", user_id=current_user.id, username=current_user.username, ip_address=get_client_ip(request))

    clear_auth_cookies(response)
    return {"message": "Logged out successfully."}


# --- REFRESH TOKEN ENDPOINT ---
@router.post("/refresh")
def refresh_token_endpoint(
    request: Request,
    response: Response,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    refresh_token_body: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Rotate refresh token and issue new access token."""
    raw_token = refresh_token_cookie or refresh_token_body
    if not raw_token:
        raise HTTPException(401, "Refresh token required.")

    payload = decode_jwt(raw_token)
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid token type.")

    user_id = payload.get("sub")
    token_h = hash_token(raw_token)

    session_entry = db.query(UserSession).filter(
        UserSession.refresh_token_hash == token_h,
        UserSession.is_revoked == False,
    ).first()

    if not session_entry or session_entry.expires_at < datetime.utcnow():
        raise HTTPException(401, "Session expired or revoked. Please log in again.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.account_status != "active":
        raise HTTPException(401, "User inactive or not found.")

    # Token Rotation: Revoke old session, create new session
    session_entry.is_revoked = True

    new_access_token = create_access_token(user.id, user.role, user.permissions or [])
    new_refresh_token, new_expires_at = create_refresh_token(user.id)

    device, browser, _ = get_user_agent_details(request)
    ip_addr = get_client_ip(request)

    new_session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(new_refresh_token),
        device=device,
        browser=browser,
        ip_address=ip_addr,
        expires_at=new_expires_at,
    )
    db.add(new_session)
    db.commit()

    set_auth_cookies(response, new_access_token, new_refresh_token)

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user": format_user_dict(user, db),
    }


# --- CURRENT USER / ME ENDPOINT ---
@router.get("/me")
def get_me(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Get active user profile and active workspace."""
    return format_user_dict(current_user, db)


# --- FORGOT & RESET PASSWORD ENDPOINTS ---
@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Request password reset token."""
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if user:
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        log_audit_event(
            db,
            action="FORGOT_PASSWORD_REQUEST",
            user_id=user.id,
            username=user.username,
            ip_address=get_client_ip(request),
        )
        return {
            "message": "If that email exists, password reset instructions have been dispatched.",
            "reset_token_dev": reset_token,  # Exposed for instant UI testing in dev mode
        }
    return {"message": "If that email exists, password reset instructions have been dispatched."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Reset password using reset token."""
    user = db.query(User).filter(User.password_reset_token == req.token).first()
    if not user or not user.password_reset_expires or user.password_reset_expires < datetime.utcnow():
        raise HTTPException(400, "Invalid or expired password reset token.")

    strength = validate_password_strength(req.new_password)
    if not strength["valid"]:
        raise HTTPException(400, f"Password weak: {'; '.join(strength['errors'])}")

    user.password_hash = hash_password(req.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.account_status = "active"
    user.failed_login_attempts = 0

    # Revoke all sessions for security
    db.query(UserSession).filter(UserSession.user_id == user.id).update({"is_revoked": True})
    db.commit()

    log_audit_event(db, action="PASSWORD_RESET", user_id=user.id, username=user.username, ip_address=get_client_ip(request))
    return {"message": "Password successfully reset. You may now log in."}


# --- EMAIL VERIFICATION ENDPOINT ---
@router.post("/verify-email")
def verify_email(req: VerifyEmailRequest, request: Request, db: Session = Depends(get_db)):
    """Verify user email address."""
    user = db.query(User).filter(User.email_verification_token == req.token).first()
    if not user:
        raise HTTPException(400, "Invalid verification token.")

    user.email_verified = True
    user.email_verification_token = None
    db.commit()

    log_audit_event(db, action="EMAIL_VERIFIED", user_id=user.id, username=user.username, ip_address=get_client_ip(request))
    return {"message": "Email verified successfully."}


# --- OAUTH SOCIAL LOGIN ENDPOINTS ---
@router.get("/oauth/{provider}/url")
def oauth_url(provider: str, redirect_uri: str = Query(...)):
    """Get OAuth authorization URL."""
    url = get_oauth_login_url(provider, redirect_uri)
    return {"provider": provider, "url": url}


@router.post("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    req: OAuthCallbackRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """OAuth callback handler."""
    oauth_user = await exchange_oauth_code(provider, req.code, req.redirect_uri)
    email = oauth_user["email"].lower()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Create new user via OAuth
        total_users = db.query(User).count()
        is_first = total_users == 0
        role = "System Owner" if is_first else "Member"
        permissions = ["admin:all"] if is_first else ["documents:read", "documents:write", "agents:execute"]

        username = oauth_user.get("username") or f"{provider}_{secrets.token_hex(4)}"
        if db.query(User).filter(User.username == username).first():
            username = f"{username}_{secrets.token_hex(2)}"

        user = User(
            first_name=oauth_user.get("first_name", provider.title()),
            last_name=oauth_user.get("last_name", "User"),
            username=username,
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            profile_picture=oauth_user.get("profile_picture"),
            role=role,
            permissions=permissions,
            email_verified=True,
            connected_accounts=[{"provider": provider, "connected_at": datetime.utcnow().isoformat()}],
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        ws = Workspace(name=f"{user.first_name}'s Workspace", owner_id=user.id)
        db.add(ws)
        db.commit()
        db.refresh(ws)

        member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="Owner")
        db.add(member)
        user.workspace = ws.id
        db.commit()
    else:
        # Link OAuth provider if not present
        accounts = user.connected_accounts or []
        if not any(acc.get("provider") == provider for acc in accounts):
            accounts.append({"provider": provider, "connected_at": datetime.utcnow().isoformat()})
            user.connected_accounts = accounts
            db.commit()

    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(user.id, user.role, user.permissions or [])
    refresh_token, expires_at = create_refresh_token(user.id)

    device, browser, _ = get_user_agent_details(request)
    ip_addr = get_client_ip(request)

    session_entry = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        device=device,
        browser=browser,
        ip_address=ip_addr,
        expires_at=expires_at,
    )
    db.add(session_entry)
    db.commit()

    log_audit_event(db, action=f"OAUTH_LOGIN_{provider.upper()}", user_id=user.id, username=user.username, ip_address=ip_addr)
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": format_user_dict(user, db),
    }


# --- PROFILE & SETTINGS ENDPOINTS ---
@router.put("/profile")
def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update user profile fields."""
    if req.first_name:
        current_user.first_name = req.first_name.strip()
    if req.last_name:
        current_user.last_name = req.last_name.strip()
    if req.username:
        clean_un = req.username.strip().lower()
        if clean_un != current_user.username:
            if db.query(User).filter(User.username == clean_un).first():
                raise HTTPException(400, "Username already in use.")
            current_user.username = clean_un
    if req.phone_number is not None:
        current_user.phone_number = req.phone_number
    if req.profile_picture is not None:
        current_user.profile_picture = req.profile_picture
    if req.timezone:
        current_user.timezone = req.timezone
    if req.language:
        current_user.language = req.language
    if req.theme:
        current_user.theme = req.theme
    if req.notification_preferences is not None:
        current_user.notification_preferences = req.notification_preferences

    db.commit()
    log_audit_event(db, action="UPDATE_PROFILE", user_id=current_user.id, username=current_user.username)
    return format_user_dict(current_user, db)


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Change active user password."""
    if not verify_password(req.old_password, current_user.password_hash):
        raise HTTPException(400, "Incorrect old password.")

    strength = validate_password_strength(req.new_password)
    if not strength["valid"]:
        raise HTTPException(400, f"Password weak: {'; '.join(strength['errors'])}")

    current_user.password_hash = hash_password(req.new_password)
    db.commit()
    log_audit_event(db, action="PASSWORD_CHANGE", user_id=current_user.id, username=current_user.username)
    return {"message": "Password updated successfully."}


@router.post("/api-keys")
def create_api_key(
    name: str = Query("Default Key"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Generate a new personal API key."""
    raw_key = f"dm_{secrets.token_urlsafe(32)}"
    key_id = f"key_{secrets.token_hex(4)}"
    key_entry = {
        "id": key_id,
        "name": name,
        "prefix": raw_key[:7] + "...",
        "key_hash": hash_token(raw_key),
        "created_at": datetime.utcnow().isoformat(),
    }
    keys = current_user.api_keys or []
    keys.append(key_entry)
    current_user.api_keys = keys
    db.commit()

    log_audit_event(db, action="CREATE_API_KEY", user_id=current_user.id, username=current_user.username, details={"key_name": name})
    return {"key_id": key_id, "api_key": raw_key, "name": name}


@router.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Revoke an API key."""
    keys = [k for k in (current_user.api_keys or []) if k.get("id") != key_id]
    current_user.api_keys = keys
    db.commit()
    log_audit_event(db, action="REVOKE_API_KEY", user_id=current_user.id, username=current_user.username, details={"key_id": key_id})
    return {"message": "API Key revoked."}


@router.delete("/account")
def delete_account(
    password: str = Query(...),
    current_user: User = Depends(get_current_active_user),
    response: Response = Response(),
    db: Session = Depends(get_db),
):
    """Permanently delete user account."""
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(400, "Password confirmation failed.")

    log_audit_event(db, action="DELETE_ACCOUNT", user_id=current_user.id, username=current_user.username)
    db.delete(current_user)
    db.commit()

    clear_auth_cookies(response)
    return {"message": "Account permanently deleted."}


# --- WORKSPACE MULTI-TENANCY ENDPOINTS ---
@router.get("/workspaces")
def get_workspaces(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """List workspaces owned or joined by user."""
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == current_user.id).all()
    results = []
    for m in memberships:
        ws = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if ws:
            results.append({
                "id": ws.id,
                "name": ws.name,
                "owner_id": ws.owner_id,
                "user_role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                "is_active": ws.id == current_user.workspace,
            })
    return results


@router.post("/workspaces")
def create_workspace(
    req: WorkspaceCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new workspace."""
    ws = Workspace(name=req.name.strip(), owner_id=current_user.id)
    db.add(ws)
    db.commit()
    db.refresh(ws)

    member = WorkspaceMember(workspace_id=ws.id, user_id=current_user.id, role="Owner")
    db.add(member)
    current_user.workspace = ws.id
    db.commit()

    log_audit_event(db, action="WORKSPACE_CREATE", user_id=current_user.id, username=current_user.username, resource=ws.name)
    return {"id": ws.id, "name": ws.name, "owner_id": ws.owner_id}


@router.put("/workspaces/{ws_id}")
def rename_workspace(
    ws_id: str,
    req: WorkspaceCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Rename workspace."""
    ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workspace not found.")
    if ws.owner_id != current_user.id and current_user.role != "System Owner":
        raise HTTPException(403, "Only workspace owner can rename.")

    ws.name = req.name.strip()
    db.commit()
    return {"id": ws.id, "name": ws.name}


@router.delete("/workspaces/{ws_id}")
def delete_workspace(
    ws_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete workspace."""
    ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if not ws:
        raise HTTPException(404, "Workspace not found.")
    if ws.owner_id != current_user.id and current_user.role != "System Owner":
        raise HTTPException(403, "Only workspace owner can delete.")

    db.delete(ws)
    db.commit()
    log_audit_event(db, action="WORKSPACE_DELETE", user_id=current_user.id, username=current_user.username, resource=ws.name)
    return {"message": "Workspace deleted."}


@router.post("/workspaces/switch/{ws_id}")
def switch_workspace(
    ws_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Switch active workspace context."""
    m = db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws_id, WorkspaceMember.user_id == current_user.id).first()
    if not m and current_user.role != "System Owner":
        raise HTTPException(403, "You are not a member of this workspace.")

    current_user.workspace = ws_id
    db.commit()
    return {"message": "Active workspace updated.", "workspace_id": ws_id}


# --- SESSION MANAGEMENT ENDPOINTS ---
@router.get("/sessions")
def list_sessions(
    request: Request,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """View user active sessions."""
    current_hash = hash_token(refresh_token_cookie) if refresh_token_cookie else None
    sessions = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_revoked == False,
        UserSession.expires_at > datetime.utcnow(),
    ).all()

    return [
        {
            "id": s.id,
            "device": s.device,
            "browser": s.browser,
            "ip_address": s.ip_address,
            "location": s.location,
            "last_activity": s.last_activity.isoformat() if s.last_activity else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "is_current": s.refresh_token_hash == current_hash,
        }
        for s in sessions
    ]


@router.post("/sessions/{session_id}/revoke")
def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Revoke a specific session."""
    s = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == current_user.id).first()
    if s:
        s.is_revoked = True
        db.commit()
    return {"message": "Session revoked."}


@router.post("/sessions/revoke-others")
def revoke_other_sessions(
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Revoke all sessions except current."""
    current_hash = hash_token(refresh_token_cookie) if refresh_token_cookie else None
    q = db.query(UserSession).filter(UserSession.user_id == current_user.id)
    if current_hash:
        q = q.filter(UserSession.refresh_token_hash != current_hash)
    q.update({"is_revoked": True})
    db.commit()
    return {"message": "All other sessions revoked."}


@router.post("/sessions/revoke-all")
def revoke_all_sessions(
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Revoke everywhere."""
    db.query(UserSession).filter(UserSession.user_id == current_user.id).update({"is_revoked": True})
    db.commit()
    clear_auth_cookies(response)
    return {"message": "Revoked all active sessions."}


# --- ADMIN PANEL ENDPOINTS ---
@router.get("/admin/users")
def admin_list_users(
    query: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    role_filter: Optional[str] = Query(None),
    current_user: User = Depends(require_role(["System Owner", "Admin"])),
    db: Session = Depends(get_db),
):
    """Admin view & search all registered users."""
    q = db.query(User)
    if query:
        term = f"%{query.strip().lower()}%"
        q = q.filter(
            (User.email.like(term))
            | (User.username.like(term))
            | (User.first_name.like(term))
            | (User.last_name.like(term))
        )
    if status_filter:
        q = q.filter(User.account_status == status_filter)
    if role_filter:
        q = q.filter(User.role == role_filter)

    users = q.order_by(User.created_at.desc()).all()
    return [format_user_dict(u, db) for u in users]


@router.post("/admin/users/{user_id}/status")
def admin_update_user_status(
    user_id: str,
    req: AdminStatusRequest,
    current_user: User = Depends(require_role(["System Owner", "Admin"])),
    db: Session = Depends(get_db),
):
    """Admin suspend, activate, or lock user account."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found.")

    if target.role == "System Owner" and current_user.role != "System Owner":
        raise HTTPException(403, "Cannot modify System Owner status.")

    target.account_status = req.status
    if req.status == "active":
        target.failed_login_attempts = 0

    db.commit()
    log_audit_event(
        db,
        action="ADMIN_UPDATE_USER_STATUS",
        user_id=current_user.id,
        username=current_user.username,
        resource=target.username,
        details={"new_status": req.status},
    )
    return format_user_dict(target, db)


@router.put("/admin/users/{user_id}/role")
def admin_update_user_role(
    user_id: str,
    req: AdminRoleRequest,
    current_user: User = Depends(require_role(["System Owner", "Admin"])),
    db: Session = Depends(get_db),
):
    """Admin update user system role."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found.")

    if target.role == "System Owner" and current_user.role != "System Owner":
        raise HTTPException(403, "Cannot change System Owner role.")

    target.role = req.role
    db.commit()
    log_audit_event(
        db,
        action="ADMIN_UPDATE_USER_ROLE",
        user_id=current_user.id,
        username=current_user.username,
        resource=target.username,
        details={"new_role": req.role},
    )
    return format_user_dict(target, db)


@router.post("/admin/users/{user_id}/reset-password")
def admin_force_reset_password(
    user_id: str,
    new_password: str = Query(..., min_length=8),
    current_user: User = Depends(require_role(["System Owner", "Admin"])),
    db: Session = Depends(get_db),
):
    """Admin force reset user password."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found.")

    strength = validate_password_strength(new_password)
    if not strength["valid"]:
        raise HTTPException(400, f"Password weak: {'; '.join(strength['errors'])}")

    target.password_hash = hash_password(new_password)
    target.account_status = "active"
    target.failed_login_attempts = 0

    # Revoke sessions
    db.query(UserSession).filter(UserSession.user_id == target.id).update({"is_revoked": True})
    db.commit()

    log_audit_event(
        db,
        action="ADMIN_FORCE_RESET_PASSWORD",
        user_id=current_user.id,
        username=current_user.username,
        resource=target.username,
    )
    return {"message": f"Password for {target.username} has been reset."}


@router.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: str,
    current_user: User = Depends(require_role(["System Owner", "Admin"])),
    db: Session = Depends(get_db),
):
    """Admin delete user account."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found.")

    if target.role == "System Owner":
        raise HTTPException(403, "Cannot delete System Owner.")

    db.delete(target)
    db.commit()
    log_audit_event(
        db,
        action="ADMIN_DELETE_USER",
        user_id=current_user.id,
        username=current_user.username,
        resource=target.username,
    )
    return {"message": "User deleted successfully."}


@router.get("/admin/audit-logs")
def admin_audit_logs(
    action: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_role(["System Owner", "Admin"])),
    db: Session = Depends(get_db),
):
    """View system audit logs."""
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    logs = q.order_by(AuditLog.timestamp.desc()).limit(limit).all()

    return [
        {
            "id": l.id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            "user_id": l.user_id,
            "username": l.username,
            "action": l.action,
            "resource": l.resource,
            "ip_address": l.ip_address,
            "details": l.details,
        }
        for l in logs
    ]
