from typing import Dict, Any, List, Tuple


def build_update_sql(table: str, data: Dict[str, Any], where_sql: str, where_params: List[Any]) -> Tuple[str, List[Any]]:
    clean = {k: v for k, v in data.items() if v is not None}
    if not clean:
        raise ValueError("No hay datos para actualizar")
    sets = []
    params: List[Any] = []
    for i, (key, value) in enumerate(clean.items(), start=1):
        sets.append(f"{key} = %s")
        params.append(value)
    sql = f"update {table} set {', '.join(sets)} where {where_sql} returning *"
    return sql, params + where_params
