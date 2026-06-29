from pathlib import Path
import secrets

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..auth import require_roles, get_current_user
from ..config import settings
from ..models import PatternCreate, PatternUpdate
from ..db import fetch_one, fetch_all, execute, get_conn

router = APIRouter(prefix="/patterns", tags=["Patterns"])

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
PATTERN_CERT_DIR = STATIC_DIR / "pattern-certificates"
PATTERN_CERT_DIR.mkdir(parents=True, exist_ok=True)


def _public_url(filename: str) -> str:
    base = str(settings.PUBLIC_BASE_URL or "").rstrip("/")
    return f"{base}/static/pattern-certificates/{filename}"


def _hidden_pdf_name(pattern_id: str) -> str:
    token = secrets.token_urlsafe(12).replace("-", "_")
    return f"pat_{pattern_id[:8]}_{token}.pdf"


def _require_pdf(file: UploadFile):
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    if not filename.endswith(".pdf") and content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="El certificado del patrón debe ser un archivo PDF.")


def _get_pattern_or_404(pattern_id: str):
    pattern = fetch_one("select * from measurement_patterns where id=%s", [pattern_id])
    if not pattern:
        raise HTTPException(status_code=404, detail="Patrón no encontrado")
    return pattern


def _sync_pattern_snapshots(pattern_id: str):
    """Actualiza los snapshots de certificate_pattern_usage.

    Así, cuando se sube/reemplaza el certificado PDF del patrón, cualquier PDF
    de certificado generado después toma la URL y datos nuevos automáticamente.
    """
    execute(
        """
        update certificate_pattern_usage cpu
        set
          pattern_name = mp.name,
          pattern_serial_number = mp.serial_number,
          pattern_certificate_number = mp.certificate_number,
          pattern_range_value = mp.range_value,
          pattern_unit = mp.unit,
          pattern_calibration_date = mp.calibration_date,
          pattern_recalibration_date = mp.recalibration_date,
          pattern_certificate_url = mp.certificate_url
        from measurement_patterns mp
        where cpu.pattern_id = mp.id
          and mp.id = %s
        """,
        [pattern_id],
    )


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
    row = execute(f"update measurement_patterns set {sets}, updated_at=now() where id=%s returning *", list(data.values()) + [pattern_id])
    if not row:
        raise HTTPException(status_code=404, detail="Patrón no encontrado")
    _sync_pattern_snapshots(pattern_id)
    return row


async def _upload_pattern_certificate_impl(pattern_id: str, file: UploadFile, user):
    pattern = _get_pattern_or_404(pattern_id)
    _require_pdf(file)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    # Eliminar archivo anterior si estaba dentro del servidor.
    old_path = pattern.get("certificate_storage_path")
    if old_path:
        try:
            old_file = Path(old_path)
            if old_file.exists() and old_file.is_file():
                old_file.unlink()
        except Exception:
            pass

    filename = _hidden_pdf_name(pattern_id)
    storage_path = PATTERN_CERT_DIR / filename
    storage_path.write_bytes(content)
    url = _public_url(filename)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                update measurement_patterns
                set certificate_url=%s,
                    certificate_file_name=%s,
                    certificate_storage_path=%s,
                    certificate_uploaded_at=now(),
                    updated_at=now()
                where id=%s
                returning *
                """,
                [url, file.filename or filename, str(storage_path), pattern_id],
            )
            row = cur.fetchone()
            cur.execute(
                """
                update certificate_pattern_usage cpu
                set
                  pattern_name = mp.name,
                  pattern_serial_number = mp.serial_number,
                  pattern_certificate_number = mp.certificate_number,
                  pattern_range_value = mp.range_value,
                  pattern_unit = mp.unit,
                  pattern_calibration_date = mp.calibration_date,
                  pattern_recalibration_date = mp.recalibration_date,
                  pattern_certificate_url = mp.certificate_url
                from measurement_patterns mp
                where cpu.pattern_id = mp.id
                  and mp.id = %s
                """,
                [pattern_id],
            )

    return row


@router.post("/{pattern_id}/certificate")
async def upload_pattern_certificate(
    pattern_id: str,
    file: UploadFile = File(...),
    user=Depends(require_roles("admin", "certificador")),
):
    return await _upload_pattern_certificate_impl(pattern_id, file, user)


# Alias por compatibilidad con frontends anteriores/nuevos.
@router.post("/{pattern_id}/certificate-file")
async def upload_pattern_certificate_file(
    pattern_id: str,
    file: UploadFile = File(...),
    user=Depends(require_roles("admin", "certificador")),
):
    return await _upload_pattern_certificate_impl(pattern_id, file, user)


@router.get("/{pattern_id}/certificate")
def get_pattern_certificate(pattern_id: str, user=Depends(get_current_user)):
    row = fetch_one(
        "select id, certificate_url, certificate_file_name, certificate_storage_path, certificate_uploaded_at from measurement_patterns where id=%s",
        [pattern_id],
    )
    if not row:
        raise HTTPException(status_code=404, detail="Patrón no encontrado")
    if not row.get("certificate_url"):
        raise HTTPException(status_code=404, detail="El patrón no tiene certificado PDF cargado")
    return row


@router.get("/{pattern_id}/certificate-file")
def get_pattern_certificate_file(pattern_id: str, user=Depends(get_current_user)):
    return get_pattern_certificate(pattern_id, user)


def _delete_pattern_certificate_impl(pattern_id: str):
    row = _get_pattern_or_404(pattern_id)
    storage_path = row.get("certificate_storage_path")
    if storage_path:
        try:
            p = Path(storage_path)
            if p.exists() and p.is_file():
                p.unlink()
        except Exception:
            pass

    updated = execute(
        """
        update measurement_patterns
        set certificate_url=null,
            certificate_file_name=null,
            certificate_storage_path=null,
            certificate_uploaded_at=null,
            updated_at=now()
        where id=%s
        returning *
        """,
        [pattern_id],
    )
    _sync_pattern_snapshots(pattern_id)
    return updated


@router.delete("/{pattern_id}/certificate")
def delete_pattern_certificate(pattern_id: str, user=Depends(require_roles("admin", "certificador"))):
    return _delete_pattern_certificate_impl(pattern_id)


@router.delete("/{pattern_id}/certificate-file")
def delete_pattern_certificate_file(pattern_id: str, user=Depends(require_roles("admin", "certificador"))):
    return _delete_pattern_certificate_impl(pattern_id)
