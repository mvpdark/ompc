try:
    from datetime import UTC, datetime, timedelta
except ImportError:
    from datetime import datetime, timedelta, timezone
    UTC = timezone.utc
import hashlib
import hmac

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 (no external deps needed)."""
    salt = b"opc_salt_v1"
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"pbkdf2${dk.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a pbkdf2 hash."""
    if not password_hash.startswith("pbkdf2$"):
        return False
    stored_hash = password_hash[7:]
    salt = b"opc_salt_v1"
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return hmac.compare_digest(dk.hex(), stored_hash)


def create_access_token(subject: str, role: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "role": role, "iat": datetime.now(UTC), "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, str]:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录已失效，请重新登录。",
        ) from exc

    subject = payload.get("sub")
    role = payload.get("role")
    if not isinstance(subject, str) or not isinstance(role, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录状态异常，请重新登录。",
        )
    return {"sub": subject, "role": role}
