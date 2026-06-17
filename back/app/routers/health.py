from fastapi import APIRouter
from ..db import fetch_one

router = APIRouter(tags=["Health"])


@router.get("/")
def root():
    return {"ok": True, "service": "SIP Certificados API", "docs": "/docs", "health": "/health", "health_db": "/health/db"}


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/health/db")
def health_db():
    row = fetch_one("select now() as now")
    return {"ok": True, "db_time": row["now"]}
