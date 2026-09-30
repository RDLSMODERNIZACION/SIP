from urllib.parse import quote

from ..config import settings


def public_validation_url(validation_hash: str) -> str:
    return f"{settings.PUBLIC_FRONTEND_URL.rstrip('/')}/validar/{quote(validation_hash, safe='')}"
