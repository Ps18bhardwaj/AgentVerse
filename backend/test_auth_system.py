"""Automated test suite for AgentVerse production Auth & IAM system."""
import os
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# Set test DB environment before importing app
TEST_DB_FILE = Path(__file__).resolve().parent / "data" / "test_auth.db"
if TEST_DB_FILE.exists():
    TEST_DB_FILE.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"

from app.api.main import app
from app.db.database import Base, engine, init_db

# Create tables
init_db()

client = TestClient(app)



def test_auth_complete_flow():
    print("\n--- TEST 1: First User Registration (System Owner Rule) ---")
    reg_resp_1 = client.post(
        "/auth/register",
        json={
            "first_name": "System",
            "last_name": "Owner",
            "username": "sysowner",
            "email": "owner@agentverse.ai",
            "password": "SuperSecretPass123!",
        },
    )
    assert reg_resp_1.status_code == 200, f"Reg 1 failed: {reg_resp_1.text}"
    user1 = reg_resp_1.json()["user"]
    token1 = reg_resp_1.json()["access_token"]
    assert user1["role"] == "System Owner", f"Expected System Owner, got {user1['role']}"
    assert user1["email_verified"] is True
    print(f"✓ System Owner registered: {user1['email']} with role {user1['role']}")

    print("\n--- TEST 2: Second User Registration (Default Member Role) ---")
    reg_resp_2 = client.post(
        "/auth/register",
        json={
            "first_name": "Alex",
            "last_name": "Engineer",
            "username": "alexeng",
            "email": "alex@agentverse.ai",
            "password": "DeveloperPass123!",
        },
    )
    assert reg_resp_2.status_code == 200, f"Reg 2 failed: {reg_resp_2.text}"
    user2 = reg_resp_2.json()["user"]
    assert user2["role"] == "Member", f"Expected Member, got {user2['role']}"
    print(f"✓ Member registered: {user2['email']} with role {user2['role']}")


    print("\n--- TEST 3: Route Protection (Unauthenticated Request) ---")
    client.cookies.clear()
    unauth_resp = client.get("/documents")
    assert unauth_resp.status_code == 401, f"Expected 401, got {unauth_resp.status_code}"
    print("✓ Unauthenticated access correctly blocked (401 Unauthorized)")


    print("\n--- TEST 4: Route Protection (Authenticated Request) ---")
    auth_resp = client.get("/documents", headers={"Authorization": f"Bearer {token1}"})
    assert auth_resp.status_code == 200, f"Expected 200, got {auth_resp.status_code}"
    print("✓ Authenticated access allowed (200 OK)")

    print("\n--- TEST 5: Password Lockout on Failed Attempts ---")
    for i in range(5):
        fail_resp = client.post(
            "/auth/login",
            json={"email_or_username": "alex@agentverse.ai", "password": "WrongPassword!"},
        )
        assert fail_resp.status_code in [401, 403]

    lock_check = client.post(
        "/auth/login",
        json={"email_or_username": "alex@agentverse.ai", "password": "DeveloperPass123!"},
    )
    assert lock_check.status_code == 403, f"Expected 403 locked, got {lock_check.status_code}"
    assert "locked" in lock_check.text.lower()
    print("✓ Account correctly locked after 5 failed attempts")

    print("\n--- TEST 6: Admin Unlocks User & Admin Operations ---")
    admin_headers = {"Authorization": f"Bearer {token1}"}
    unlock_resp = client.post(
        f"/auth/admin/users/{user2['id']}/status",
        headers=admin_headers,
        json={"status": "active"},
    )
    assert unlock_resp.status_code == 200, f"Unlock failed: {unlock_resp.text}"
    assert unlock_resp.json()["account_status"] == "active"
    print("✓ Admin successfully unlocked user account")

    print("\n--- TEST 7: Login & Token Refresh Rotation ---")
    login_resp = client.post(
        "/auth/login",
        json={"email_or_username": "alex@agentverse.ai", "password": "DeveloperPass123!"},
    )

    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    ref_token = login_resp.json()["refresh_token"]
    client.cookies.clear()
    refresh_resp = client.post("/auth/refresh", cookies={"refresh_token": ref_token})


    assert refresh_resp.status_code == 200, f"Refresh failed: {refresh_resp.text}"
    new_acc_token = refresh_resp.json()["access_token"]
    assert new_acc_token != token1
    print("✓ Token refresh & rotation succeeded")

    print("\n--- TEST 8: Workspaces & Multi-Tenancy ---")
    ws_create = client.post(
        "/auth/workspaces",
        headers=admin_headers,
        json={"name": "Research Workspace"},
    )
    assert ws_create.status_code == 200, f"Workspace create failed: {ws_create.text}"
    ws_id = ws_create.json()["id"]

    ws_list = client.get("/auth/workspaces", headers=admin_headers)
    assert ws_list.status_code == 200
    assert len(ws_list.json()) >= 1
    print("✓ Workspace management verified")

    print("\n--- TEST 9: Admin Audit Logs ---")
    audit_resp = client.get("/auth/admin/audit-logs", headers=admin_headers)
    assert audit_resp.status_code == 200
    assert len(audit_resp.json()) > 0
    print("✓ Admin audit logs verified")

    print("\nALL AUTHENTICATION & IAM TESTS PASSED SUCCESSFULLY! 🎉\n")

if __name__ == "__main__":
    test_auth_complete_flow()
