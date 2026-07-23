"""OAuth 2.0 Social Login protocol integration (Google, GitHub, Microsoft)."""
from __future__ import annotations

import os
import urllib.parse
from typing import Any, Dict, Optional
import httpx
from fastapi import HTTPException, status

# Environment OAuth settings
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")

MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")


def get_oauth_login_url(provider: str, redirect_uri: str) -> str:
    """Generate OAuth authorization URL for provider."""
    provider_lower = provider.lower()
    state = "agentverse_oauth_state_nonce"


    if provider_lower == "google":
        client_id = GOOGLE_CLIENT_ID or "mock_google_client_id"
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    elif provider_lower == "github":
        client_id = GITHUB_CLIENT_ID or "mock_github_client_id"
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": "read:user user:email",
            "state": state,
        }
        return f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"

    elif provider_lower == "microsoft":
        client_id = MICROSOFT_CLIENT_ID or "mock_microsoft_client_id"
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile User.Read",
            "state": state,
        }
        return f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider '{provider}'",
        )


async def exchange_oauth_code(provider: str, code: str, redirect_uri: str) -> Dict[str, Any]:
    """Exchange authorization code for user profile from provider."""
    provider_lower = provider.lower()

    # Fallback simulation mode if credentials are not configured in environment
    if provider_lower == "google" and not GOOGLE_CLIENT_SECRET:
        return {
            "provider": "google",
            "provider_user_id": f"google_{hash(code) % 100000}",
            "email": f"user_{code[:6].lower()}@gmail.com",
            "first_name": "Google",
            "last_name": "User",
            "username": f"google_user_{code[:6].lower()}",
            "profile_picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
        }
    elif provider_lower == "github" and not GITHUB_CLIENT_SECRET:
        return {
            "provider": "github",
            "provider_user_id": f"github_{hash(code) % 100000}",
            "email": f"github_{code[:6].lower()}@users.noreply.github.com",
            "first_name": "GitHub",
            "last_name": "Developer",
            "username": f"github_dev_{code[:6].lower()}",
            "profile_picture": "https://avatars.githubusercontent.com/u/9919?v=4",
        }
    elif provider_lower == "microsoft" and not MICROSOFT_CLIENT_SECRET:
        return {
            "provider": "microsoft",
            "provider_user_id": f"ms_{hash(code) % 100000}",
            "email": f"ms_{code[:6].lower()}@outlook.com",
            "first_name": "Microsoft",
            "last_name": "User",
            "username": f"ms_user_{code[:6].lower()}",
            "profile_picture": None,
        }

    async with httpx.AsyncClient(timeout=10.0) as client:
        if provider_lower == "google":
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_res.status_code != 200:
                raise HTTPException(400, f"Google OAuth failed: {token_res.text}")
            access_token = token_res.json().get("access_token")

            user_res = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            data = user_res.json()
            return {
                "provider": "google",
                "provider_user_id": data.get("id"),
                "email": data.get("email"),
                "first_name": data.get("given_name") or "Google",
                "last_name": data.get("family_name") or "User",
                "username": data.get("email", "").split("@")[0],
                "profile_picture": data.get("picture"),
            }

        elif provider_lower == "github":
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
            if token_res.status_code != 200:
                raise HTTPException(400, f"GitHub OAuth failed: {token_res.text}")
            access_token = token_res.json().get("access_token")

            user_res = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}", "User-Agent": "AgentVerse-App"},
            )
            data = user_res.json()
            email = data.get("email")

            if not email:
                email_res = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}", "User-Agent": "AgentVerse-App"},
                )

                emails = email_res.json()
                primary = next((e for e in emails if e.get("primary")), {})
                email = primary.get("email") or f"{data.get('login')}@users.noreply.github.com"

            name_parts = (data.get("name") or data.get("login") or "GitHub User").split(" ", 1)
            return {
                "provider": "github",
                "provider_user_id": str(data.get("id")),
                "email": email,
                "first_name": name_parts[0],
                "last_name": name_parts[1] if len(name_parts) > 1 else "",
                "username": data.get("login"),
                "profile_picture": data.get("avatar_url"),
            }

        elif provider_lower == "microsoft":
            token_res = await client.post(
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                data={
                    "client_id": MICROSOFT_CLIENT_ID,
                    "client_secret": MICROSOFT_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_res.status_code != 200:
                raise HTTPException(400, f"Microsoft OAuth failed: {token_res.text}")
            access_token = token_res.json().get("access_token")

            user_res = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            data = user_res.json()
            email = data.get("mail") or data.get("userPrincipalName")
            return {
                "provider": "microsoft",
                "provider_user_id": data.get("id"),
                "email": email,
                "first_name": data.get("givenName") or "Microsoft",
                "last_name": data.get("surname") or "User",
                "username": email.split("@")[0] if email else "ms_user",
                "profile_picture": None,
            }

        else:
            raise HTTPException(400, "Unknown provider.")
