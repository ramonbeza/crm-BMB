from datetime import datetime, timedelta, timezone
from typing import Any
import hashlib
import secrets

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _bcrypt_safe(password: str) -> str:
    # bcrypt trunca/erra acima de 72 bytes. Truncamos defensivamente em bytes.
    return password.encode("utf-8")[:72].decode("utf-8", "ignore")


def hash_password(password: str) -> str:
    return pwd_context.hash(_bcrypt_safe(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    plain_password = _bcrypt_safe(plain_password)
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str | Any, extra_claims: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(subject), "exp": expire, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def create_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, hashed_token). Store hash; send raw to client."""
    raw = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()
