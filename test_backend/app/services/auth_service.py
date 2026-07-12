import logging
import threading
from secrets import compare_digest

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserCreate

logger = logging.getLogger(__name__)

MOBILE_TEST_ACCOUNTS = ("admin", "admin1", "admin2")
MOBILE_ACCOUNT_KEY_PROFILES = {account: "default" for account in MOBILE_TEST_ACCOUNTS}
MOBILE_ACCOUNT_NICKNAMES = {
    "admin": "管理员",
    "admin1": "运营一号",
    "admin2": "运营二号",
}


def get_user_by_phone(db: Session, phone: str) -> User | None:
    return db.scalar(select(User).where(User.phone == phone))


def create_user(db: Session, payload: UserCreate) -> User:
    if get_user_by_phone(db, payload.phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="手机号已注册。",
        )

    user = User(
        phone=payload.phone,
        nickname=payload.nickname,
        role="promoter",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="手机号已注册。",
        )
    except Exception:
        db.rollback()
        logger.exception("Failed to create user with phone=%s", payload.phone)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="用户创建失败，请稍后重试。",
        )
    return user


# Dummy hash for constant-time comparison when the user does not exist,
# preventing user-enumeration via timing attacks.
# Lazily initialized to avoid PBKDF2 computation (100k iterations) at import time.
_DUMMY_HASH: str | None = None
_DUMMY_HASH_LOCK = threading.Lock()


def _get_dummy_hash() -> str:
    """惰性初始化并缓存 dummy hash，避免模块导入时执行 PBKDF2 计算。

    使用 threading.Lock 保护初始化，防止多线程并发时重复生成。
    """
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        with _DUMMY_HASH_LOCK:
            # 双重检查：获取锁后再次确认，避免多个线程同时通过外层检查
            if _DUMMY_HASH is None:
                _DUMMY_HASH = hash_password("dummy_password_for_timing_safety")
    return _DUMMY_HASH


def authenticate_user(db: Session, phone: str, password: str) -> User:
    user = get_user_by_phone(db, phone)
    if user is None:
        verify_password(password, _get_dummy_hash())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码不正确。",
        )
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码不正确。",
        )
    return user


def authenticate_mobile_account(db: Session, account: str, password: str) -> User:
    """Authenticate a mobile test account, creating a real User record if needed.

    Returns a User object (not just the account string) so that JWT tokens
    can be issued with a real user_id for data isolation.
    """
    normalized_account = account.strip()
    authenticated = None
    for candidate in MOBILE_TEST_ACCOUNTS:
        if compare_digest(normalized_account, candidate) and compare_digest(password, candidate):
            authenticated = candidate
            break

    if authenticated is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码不正确。",
        )

    # Find or create a real User record for this test account.
    # Use the account name as the phone field (unique identifier).
    user = db.scalar(select(User).where(User.phone == authenticated))
    if user is None:
        user = User(
            phone=authenticated,
            nickname=MOBILE_ACCOUNT_NICKNAMES.get(authenticated, authenticated),
            role="planner",
            password_hash=hash_password(authenticated),
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except IntegrityError:
            db.rollback()
            user = db.scalar(select(User).where(User.phone == authenticated))
            if user is None:
                raise
    return user


def mobile_account_key_profile(account: str) -> str:
    return MOBILE_ACCOUNT_KEY_PROFILES[account]


def issue_token(user: User) -> str:
    return create_access_token(subject=str(user.id), role=user.role)
