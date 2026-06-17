from fastapi import APIRouter, Depends, HTTPException
from ..auth import require_roles, get_current_user
from ..models import ClientCreate, ClientUpdate
from ..db import fetch_one, fetch_all, execute

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("")
def list_clients(q: str | None = None, active: bool | None = None, user=Depends(get_current_user)):
    params = []
    where = []
    if user["role_code"] == "cliente":
        where.append("id in (select client_id from client_users where user_id=%s and can_view=true)")
        params.append(user["id"])
    if active is not None:
        where.append("active=%s")
        params.append(active)
    if q:
        like = f"%{q}%"
        where.append("(name ilike %s or cuit ilike %s or email ilike %s)")
        params.extend([like, like, like])
    sql = "select * from clients"
    if where:
        sql += " where " + " and ".join(where)
    sql += " order by name"
    return fetch_all(sql, params)


@router.post("")
def create_client(payload: ClientCreate, user=Depends(require_roles("admin", "certificador"))):
    data = payload.model_dump()
    cols = list(data.keys())
    row = execute(
        f"insert into clients ({','.join(cols)}) values ({','.join(['%s']*len(cols))}) returning *",
        [data[c] for c in cols],
    )
    return row


@router.get("/{client_id}")
def get_client(client_id: str, user=Depends(get_current_user)):
    row = fetch_one("select * from clients where id=%s", [client_id])
    if not row:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if user["role_code"] == "cliente":
        allowed = fetch_one("select 1 from client_users where user_id=%s and client_id=%s and can_view=true", [user["id"], client_id])
        if not allowed:
            raise HTTPException(status_code=403, detail="No podés ver este cliente")
    return row


@router.patch("/{client_id}")
def update_client(client_id: str, payload: ClientUpdate, user=Depends(require_roles("admin", "certificador"))):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return fetch_one("select * from clients where id=%s", [client_id])
    sets = ", ".join([f"{k}=%s" for k in data.keys()])
    row = execute(f"update clients set {sets} where id=%s returning *", list(data.values()) + [client_id])
    if not row:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return row


@router.get("/{client_id}/summary")
def client_summary(client_id: str, user=Depends(get_current_user)):
    return fetch_one("select * from v_client_certificate_summary where client_id=%s", [client_id]) or {
        "client_id": client_id,
        "total_certificates": 0,
        "vigentes": 0,
        "vencidos": 0,
        "por_vencer": 0,
        "pendientes": 0,
        "rechazados": 0,
        "anulados": 0,
    }


@router.delete("/{client_id}")
def delete_client(client_id: str, hard: bool = False, user=Depends(require_roles("admin"))):
    if hard:
        row = execute("delete from clients where id=%s returning *", [client_id])
    else:
        row = execute("update clients set active=false where id=%s returning *", [client_id])
    if not row:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {"ok": True, "client": row}
