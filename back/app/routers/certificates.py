from fastapi import APIRouter, Depends, File, UploadFile
from ..auth import get_current_user, require_roles
from ..models import CertificateCreate, CertificateUpdate, RejectRequest, AnnulRequest, CommentCreate
from ..db import execute
from ..services.certificate_service import (
    list_certificates,
    certificate_detail,
    create_certificate,
    update_certificate,
    delete_certificate,
    submit_certificate,
    approve_certificate,
    reject_certificate,
    annul_certificate,
    get_next_certificate_number,
    list_certificate_templates,
    get_hydraulic_test_chart,
    upload_hydraulic_test_chart,
    delete_hydraulic_test_chart,
)
from ..services.qr_service import generate_qr
from ..services.pdf_service import generate_certificate_pdf

router = APIRouter(prefix="/certificates", tags=["Certificates"])


@router.get("")
def list_all(status: str | None = None, client_id: str | None = None, q: str | None = None, user=Depends(get_current_user)):
    return list_certificates(user=user, status=status, client_id=client_id, q=q)


@router.post("")
def create(payload: CertificateCreate, user=Depends(require_roles("admin", "certificador"))):
    return create_certificate(payload, user)


@router.get("/next-number")
def next_number(prefix: str = "SIP", year: int | None = None, user=Depends(require_roles("admin", "certificador"))):
    return get_next_certificate_number(prefix=prefix, year=year)


@router.get("/templates")
def templates(user=Depends(get_current_user)):
    return list_certificate_templates(user)


@router.get("/{cert_id}")
def get(cert_id: str, user=Depends(get_current_user)):
    return certificate_detail(cert_id, user)


@router.patch("/{cert_id}")
def update(cert_id: str, payload: CertificateUpdate, user=Depends(require_roles("admin", "certificador"))):
    return update_certificate(cert_id, payload, user)


@router.delete("/{cert_id}")
def delete(cert_id: str, hard: bool = True, user=Depends(require_roles("admin"))):
    return delete_certificate(cert_id, user=user, hard=hard)


@router.post("/{cert_id}/submit")
def submit(cert_id: str, user=Depends(require_roles("admin", "certificador"))):
    return submit_certificate(cert_id, user)


@router.post("/{cert_id}/approve")
def approve(cert_id: str, user=Depends(require_roles("admin", "aprobador"))):
    return approve_certificate(cert_id, user)


@router.post("/{cert_id}/reject")
def reject(cert_id: str, payload: RejectRequest, user=Depends(require_roles("admin", "aprobador"))):
    return reject_certificate(cert_id, payload.reason, user)


@router.post("/{cert_id}/annul")
def annul(cert_id: str, payload: AnnulRequest, user=Depends(require_roles("admin", "aprobador"))):
    return annul_certificate(cert_id, payload.reason, user)


@router.post("/{cert_id}/generate-qr")
def qr(cert_id: str, user=Depends(require_roles("admin", "aprobador"))):
    url = generate_qr(cert_id, user)
    execute("select add_certificate_audit(%s,%s,'updated',%s,null,null)", [cert_id, user["id"], "QR generado."])
    return {"qr_url": url}


@router.post("/{cert_id}/generate-pdf")
def pdf(cert_id: str, user=Depends(require_roles("admin", "aprobador"))):
    # Genera QR primero para que el PDF lo pueda incluir.
    generate_qr(cert_id, user)
    url = generate_certificate_pdf(cert_id, user)
    return {"pdf_url": url}


@router.get("/{cert_id}/hydraulic-test-chart")
def get_chart(cert_id: str, user=Depends(get_current_user)):
    return get_hydraulic_test_chart(cert_id, user)


@router.post("/{cert_id}/hydraulic-test-chart")
def upload_chart(
    cert_id: str,
    file: UploadFile = File(...),
    user=Depends(require_roles("admin", "aprobador")),
):
    return upload_hydraulic_test_chart(cert_id, file, user)


@router.delete("/{cert_id}/hydraulic-test-chart")
def delete_chart(cert_id: str, user=Depends(require_roles("admin", "aprobador"))):
    return delete_hydraulic_test_chart(cert_id, user)


@router.post("/{cert_id}/comments")
def add_comment(cert_id: str, payload: CommentCreate, user=Depends(get_current_user)):
    row = execute(
        "insert into certificate_comments (certificate_id,user_id,comment,is_internal) values (%s,%s,%s,%s) returning *",
        [cert_id, user["id"], payload.comment, payload.is_internal],
    )
    execute("select add_certificate_audit(%s,%s,'commented',%s,null,null)", [cert_id, user["id"], payload.comment])
    return row
