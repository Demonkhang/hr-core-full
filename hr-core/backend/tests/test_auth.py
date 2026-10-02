"""Tests for the authentication endpoints.

These tests focus on request validation (which doesn't require a DB)
and the unified error envelope. Real auth flows need a PostgreSQL test DB
and are marked with @pytest.mark.db.
"""
import pytest


@pytest.mark.asyncio
async def test_login_missing_body_returns_422(async_client):
    response = await async_client.post("/api/v1/auth/login", json={})
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Dữ liệu đầu vào không hợp lệ"
    assert "errors" in body
    assert isinstance(body["errors"], list)
    assert len(body["errors"]) >= 2


@pytest.mark.asyncio
async def test_login_invalid_types_returns_422(async_client):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"username": 123, "password": ["a", "b"]},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Dữ liệu đầu vào không hợp lệ"
    fields = {err["field"] for err in body["errors"]}
    assert any("username" in f for f in fields)
    assert any("password" in f for f in fields)


@pytest.mark.asyncio
async def test_refresh_missing_token_returns_422(async_client):
    response = await async_client.post("/api/v1/auth/refresh", json={})
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Dữ liệu đầu vào không hợp lệ"
    fields = {err["field"] for err in body["errors"]}
    assert any("refresh_token" in f for f in fields)


@pytest.mark.asyncio
async def test_change_password_missing_fields_returns_422(async_client):
    response = await async_client.post(
        "/api/v1/auth/change-password",
        json={},
        headers={"Authorization": "Bearer fake"},
    )
    assert response.status_code in (401, 422)


@pytest.mark.asyncio
async def test_me_requires_authentication(async_client):
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_logout_requires_authentication(async_client):
    response = await async_client.post("/api/v1/auth/logout")
    assert response.status_code in (401, 403)
