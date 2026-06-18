from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

from ..auth import get_current_user, require_roles
from ..models import CertificateCreate, CertificateUpdate, RejectRequest, AnnulRequest
from ..services import certificate_service
from ..services.qr_service import generate_qr
from ..services.pdf_service import generate_certificate_pdf

router = APIRouter(prefix="/certificates", tags=["Certificates"])


class NextNumberResponse(BaseModel):
    certificate_number: str
    prefix: str
    year_suffix: str
    next_sequence: int


@router.get("/templates")
def list_templates(user=Depends(get_current_user)):
    return certificate_service.list_certificate_templates(user)


@router.get("/next-number")
def next_certificate_number(
    prefix: str = Query(default="SIP"),
    year: int | None = Query(default=None),
    user=Depends(get_current_user),
):
    return certificate_service.get_next_certificate_number(prefix=prefix, year=year)


@router.get("")
def list_certificates(
    status: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    user=Depends(get_current_user),
):
    return certificate_service.list_certificates(user, status=status, client_id=client_id, q=q)


@router.post("")
def create_certificate(payload: CertificateCreate, user=Depends(require_roles("admin", "certificador", "aprobador"))):
    return certificate_service.create_certificate(payload, user)


@router.get("/{cert_id}")
def get_certificate(cert_id: str, user=Depends(get_current_user)):
    return certificate_service.certificate_detail(cert_id, user)


@router.patch("/{cert_id}")
def update_certificate(
    cert_id: str,
    payload: CertificateUpdate,
    user=Depends(require_roles("admin", "certificador", "aprobador")),
):
    return certificate_service.update_certificate(cert_id, payload, user)


@router.delete("/{cert_id}")
def delete_certificate(
    cert_id: str,
    hard: bool = Query(default=True),
    user=Depends(require_roles("admin")),
):
    return certificate_service.delete_certificate(cert_id, user, hard=hard)


@router.post("/{cert_id}/submit")
def submit_certificate(cert_id: str, user=Depends(require_roles("admin", "certificador", "aprobador"))):
    return certificate_service.submit_certificate(cert_id, user)


@router.post("/{cert_id}/approve")
def approve_certificate(cert_id: str, user=Depends(require_roles("admin", "aprobador"))):
    return certificate_service.approve_certificate(cert_id, user)


@router.post("/{cert_id}/reject")
def reject_certificate(cert_id: str, payload: RejectRequest, user=Depends(require_roles("admin", "aprobador"))):
    return certificate_service.reject_certificate(cert_id, payload.reason, user)


@router.post("/{cert_id}/annul")
def annul_certificate(cert_id: str, payload: AnnulRequest, user=Depends(require_roles("admin", "aprobador"))):
    return certificate_service.annul_certificate(cert_id, payload.reason, user)


@router.post("/{cert_id}/generate-qr")
def generate_certificate_qr(cert_id: str, user=Depends(require_roles("admin", "aprobador", "certificador"))):
    try:
        qr_url = generate_qr(cert_id, user)
        return {"qr_url": qr_url}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo generar el QR: {exc}") from exc


@router.post("/{cert_id}/generate-pdf")
def generate_pdf(cert_id: str, user=Depends(require_roles("admin", "aprobador", "certificador"))):
    try:
        pdf_url = generate_certificate_pdf(cert_id, user)
        return {"pdf_url": pdf_url}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo generar el PDF: {exc}") from exc


@router.get("/{cert_id}/hydraulic-test-chart")
def get_hydraulic_test_chart(cert_id: str, user=Depends(get_current_user)):
    return certificate_service.get_hydraulic_test_chart(cert_id, user)


@router.post("/{cert_id}/hydraulic-test-chart")
def upload_hydraulic_test_chart(
    cert_id: str,
    file: UploadFile = File(...),
    user=Depends(require_roles("admin", "aprobador")),
):
    return certificate_service.upload_hydraulic_test_chart(cert_id, file, user)


@router.delete("/{cert_id}/hydraulic-test-chart")
def delete_hydraulic_test_chart(cert_id: str, user=Depends(require_roles("admin", "aprobador"))):
    return certificate_service.delete_hydraulic_test_chart(cert_id, user)
