from fastapi import APIRouter, Depends, HTTPException
from psycopg import errors
from ..auth import require_roles, get_current_user
from ..models import EquipmentCreate, EquipmentUpdate
from ..db import fetch_one, fetch_all, execute

router = APIRouter(prefix="/equipment", tags=["Equipment"])


@router.get("")
def list_equipment(client_id: str | None = None, q: str | None = None, user=Depends(get_current_user)):
    params = []
    where = []
    if user["role_code"] == "cliente":
        where.append("client_id in (select client_id from client_users where user_id=%s and can_view=true)")
        params.append(user["id"])
    if client_id:
        where.append("client_id=%s")
        params.append(client_id)
    if q:
        like = f"%{q}%"
        where.append("(e.name ilike %s or e.serial_number ilike %s or e.brand ilike %s or e.element ilike %s or e.location ilike %s)")
        params.extend([like, like, like, like, like])
    sql = "select e.*, c.name as client_name, c.cuit as client_cuit from equipment e join clients c on c.id=e.client_id"
    if where:
        sql += " where " + " and ".join(where)
    sql += " order by e.created_at desc limit 500"
    return fetch_all(sql, params)


@router.post("")
def create_equipment(payload: EquipmentCreate, user=Depends(require_roles("admin", "certificador"))):
    data = payload.model_dump()
    cols = list(data.keys())
    return execute(
        f"insert into equipment ({','.join(cols)}) values ({','.join(['%s']*len(cols))}) returning *",
        [data[c] for c in cols],
    )


@router.get("/{equipment_id}")
def get_equipment(equipment_id: str, user=Depends(get_current_user)):
    row = fetch_one("select e.*, c.name as client_name, c.cuit as client_cuit from equipment e join clients c on c.id=e.client_id where e.id=%s", [equipment_id])
    if not row:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return row


@router.patch("/{equipment_id}")
def update_equipment(equipment_id: str, payload: EquipmentUpdate, user=Depends(require_roles("admin", "certificador"))):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        row = fetch_one("select * from equipment where id=%s", [equipment_id])
        if not row:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        return row
    sets = ", ".join([f"{k}=%s" for k in data.keys()])
    row = execute(f"update equipment set {sets} where id=%s returning *", list(data.values()) + [equipment_id])
    if not row:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return row


@router.delete("/{equipment_id}")
def delete_equipment(equipment_id: str, hard: bool = True, user=Depends(require_roles("admin"))):
    existing = fetch_one("select id from equipment where id=%s", [equipment_id])
    if not existing:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    if not hard:
        execute("update equipment set active=false where id=%s returning id", [equipment_id])
        return {"ok": True, "deleted": False, "mode": "deactivated"}

    # Los certificados conservan snapshots históricos de equipo. Para permitir borrar
    # la referencia sin perder trazabilidad, se desvincula equipment_id antes de borrar.
    execute("update certificates set equipment_id=null where equipment_id=%s returning id", [equipment_id])
    try:
        execute("delete from equipment where id=%s returning id", [equipment_id])
    except errors.ForeignKeyViolation:
        raise HTTPException(
            status_code=409,
            detail="No se pudo eliminar el equipo porque tiene relaciones activas. Desactivelo o revise sus vínculos.",
        )
    return {"ok": True, "deleted": True, "mode": "hard"}


@router.get("/{equipment_id}/certificates")
def equipment_certificates(equipment_id: str, user=Depends(get_current_user)):
    return fetch_all("select * from v_certificates_status where equipment_id=%s order by calibration_date desc nulls last", [equipment_id])
