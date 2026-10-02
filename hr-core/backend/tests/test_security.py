"""Unit tests cho app.core.security - password hashing, validation, JWT encode/decode."""
import time
import uuid
from datetime import timedelta

import pytest
from passlib.exc import UnknownHashError

from app.config import settings
from app.core.constants import TokenType
from app.core.exceptions import BadRequestError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password_strength,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_returns_non_plaintext(self):
        hashed = hash_password("MySecret123")
        assert hashed != "MySecret123"
        assert len(hashed) > 20

    def test_hash_is_unique_per_call(self):
        h1 = hash_password("MySecret123")
        h2 = hash_password("MySecret123")
        assert h1 != h2

    def test_verify_correct_password(self):
        hashed = hash_password("MySecret123")
        assert verify_password("MySecret123", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("MySecret123")
        assert verify_password("WrongPassword", hashed) is False

    def test_verify_empty_password(self):
        hashed = hash_password("MySecret123")
        assert verify_password("", hashed) is False

    def test_verify_empty_hash_raises(self):
        with pytest.raises(UnknownHashError):
            verify_password("MySecret123", "")
        with pytest.raises(UnknownHashError):
            verify_password("MySecret123", "not-a-bcrypt-hash")


class TestPasswordValidation:
    def test_valid_password_passes(self):
        validate_password_strength("GoodPass1")
        validate_password_strength("Aa1longpassword")

    def test_too_short(self):
        with pytest.raises(BadRequestError) as exc:
            validate_password_strength("Ab1")
        assert "ít nhất 8" in exc.value.detail

    def test_missing_uppercase(self):
        with pytest.raises(BadRequestError) as exc:
            validate_password_strength("lowercase123")
        assert "chữ hoa" in exc.value.detail

    def test_missing_lowercase(self):
        with pytest.raises(BadRequestError) as exc:
            validate_password_strength("UPPERCASE123")
        assert "chữ thường" in exc.value.detail

    def test_missing_digit(self):
        with pytest.raises(BadRequestError) as exc:
            validate_password_strength("NoDigitsHere")
        assert "chữ số" in exc.value.detail

    def test_exactly_8_chars_valid(self):
        validate_password_strength("Aa1aaaaa")

    def test_7_chars_invalid(self):
        with pytest.raises(BadRequestError):
            validate_password_strength("Aa1aaaa")


class TestAccessToken:
    def test_create_and_decode_roundtrip(self):
        user_id = str(uuid.uuid4())
        token = create_access_token(user_id)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == user_id
        assert payload["type"] == TokenType.ACCESS
        assert payload["iss"] == settings.JWT_ISSUER
        assert payload["aud"] == settings.JWT_AUDIENCE

    def test_custom_expires_delta(self):
        user_id = str(uuid.uuid4())
        token = create_access_token(user_id, expires_delta=timedelta(hours=1))
        payload = decode_token(token)
        assert payload is not None
        assert payload["exp"] - int(payload["iat"]) == 3600

    def test_default_expires_uses_setting(self):
        user_id = str(uuid.uuid4())
        token = create_access_token(user_id)
        payload = decode_token(token)
        expected = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        actual = payload["exp"] - int(payload["iat"])
        assert abs(actual - expected) <= 1

    def test_invalid_signature_returns_none(self):
        token = create_access_token(str(uuid.uuid4()))
        tampered = token[:-2] + ("A" if token[-2] != "A" else "B") + token[-1]
        assert decode_token(tampered) is None

    def test_garbage_token_returns_none(self):
        assert decode_token("not-a-jwt") is None
        assert decode_token("") is None
        assert decode_token("a.b.c") is None

    def test_wrong_audience_returns_none(self):
        import jwt as pyjwt
        from datetime import datetime, timezone, timedelta
        token = pyjwt.encode(
            {
                "sub": "x",
                "type": "access",
                "aud": "wrong",
                "iss": settings.JWT_ISSUER,
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
                "iat": datetime.now(timezone.utc),
            },
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        assert decode_token(token) is None


class TestRefreshToken:
    def test_create_refresh_returns_token_and_jti(self):
        user_id = str(uuid.uuid4())
        token, jti = create_refresh_token(user_id)
        assert token
        assert jti
        uuid.UUID(jti)

    def test_refresh_token_payload(self):
        user_id = str(uuid.uuid4())
        token, _ = create_refresh_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == TokenType.REFRESH
        assert "jti" in payload

    def test_refresh_token_default_expires_7_days(self):
        user_id = str(uuid.uuid4())
        token, _ = create_refresh_token(user_id)
        payload = decode_token(token)
        expected = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
        actual = payload["exp"] - int(payload["iat"])
        assert abs(actual - expected) <= 1

    def test_custom_refresh_expires(self):
        user_id = str(uuid.uuid4())
        token, _ = create_refresh_token(user_id, expires_delta=timedelta(hours=2))
        payload = decode_token(token)
        assert payload["exp"] - int(payload["iat"]) == 7200

    def test_refresh_token_different_jti_each_time(self):
        user_id = str(uuid.uuid4())
        _, jti1 = create_refresh_token(user_id)
        time.sleep(0.01)
        _, jti2 = create_refresh_token(user_id)
        assert jti1 != jti2


class TestTokenTypeEnforcement:
    def test_access_token_decodes_with_type_access(self):
        token = create_access_token(str(uuid.uuid4()))
        payload = decode_token(token)
        assert payload["type"] == TokenType.ACCESS

    def test_refresh_token_decodes_with_type_refresh(self):
        token, _ = create_refresh_token(str(uuid.uuid4()))
        payload = decode_token(token)
        assert payload["type"] == TokenType.REFRESH

    def test_access_and_refresh_have_different_types(self):
        user_id = str(uuid.uuid4())
        access = create_access_token(user_id)
        refresh, _ = create_refresh_token(user_id)
        a = decode_token(access)
        r = decode_token(refresh)
        assert a["type"] != r["type"]
