from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from .config import settings
from .db import fetch_one, fetch_all

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: Optional[str], password_plain: Optional[str] = None) -> bool:
    if password_hash:
        try:
            if pwd_context.verify(plain_password, password_hash):
                return True
        except Exception:
            pass
    # Fallback solo para desarrollo inicial.
    return bool(password_plain and plain_password == password_plain)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def authenticate_user(email: str, password: str):
    user = fetch_one("select * from v_app_users_with_roles where lower(email)=lower(%s)", [email])
    if not user:
        return None
    if user["status"] != "active":
        return None
    if not verify_password(password, user.get("password_hash"), user.get("password_plain")):
        return None
    return user


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = fetch_one("select * from v_app_users_with_roles where id=%s", [user_id])
    if not user or user["status"] != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no autorizado")
    return user


def require_roles(*roles: str):
    def checker(user=Depends(get_current_user)):
        if user["role_code"] not in roles:
            raise HTTPException(status_code=403, detail="No tenés permisos para esta acción")
        return user
    return checker


def user_permissions(user_id: str):
    return fetch_all(
        """
        select p.code
        from app_users u
        join app_role_permissions rp on rp.role_id = u.role_id
        join app_permissions p on p.id = rp.permission_id
        where u.id = %s
        """,
        [user_id],
    )


def require_permission(permission_code: str):
    def checker(user=Depends(get_current_user)):
        rows = user_permissions(user["id"])
        codes = {r["code"] for r in rows}
        if permission_code not in codes:
            raise HTTPException(status_code=403, detail="No tenés permisos para esta acción")
        return user
    return checker
