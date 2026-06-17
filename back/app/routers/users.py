from fastapi import APIRouter, Depends, HTTPException
from ..auth import require_roles, hash_password
from ..models import UserCreate, UserUpdate
from ..db import fetch_one, fetch_all, execute

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("")
def list_users(user=Depends(require_roles("admin"))):
    rows = fetch_all("select id,email,full_name,phone,status,client_id,client_name,client_cuit,role_id,role_code,role_name,created_at,updated_at from v_app_users_with_roles order by created_at desc")
    return rows


@router.post("")
def create_user(payload: UserCreate, user=Depends(require_roles("admin"))):
    role = fetch_one("select id from app_roles where code=%s", [payload.role_code])
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")
    row = execute(
        """
        insert into app_users (email, full_name, phone, role_id, client_id, password_hash, password_plain, status)
        values (%s,%s,%s,%s,%s,%s,%s,'active')
        returning id
        """,
        [payload.email, payload.full_name, payload.phone, role["id"], payload.client_id, hash_password(payload.password), payload.password],
    )
    if payload.client_id and payload.role_code == "cliente":
        execute("insert into client_users (client_id,user_id) values (%s,%s) on conflict do nothing", [payload.client_id, row["id"]])
    return fetch_one("select id,email,full_name,phone,status,client_id,client_name,role_code,role_name from v_app_users_with_roles where id=%s", [row["id"]])


@router.patch("/{user_id}")
def update_user(user_id: str, payload: UserUpdate, user=Depends(require_roles("admin"))):
    data = payload.model_dump(exclude_unset=True)
    if "role_code" in data:
        role = fetch_one("select id from app_roles where code=%s", [data.pop("role_code")])
        if not role:
            raise HTTPException(status_code=404, detail="Rol no encontrado")
        data["role_id"] = role["id"]
    if "password" in data:
        pwd = data.pop("password")
        data["password_hash"] = hash_password(pwd)
        data["password_plain"] = pwd
    if not data:
        return fetch_one("select id,email,full_name,phone,status,client_id,client_name,role_code,role_name from v_app_users_with_roles where id=%s", [user_id])
    sets = ", ".join([f"{k}=%s" for k in data.keys()])
    execute(f"update app_users set {sets} where id=%s returning id", list(data.values()) + [user_id])
    return fetch_one("select id,email,full_name,phone,status,client_id,client_name,role_code,role_name from v_app_users_with_roles where id=%s", [user_id])


@router.get("/{user_id}")
def get_user(user_id: str, user=Depends(require_roles("admin"))):
    row = fetch_one("select id,email,full_name,phone,status,client_id,client_name,client_cuit,role_code,role_name,created_at,updated_at from v_app_users_with_roles where id=%s", [user_id])
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return row
