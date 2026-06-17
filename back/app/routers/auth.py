from fastapi import APIRouter, Depends, HTTPException
from ..models import LoginRequest, TokenResponse
from ..auth import authenticate_user, create_access_token, get_current_user, user_permissions
from ..db import execute

router = APIRouter(prefix="/auth", tags=["Auth"])


def public_user(user):
    data = dict(user)
    data.pop("password_hash", None)
    data.pop("password_plain", None)
    return data


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    execute("update app_users set last_login_at=now() where id=%s returning id", [user["id"]])
    token = create_access_token({"sub": str(user["id"]), "email": user["email"], "role": user["role_code"]})
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@router.get("/me")
def me(user=Depends(get_current_user)):
    perms = [r["code"] for r in user_permissions(user["id"])]
    data = public_user(user)
    data["permissions"] = perms
    return data
