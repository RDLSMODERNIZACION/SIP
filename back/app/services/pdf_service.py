from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from ..config import settings
from ..db import execute
from .certificate_service import certificate_detail

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
CERT_DIR = STATIC_DIR / "certificates"
QR_DIR = STATIC_DIR / "qr"
CERT_DIR.mkdir(parents=True, exist_ok=True)
QR_DIR.mkdir(parents=True, exist_ok=True)


def _safe_filename(value: str) -> str:
    return value.replace(" ", "_").replace("/", "-").replace("\\", "-")


def generate_certificate_pdf(cert_id: str, user) -> str:
    detail = certificate_detail(cert_id, user)
    cert = detail["certificate"]
    tests = detail["test_rows"]
    patterns = detail["patterns"]

    filename = f"{_safe_filename(cert['certificate_number'])}.pdf"
    filepath = CERT_DIR / filename
    public_url = f"{settings.PUBLIC_BASE_URL}/static/certificates/{filename}"

    c = canvas.Canvas(str(filepath), pagesize=A4)
    width, height = A4

    def header(page_title="CERTIFICADO DE CALIBRACIÓN"):
        c.setStrokeColor(colors.black)
        c.rect(12*mm, height-35*mm, width-24*mm, 23*mm)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(18*mm, height-22*mm, page_title)
        c.setFont("Helvetica", 8)
        c.drawRightString(width-18*mm, height-18*mm, f"Código: {cert.get('certificate_code') or ''}")
        c.drawRightString(width-18*mm, height-23*mm, f"Vigencia: {cert.get('certificate_validity') or ''}")
        c.drawRightString(width-18*mm, height-28*mm, f"Rev: {cert.get('certificate_revision') or ''}")
        c.setFont("Helvetica-Bold", 12)
        c.drawString(18*mm, height-43*mm, f"CERTIFICADO NÚMERO: {cert.get('certificate_number')}")

    def label_value(x, y, label, value, label_w=42*mm):
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x, y, label)
        c.setFont("Helvetica", 8)
        c.drawString(x+label_w, y, str(value or ""))

    def footer():
        c.setFont("Helvetica", 8)
        c.drawCentredString(width/2, 14*mm, f"{settings.COMPANY_ADDRESS} Cel: {settings.COMPANY_PHONE} {settings.COMPANY_EMAIL}")
        c.setFont("Helvetica-Bold", 9)
        c.drawString(18*mm, 25*mm, "RESPONSABLE DEL ENSAYO")
        c.drawRightString(width-18*mm, 25*mm, "SELLO")
        c.drawString(18*mm, 20*mm, settings.COMPANY_NAME)

    # Página 1
    header()
    y = height-55*mm
    label_value(18*mm, y, "CLIENTE", cert.get("client_name")); y -= 7*mm
    label_value(18*mm, y, "CUIT", cert.get("client_cuit")); label_value(110*mm, y, "ORDEN DE COMPRA", cert.get("purchase_order"), 35*mm); y -= 7*mm
    label_value(18*mm, y, "FECHA CALIBRACIÓN", cert.get("calibration_date")); label_value(110*mm, y, "VENCIMIENTO", cert.get("expiration_date"), 35*mm); y -= 9*mm
    label_value(18*mm, y, "ELEMENTO", cert.get("element")); label_value(125*mm, y, "SERIE", cert.get("serial_number"), 18*mm); y -= 7*mm
    label_value(18*mm, y, "TIPO / MODELO", cert.get("type_model")); label_value(85*mm, y, "RANGO", cert.get("range_value"), 18*mm); label_value(125*mm, y, "SIZE", cert.get("size_value"), 18*mm); y -= 7*mm
    label_value(18*mm, y, "MARCA", cert.get("brand")); y -= 12*mm

    c.setFont("Helvetica-Bold", 10)
    c.drawString(18*mm, y, "RESULTADOS DE LAS PRUEBAS REALIZADAS")
    y -= 7*mm
    label_value(18*mm, y, "TIPO DE PRUEBA", cert.get("test_type")); y -= 8*mm

    c.setFont("Helvetica-Bold", 8)
    c.drawString(18*mm, y, "MÉTODO DE REFERENCIA Y PROTOCOLO APLICADO")
    y -= 5*mm
    text = c.beginText(18*mm, y)
    text.setFont("Helvetica", 8)
    for line in str(cert.get("reference_method") or "").split(". "):
        text.textLine(line[:120])
    c.drawText(text)
    y -= 18*mm

    label_value(18*mm, y, "CONDICIONES AMBIENTALES", cert.get("environmental_conditions"), 55*mm); y -= 7*mm
    label_value(18*mm, y, "UNIDAD DE MEDIDA UTILIZADA", cert.get("measurement_unit"), 55*mm); y -= 7*mm
    label_value(18*mm, y, "OBSERVACIONES", cert.get("observations")); y -= 10*mm

    c.setFont("Helvetica-Bold", 8)
    c.drawString(18*mm, y, "CONCLUSIONES:")
    c.setFont("Helvetica", 8)
    c.drawString(45*mm, y, str(cert.get("conclusions") or "")[:130])
    y -= 14*mm

    c.setFont("Helvetica-Bold", 10)
    c.drawString(18*mm, y, "DATOS EQUIPOS PATRÓN APLICADO")
    y -= 6*mm
    pattern_data = [["PATRÓN", "SERIE", "CERTIFICADO", "RANGO", "CALIB.", "RECALIB."]]
    for p in patterns:
        pattern_data.append([
            p.get("pattern_name") or "",
            p.get("pattern_serial_number") or "",
            p.get("pattern_certificate_number") or "",
            f"{p.get('pattern_range_value') or ''} {p.get('pattern_unit') or ''}",
            str(p.get("pattern_calibration_date") or ""),
            str(p.get("pattern_recalibration_date") or ""),
        ])
    table = Table(pattern_data, colWidths=[45*mm, 22*mm, 28*mm, 25*mm, 25*mm, 25*mm])
    table.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.5, colors.black),
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("FONT", (0,0), (-1,0), "Helvetica-Bold", 7),
        ("FONT", (0,1), (-1,-1), "Helvetica", 7),
    ]))
    table.wrapOn(c, width, height)
    table.drawOn(c, 18*mm, y-18*mm)
    footer()
    c.showPage()

    # Página 2
    header("CERTIFICADO DE CALIBRACIÓN - REGISTRO DE ENSAYO")
    y = height-55*mm
    label_value(18*mm, y, "ELEMENTO", cert.get("element")); label_value(125*mm, y, "SERIE", cert.get("serial_number"), 18*mm); y -= 8*mm
    label_value(18*mm, y, "RESULTADO DEL ENSAYO", cert.get("trial_result")); label_value(110*mm, y, "APROBADO", "SI" if cert.get("approved_result") else "NO", 25*mm); y -= 8*mm
    label_value(18*mm, y, "FRECUENCIA DEL ENSAYO", f"{cert.get('test_frequency_months') or ''} MESES"); label_value(110*mm, y, "VENCIMIENTO", cert.get("expiration_date"), 35*mm); y -= 12*mm

    test_data = [["PRESIÓN", "RANGO/UNIDAD", "CRITERIO", "RESULTADO", "OBSERVACIONES"]]
    for t in tests:
        ru = f"{t.get('range_value') or ''} {t.get('unit') or ''}".strip()
        test_data.append([t.get("pressure_label") or "", ru, t.get("acceptance_criteria") or "", t.get("result") or "", t.get("observations") or ""])
    table = Table(test_data, colWidths=[48*mm, 30*mm, 35*mm, 28*mm, 35*mm])
    table.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.5, colors.black),
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("FONT", (0,0), (-1,0), "Helvetica-Bold", 7),
        ("FONT", (0,1), (-1,-1), "Helvetica", 7),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ]))
    table.wrapOn(c, width, height)
    table.drawOn(c, 18*mm, y-45*mm)
    y -= 55*mm

    c.setFont("Helvetica-Bold", 8)
    c.drawString(18*mm, y, "COMENTARIOS FINALES")
    y -= 5*mm
    c.setFont("Helvetica", 8)
    c.drawString(18*mm, y, str(cert.get("final_comments") or "")[:150])
    y -= 18*mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(18*mm, y, "VALIDACIÓN DIGITAL")
    y -= 6*mm
    c.setFont("Helvetica", 8)
    c.drawString(18*mm, y, "El estado de este certificado es válido solo si la verificación es exitosa en la plataforma indicada.")
    y -= 5*mm
    c.drawString(18*mm, y, str(cert.get("public_validation_url") or ""))

    if cert.get("qr_url"):
        try:
            qr_filename = cert["qr_url"].split("/")[-1]
            qr_path = QR_DIR / qr_filename
            if qr_path.exists():
                c.drawImage(str(qr_path), width-50*mm, y-15*mm, width=28*mm, height=28*mm)
        except Exception:
            pass

    footer()
    c.save()

    execute("update certificates set pdf_url=%s where id=%s returning id", [public_url, cert_id])
    execute(
        """
        insert into certificate_files (certificate_id, file_type, file_name, file_url, storage_path, uploaded_by)
        values (%s,'pdf',%s,%s,%s,%s)
        """,
        [cert_id, filename, public_url, str(filepath), user["id"]],
    )
    execute("select add_certificate_audit(%s,%s,'pdf_generated',%s,null,null)", [cert_id, user["id"], "PDF generado."])
    return public_url
