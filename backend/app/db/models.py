"""SQLAlchemy ORM models for AgentVerse IAM & Workspace Multi-Tenancy."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    profile_picture = Column(Text, nullable=True)
    role = Column(String(50), default="Member", index=True)  # System Owner, Admin, Manager, Member, Guest
    permissions = Column(JSON, default=list)  # Granular system permissions
    organization = Column(String(100), default="AgentVerse Enterprise")

    workspace = Column(String(36), nullable=True)  # Active workspace ID

    account_status = Column(String(30), default="active")  # active, suspended, unverified, locked
    email_verified = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)

    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    email_verification_token = Column(String(255), nullable=True)

    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")
    theme = Column(String(20), default="system")
    notification_preferences = Column(
        JSON,
        default=lambda: {
            "email_alerts": True,
            "security_alerts": True,
            "workspace_invites": True,
            "agent_completion": True,
        },
    )
    api_keys = Column(JSON, default=list)  # List of API key objects
    connected_accounts = Column(JSON, default=list)  # OAuth providers linked

    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    owned_workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    workspace_memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="owned_workspaces")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    role = Column(String(30), default="Member")  # Owner, Admin, Manager, Member, Guest
    joined_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    refresh_token_hash = Column(String(255), index=True, nullable=False)
    device = Column(String(100), default="Unknown Device")
    browser = Column(String(100), default="Unknown Browser")
    ip_address = Column(String(50), default="127.0.0.1")
    location = Column(String(100), default="Unknown Location")
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)

    user = relationship("User", back_populates="sessions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String(36), nullable=True)
    username = Column(String(100), default="Anonymous")
    action = Column(String(100), nullable=False)
    resource = Column(String(255), default="System")
    ip_address = Column(String(50), default="127.0.0.1")
    details = Column(JSON, default=dict)
