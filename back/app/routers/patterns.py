from fastapi import APIRouter, Depends, HTTPException
from ..auth import require_roles, get_current_user
from ..models import PatternCreate, PatternUpdate
from ..db import fetch_one, fetch_all, execute

router = APIRouter(prefix="/patterns", tags=["Patterns"])


@router.get("")
def list_patterns(q: str | None = None, status: str | None = None, user=Depends(get_current_user)):
    params = []
    where = []
    if q:
        like = f"%{q}%"
        where.append("(name ilike %s or serial_number ilike %s or certificate_number ilike %s)")
        params.extend([like, like, like])
    if status:
        where.append("visible_status=%s")
        params.append(status)
    sql = "select * from v_measurement_patterns_status"
    if where:
        sql += " where " + " and ".join(where)
    sql += " order by recalibration_date asc nulls last"
    return fetch_all(sql, params)


@router.post("")
def create_pattern(payload: PatternCreate, user=Depends(require_roles("admin", "certificador"))):
    data = payload.model_dump()
    cols = list(data.keys())
    return execute(
        f"insert into measurement_patterns ({','.join(cols)}) values ({','.join(['%s']*len(cols))}) returning *",
        [data[c] for c in cols],
    )


@router.get("/{pattern_id}")
def get_pattern(pattern_id: str, user=Depends(get_current_user)):
    row = fetch_one("select * from v_measurement_patterns_status where id=%s", [pattern_id])
    if not row:
        raise HTTPException(status_code=404, detail="Patrón no encontrado")
    return row


@router.patch("/{pattern_id}")
def update_pattern(pattern_id: str, payload: PatternUpdate, user=Depends(require_roles("admin", "certificador"))):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return fetch_one("select * from v_measurement_patterns_status where id=%s", [pattern_id])
    sets = ", ".join([f"{k}=%s" for k in data.keys()])
    row = execute(f"update measurement_patterns set {sets} where id=%s returning *", list(data.values()) + [pattern_id])
    if not row:
        raise HTTPException(status_code=404, detail="Patrón no encontrado")
    return row
