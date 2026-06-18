from fastapi import APIRouter, Depends, HTTPException, Query
from ..auth import require_roles, hash_password
from ..models import UserCreate, UserUpdate
from ..db import fetch_one, fetch_all, execute

router = APIRouter(prefix="/users", tags=["Users"])

USER_SELECT = """
select
  id,
  email,
  full_name,
  phone,
  status,
  client_id,
  client_name,
  client_cuit,
  role_id,
  role_code,
  role_name,
  created_at,
  updated_at
from v_app_users_with_roles
"""


def get_user_row(user_id: str):
    return fetch_one(USER_SELECT + " where id=%s", [user_id])


def sync_client_user_link(user_id: str, role_code: str | None, client_id):
    execute("delete from client_users where user_id=%s", [user_id])
    if role_code == "cliente" and client_id:
        execute(
            """
            insert into client_users (client_id, user_id, can_view, can_download)
            values (%s, %s, true, true)
            on conflict (client_id, user_id) do update set
              can_view = excluded.can_view,
              can_download = excluded.can_download
            """,
            [client_id, user_id],
        )


@router.get("")
def list_users(user=Depends(require_roles("admin"))):
    return fetch_all(USER_SELECT + " order by created_at desc")


@router.post("")
def create_user(payload: UserCreate, user=Depends(require_roles("admin"))):
    role = fetch_one("select id, code from app_roles where code=%s", [payload.role_code])
    if not role:
        raise HTTPException(status_code=404, detail="Rol no encontrado")

    existing = fetch_one("select id from app_users where lower(email)=lower(%s)", [payload.email])
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email")

    row = execute(
        """
        insert into app_users (
          email,
          full_name,
          phone,
          role_id,
          client_id,
          password_hash,
          password_plain,
          status
        )
        values (%s, %s, %s, %s, %s, %s, %s, 'active')
        returning id
        """,
        [
            payload.email,
            payload.full_name,
            payload.phone,
            role["id"],
            payload.client_id,
            hash_password(payload.password),
            payload.password,
        ],
    )

    sync_client_user_link(row["id"], role["code"], payload.client_id)
    return get_user_row(row["id"])


@router.get("/{user_id}")
def get_user(user_id: str, user=Depends(require_roles("admin"))):
    row = get_user_row(user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return row


@router.patch("/{user_id}")
def update_user(user_id: str, payload: UserUpdate, user=Depends(require_roles("admin"))):
    current = get_user_row(user_id)
    if not current:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    data = payload.model_dump(exclude_unset=True)
    role_code = data.pop("role_code", None)

    if role_code is not None:
        role = fetch_one("select id, code from app_roles where code=%s", [role_code])
        if not role:
            raise HTTPException(status_code=404, detail="Rol no encontrado")
        data["role_id"] = role["id"]
    else:
        role_code = current.get("role_code")

    if "password" in data:
        pwd = data.pop("password")
        if pwd:
            data["password_hash"] = hash_password(pwd)
            data["password_plain"] = pwd

    # Si cambió a un rol que no es cliente y no se envió client_id explícito,
    # limpiamos la asociación para evitar accesos heredados por error.
    if role_code != "cliente" and "client_id" not in data:
        data["client_id"] = None

    if data:
        sets = ", ".join([f"{key}=%s" for key in data.keys()])
        execute(f"update app_users set {sets} where id=%s returning id", list(data.values()) + [user_id])

    updated = get_user_row(user_id)
    sync_client_user_link(user_id, updated.get("role_code"), updated.get("client_id"))
    return updated


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    hard: bool = Query(True),
    user=Depends(require_roles("admin")),
):
    current = get_user_row(user_id)
    if not current:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not hard:
        execute("update app_users set status='disabled' where id=%s returning id", [user_id])
        sync_client_user_link(user_id, current.get("role_code"), None)
        return {"ok": True, "deleted": False, "disabled": True}

    # Desvincular referencias para no perder certificados históricos.
    execute(
        """
        update certificates
        set
          created_by = case when created_by=%s then null else created_by end,
          submitted_by = case when submitted_by=%s then null else submitted_by end,
          approved_by = case when approved_by=%s then null else approved_by end,
          rejected_by = case when rejected_by=%s then null else rejected_by end,
          annulled_by = case when annulled_by=%s then null else annulled_by end
        where created_by=%s
           or submitted_by=%s
           or approved_by=%s
           or rejected_by=%s
           or annulled_by=%s
        """,
        [user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id],
    )
    execute("update certificate_audit_log set user_id=null where user_id=%s", [user_id])
    execute("update certificate_comments set user_id=null where user_id=%s", [user_id])
    execute("update certificate_files set uploaded_by=null where uploaded_by=%s", [user_id])
    execute("delete from client_users where user_id=%s", [user_id])
    execute("delete from app_users where id=%s returning id", [user_id])

    return {"ok": True, "deleted": True}
