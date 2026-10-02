"""Integration tests cho authentication API (/api/v1/auth/*).

Yêu cầu test DB. Sử dụng fixtures từ conftest.py:
- async_client: HTTP client
- db_admin_user: tạo sẵn admin user
- auth_headers: Bearer token cho admin
- manager_auth_headers: Bearer token cho manager
"""
import pytest

pytestmark = pytest.mark.asyncio


class TestLogin:
    async def test_login_success_returns_tokens(self, async_client, db_admin_user):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "AdminPass1!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data or "must_change_password" in data

    async def test_login_wrong_password_returns_401(self, async_client, db_admin_user):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "WrongPassword1!"},
        )
        assert response.status_code == 401
        body = response.json()
        assert "detail" in body
        assert "đúng" in body["detail"].lower() or "không" in body["detail"].lower()

    async def test_login_nonexistent_user_returns_401(self, async_client):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "Whatever1!"},
        )
        assert response.status_code == 401

    async def test_login_disabled_user_returns_401(self, async_client, db_department):
        from app.core.security import hash_password
        from app.models.user import User
        from tests.conftest import TestSessionLocal
        async with TestSessionLocal() as s:
            u = User(
                username="disabled",
                email="d@test.com",
                hashed_password=hash_password("Disabled1!"),
                full_name="Disabled User",
                is_active=False,
            )
            s.add(u)
            await s.commit()
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "disabled", "password": "Disabled1!"},
        )
        assert response.status_code == 401

    async def test_login_remember_me_extends_refresh(self, async_client, db_admin_user):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "AdminPass1!", "remember_me": True},
        )
        assert response.status_code == 200
        assert response.json()["access_token"]
        assert response.json()["refresh_token"]


class TestMe:
    async def test_me_returns_current_user_info(self, async_client, auth_headers, db_admin_user):
        response = await async_client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert data["is_super_admin"] is True
        assert "permissions" in data
        perms = data["permissions"]
        assert perms["can_manage_employees"] is True
        assert perms["can_manage_users"] is True

    async def test_me_without_auth_returns_401(self, async_client):
        response = await async_client.get("/api/v1/auth/me")
        assert response.status_code in (401, 403)

    async def test_me_with_invalid_token_returns_401(self, async_client):
        response = await async_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code in (401, 403)


class TestRefresh:
    async def test_refresh_with_valid_token(self, async_client, db_admin_user):
        login = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "AdminPass1!"},
        )
        refresh = login.json()["refresh_token"]
        old_refresh = login.json()["refresh_token"]

        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != old_refresh

    async def test_refresh_with_access_token_rejected(self, async_client, db_admin_user):
        login = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "AdminPass1!"},
        )
        access = login.json()["access_token"]

        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": access},
        )
        assert response.status_code == 401

    async def test_refresh_twice_revokes_first(self, async_client, db_admin_user):
        login = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "AdminPass1!"},
        )
        refresh = login.json()["refresh_token"]

        r1 = await async_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r1.status_code == 200

        r2 = await async_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r2.status_code == 401


class TestLogout:
    async def test_logout_revokes_all_tokens(self, async_client, db_admin_user):
        login = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "AdminPass1!"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        refresh = login.json()["refresh_token"]

        response = await async_client.post("/api/v1/auth/logout", headers=headers)
        assert response.status_code == 200
        assert "message" in response.json()

        r2 = await async_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r2.status_code == 401


class TestChangePassword:
    async def test_change_password_with_short_new_password(self, async_client, auth_headers):
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "AdminPass1!", "new_password": "weak"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_change_password_with_weak_new_password(self, async_client, auth_headers):
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "AdminPass1!", "new_password": "NoSpecialChar1"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_change_password_same_as_old(self, async_client, auth_headers):
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "AdminPass1!", "new_password": "AdminPass1!"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_change_password_wrong_old(self, async_client, auth_headers):
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "WrongPass1!", "new_password": "NewValid1!"},
            headers=auth_headers,
        )
        assert response.status_code == 400

    async def test_change_password_success(self, async_client, auth_headers):
        response = await async_client.post(
            "/api/v1/auth/change-password",
            json={"old_password": "AdminPass1!", "new_password": "NewValid1!"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert "message" in response.json()
