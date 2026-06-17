from pathlib import Path
import qrcode
from ..config import settings
from ..db import execute
from .certificate_service import get_certificate_or_404

BASE_DIR = Path(__file__).resolve().parent.parent
QR_DIR = BASE_DIR / "static" / "qr"
QR_DIR.mkdir(parents=True, exist_ok=True)


def generate_qr(cert_id: str, user) -> str:
    cert = get_certificate_or_404(cert_id)
    validation_hash = cert.get("validation_hash")
    if not validation_hash:
        raise ValueError("El certificado no tiene hash de validación")
    url = f"{settings.PUBLIC_BASE_URL}/public/validate/{validation_hash}"
    filename = f"{validation_hash}.png"
    filepath = QR_DIR / filename
    img = qrcode.make(url)
    img.save(filepath)
    public_url = f"{settings.PUBLIC_BASE_URL}/static/qr/{filename}"
    execute("update certificates set qr_url=%s, public_validation_url=%s where id=%s returning id", [public_url, url, cert_id])
    execute(
        """
        insert into certificate_files (certificate_id, file_type, file_name, file_url, storage_path, uploaded_by)
        values (%s,'qr',%s,%s,%s,%s)
        """,
        [cert_id, filename, public_url, str(filepath), user["id"]],
    )
    return public_url
