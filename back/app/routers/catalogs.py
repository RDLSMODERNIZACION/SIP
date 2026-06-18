from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import get_current_user, require_roles
from ..db import fetch_all, fetch_one, execute

router = APIRouter(prefix="/catalogs", tags=["Catalogs"])

CATALOGS: Dict[str, Dict[str, Any]] = {
    "units": {"table": "catalog_units", "cols": ["id", "name", "active", "created_at"]},
    "test-types": {"table": "catalog_test_types", "cols": ["id", "name", "active", "created_at"]},
    "elements": {"table": "catalog_elements", "cols": ["id", "name", "active", "created_at"]},
    "element-models": {"table": "catalog_element_models", "cols": ["id", "element_name", "full_name", "active", "created_at"]},
    "sizes": {"table": "catalog_sizes", "cols": ["id", "name", "active", "created_at"]},
    "frequencies": {"table": "catalog_frequencies", "cols": ["id", "name", "months", "active", "created_at"]},
    "pressure-rows": {"table": "catalog_pressure_rows", "cols": ["id", "name", "row_order", "active", "created_at"]},
    "brands": {"table": "catalog_brands", "cols": ["id", "name", "active", "created_at"]},
    "serial-numbers": {"table": "catalog_serial_numbers", "cols": ["id", "name", "active", "created_at"]},
    "ranges": {"table": "catalog_ranges", "cols": ["id", "name", "active", "created_at"]},
}


class EnsureCatalogItem(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    element_name: Optional[str] = None
    months: Optional[int] = None
    row_order: Optional[int] = None
    active: Optional[bool] = True


class UpdateCatalogItem(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    element_name: Optional[str] = None
    months: Optional[int] = None
    row_order: Optional[int] = None
    active: Optional[bool] = None


def _catalog(code: str) -> Dict[str, Any]:
    cfg = CATALOGS.get(code)
    if not cfg:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")
    return cfg


def _select_cols(cfg: Dict[str, Any]) -> str:
    return ", ".join(cfg["cols"])


@router.get("/{catalog_code}")
def list_catalog_items(
    catalog_code: str,
    active: Optional[bool] = Query(default=None),
    user=Depends(get_current_user),
):
    cfg = _catalog(catalog_code)
    table = cfg["table"]
    cols = _select_cols(cfg)

    where = ""
    params = []
    if active is not None:
        where = " where active = %s"
        params.append(active)

    order = " order by name asc"
    if catalog_code == "pressure-rows":
        order = " order by row_order asc, name asc"
    if catalog_code == "element-models":
        order = " order by element_name asc, full_name asc"

    try:
        return fetch_all(f"select {cols} from {table}{where}{order}", params)
    except Exception as exc:
        # Si falta una tabla de catálogo, devolvemos 404 claro.
        raise HTTPException(status_code=404, detail=f"Catálogo no disponible: {catalog_code}") from exc


@router.post("/{catalog_code}/ensure")
def ensure_catalog_item(
    catalog_code: str,
    payload: EnsureCatalogItem,
    user=Depends(require_roles("admin", "certificador", "aprobador")),
):
    cfg = _catalog(catalog_code)
    table = cfg["table"]
    cols = _select_cols(cfg)

    if catalog_code == "element-models":
        element_name = (payload.element_name or "").strip()
        full_name = (payload.full_name or payload.name or "").strip()
        if not full_name:
            raise HTTPException(status_code=400, detail="full_name es obligatorio")

        existing = fetch_one(
            f"""
            select {cols}
            from {table}
            where upper(full_name)=upper(%s)
              and coalesce(upper(element_name),'')=coalesce(upper(%s),'')
            limit 1
            """,
            [full_name, element_name],
        )
        if existing:
            if existing.get("active") is False:
                execute(f"update {table} set active=true where id=%s", [existing["id"]])
                return fetch_one(f"select {cols} from {table} where id=%s", [existing["id"]])
            return existing

        return fetch_one(
            f"insert into {table} (element_name, full_name, active) values (%s, %s, true) returning {cols}",
            [element_name, full_name],
        )

    name = (payload.name or payload.full_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name es obligatorio")

    existing = fetch_one(f"select {cols} from {table} where upper(name)=upper(%s) limit 1", [name])
    if existing:
        if existing.get("active") is False:
            execute(f"update {table} set active=true where id=%s", [existing["id"]])
            return fetch_one(f"select {cols} from {table} where id=%s", [existing["id"]])
        return existing

    if catalog_code == "frequencies":
        months = payload.months
        if months is None:
            digits = "".join(ch for ch in name if ch.isdigit())
            months = int(digits) if digits else 0
        return fetch_one(
            f"insert into {table} (name, months, active) values (%s, %s, true) returning {cols}",
            [name, months],
        )

    if catalog_code == "pressure-rows":
        return fetch_one(
            f"insert into {table} (name, row_order, active) values (%s, %s, true) returning {cols}",
            [name, payload.row_order or 1],
        )

    return fetch_one(
        f"insert into {table} (name, active) values (%s, true) returning {cols}",
        [name],
    )


@router.patch("/{catalog_code}/{item_id}")
def update_catalog_item(
    catalog_code: str,
    item_id: str,
    payload: UpdateCatalogItem,
    user=Depends(require_roles("admin", "certificador", "aprobador")),
):
    cfg = _catalog(catalog_code)
    table = cfg["table"]
    cols = _select_cols(cfg)
    data = payload.model_dump(exclude_unset=True)

    allowed_by_catalog = {
        "units": {"name", "active"},
        "test-types": {"name", "active"},
        "elements": {"name", "active"},
        "element-models": {"element_name", "full_name", "active"},
        "sizes": {"name", "active"},
        "frequencies": {"name", "months", "active"},
        "pressure-rows": {"name", "row_order", "active"},
        "brands": {"name", "active"},
        "serial-numbers": {"name", "active"},
        "ranges": {"name", "active"},
    }

    allowed = allowed_by_catalog.get(catalog_code, set())
    sets = []
    params = []
    for key, value in data.items():
        if key in allowed:
            sets.append(f"{key}=%s")
            params.append(value)

    if not sets:
        raise HTTPException(status_code=400, detail="Sin cambios")

    params.append(item_id)
    execute(f"update {table} set {', '.join(sets)} where id=%s", params)
    row = fetch_one(f"select {cols} from {table} where id=%s", [item_id])
    if not row:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    return row


@router.delete("/{catalog_code}/{item_id}")
def delete_catalog_item(
    catalog_code: str,
    item_id: str,
    hard: bool = Query(default=False),
    user=Depends(require_roles("admin", "certificador", "aprobador")),
):
    cfg = _catalog(catalog_code)
    table = cfg["table"]

    if hard:
        execute(f"delete from {table} where id=%s", [item_id])
    else:
        execute(f"update {table} set active=false where id=%s", [item_id])

    return {"ok": True}
