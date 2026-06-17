from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from ..auth import require_roles, get_current_user
from ..db import fetch_one, fetch_all, execute

router = APIRouter(prefix="/catalogs", tags=["Catalogs"])

CATALOGS: dict[str, dict[str, Any]] = {
    "units": {
        "table": "catalog_units",
        "label": "Unidades de medida",
        "fields": ["name", "active"],
        "search": ["name"],
        "order": "name",
    },
    "test-types": {
        "table": "catalog_test_types",
        "label": "Tipos de prueba",
        "fields": ["name", "active"],
        "search": ["name"],
        "order": "name",
    },
    "elements": {
        "table": "catalog_elements",
        "label": "Elementos",
        "fields": ["name", "default_frequency_months", "active"],
        "search": ["name"],
        "order": "name",
    },
    "element-models": {
        "table": "catalog_element_models",
        "label": "Modelos por elemento",
        "fields": ["element_name", "part_1", "part_2", "part_3", "full_name", "active"],
        "search": ["element_name", "part_1", "part_2", "part_3", "full_name"],
        "order": "element_name, full_name",
    },
    "sizes": {
        "table": "catalog_sizes",
        "label": "Sizes",
        "fields": ["name", "active"],
        "search": ["name"],
        "order": "name",
    },
    "frequencies": {
        "table": "catalog_frequencies",
        "label": "Frecuencias",
        "fields": ["name", "months", "active"],
        "search": ["name"],
        "order": "months",
    },
    "pressure-rows": {
        "table": "catalog_pressure_rows",
        "label": "Filas de presión",
        "fields": ["name", "row_order", "active"],
        "search": ["name"],
        "order": "row_order",
    },
    "payment-terms": {
        "table": "catalog_payment_terms",
        "label": "Condiciones de pago",
        "fields": ["name", "active"],
        "search": ["name"],
        "order": "name",
    },
    "pricing": {
        "table": "catalog_element_pricing",
        "label": "Precios y tiempos",
        "fields": ["element_name", "type_name", "price", "estimated_minutes", "active"],
        "search": ["element_name", "type_name"],
        "order": "element_name, type_name",
    },
}


class CatalogPayload(BaseModel):
    name: str | None = None
    element_name: str | None = None
    default_frequency_months: int | None = None
    part_1: str | None = None
    part_2: str | None = None
    part_3: str | None = None
    full_name: str | None = None
    months: int | None = None
    row_order: int | None = None
    type_name: str | None = None
    price: float | None = None
    estimated_minutes: float | None = None
    active: bool | None = True


class CatalogUpdatePayload(BaseModel):
    name: str | None = None
    element_name: str | None = None
    default_frequency_months: int | None = None
    part_1: str | None = None
    part_2: str | None = None
    part_3: str | None = None
    full_name: str | None = None
    months: int | None = None
    row_order: int | None = None
    type_name: str | None = None
    price: float | None = None
    estimated_minutes: float | None = None
    active: bool | None = None


def _config(catalog: str) -> dict[str, Any]:
    cfg = CATALOGS.get(catalog)
    if not cfg:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")
    return cfg


def _clean_data(payload: BaseModel, allowed: list[str], partial: bool = False) -> dict[str, Any]:
    raw = payload.model_dump(exclude_unset=partial)
    data: dict[str, Any] = {}
    for key, value in raw.items():
        if key not in allowed:
            continue
        if isinstance(value, str):
            value = " ".join(value.strip().split())
            if value == "":
                value = None
        if value is not None or key == "active":
            data[key] = value
    return data


def _sync_element_id_if_needed(catalog: str, data: dict[str, Any]) -> dict[str, Any]:
    if catalog != "element-models":
        return data
    element_name = data.get("element_name")
    if element_name:
        element = fetch_one("select id from catalog_elements where upper(name)=upper(%s)", [element_name])
        if not element:
            element = execute(
                "insert into catalog_elements (name, active) values (%s, true) returning id",
                [element_name],
            )
        data["element_id"] = element["id"]
    return data


@router.get("")
def catalog_index(user=Depends(get_current_user)):
    return [
        {
            "code": code,
            "label": cfg["label"],
            "fields": cfg["fields"],
        }
        for code, cfg in CATALOGS.items()
    ]


@router.get("/{catalog}")
def list_catalog(
    catalog: str,
    q: str | None = None,
    active: bool | None = Query(default=None),
    user=Depends(get_current_user),
):
    cfg = _config(catalog)
    table = cfg["table"]
    where: list[str] = []
    params: list[Any] = []

    if active is not None:
        where.append("active = %s")
        params.append(active)

    if q:
        like = f"%{q}%"
        search_parts = [f"{field} ilike %s" for field in cfg["search"]]
        where.append("(" + " or ".join(search_parts) + ")")
        params.extend([like] * len(search_parts))

    sql = f"select * from {table}"
    if where:
        sql += " where " + " and ".join(where)
    sql += f" order by {cfg['order']}"
    return fetch_all(sql, params)


@router.post("/{catalog}")
def create_catalog_item(catalog: str, payload: CatalogPayload, user=Depends(require_roles("admin"))):
    cfg = _config(catalog)
    table = cfg["table"]
    allowed = cfg["fields"]
    data = _clean_data(payload, allowed)

    if catalog in {"units", "test-types", "elements", "sizes", "frequencies", "pressure-rows", "payment-terms"}:
        if not data.get("name"):
            raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    if catalog == "element-models":
        if not data.get("element_name") or not data.get("full_name"):
            raise HTTPException(status_code=400, detail="Elemento y nombre completo son obligatorios")
    if catalog == "pricing":
        if not data.get("element_name"):
            raise HTTPException(status_code=400, detail="El elemento es obligatorio")

    data = _sync_element_id_if_needed(catalog, data)
    cols = list(data.keys())
    placeholders = ",".join(["%s"] * len(cols))
    row = execute(
        f"insert into {table} ({','.join(cols)}) values ({placeholders}) returning *",
        [data[c] for c in cols],
    )
    return row


@router.patch("/{catalog}/{item_id}")
def update_catalog_item(catalog: str, item_id: str, payload: CatalogUpdatePayload, user=Depends(require_roles("admin"))):
    cfg = _config(catalog)
    table = cfg["table"]
    allowed = cfg["fields"]
    data = _clean_data(payload, allowed, partial=True)

    if not data:
        row = fetch_one(f"select * from {table} where id=%s", [item_id])
        if not row:
            raise HTTPException(status_code=404, detail="Registro no encontrado")
        return row

    data = _sync_element_id_if_needed(catalog, data)
    sets = ", ".join([f"{col}=%s" for col in data.keys()])
    row = execute(
        f"update {table} set {sets} where id=%s returning *",
        list(data.values()) + [item_id],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return row


@router.delete("/{catalog}/{item_id}")
def delete_catalog_item(
    catalog: str,
    item_id: str,
    hard: bool = False,
    user=Depends(require_roles("admin")),
):
    cfg = _config(catalog)
    table = cfg["table"]
    if hard:
        row = execute(f"delete from {table} where id=%s returning *", [item_id])
    else:
        row = execute(f"update {table} set active=false where id=%s returning *", [item_id])
    if not row:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"ok": True, "item": row}
