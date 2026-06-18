from __future__ import annotations

from pathlib import Path
from typing import Any
from io import BytesIO

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, Table, TableStyle

from ..config import settings
from ..db import execute
from .certificate_service import certificate_detail

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
CERT_DIR = STATIC_DIR / "certificates"
BRANDING_DIR = STATIC_DIR / "branding"
CERT_DIR.mkdir(parents=True, exist_ok=True)
BRANDING_DIR.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
MARGIN_X = 14 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

# Paleta sobria y formal
NAVY = colors.HexColor("#0b1220")
NAVY_2 = colors.HexColor("#111827")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#d6dee8")
LINE_DARK = colors.HexColor("#94a3b8")
LIGHT = colors.HexColor("#f1f5f9")
LIGHTER = colors.HexColor("#f8fafc")
WHITE = colors.white
RED = colors.HexColor("#dc2626")
GREEN = colors.HexColor("#166534")
GREEN_BG = colors.HexColor("#dcfce7")
RED_BG = colors.HexColor("#fee2e2")
AMBER = colors.HexColor("#92400e")
AMBER_BG = colors.HexColor("#fef3c7")

styles = getSampleStyleSheet()

P = ParagraphStyle("P", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9.0, textColor=NAVY)
PB = ParagraphStyle("PB", parent=P, fontName="Helvetica-Bold")
PS = ParagraphStyle("PS", parent=P, fontSize=6.4, leading=7.8, textColor=SLATE)
PSB = ParagraphStyle("PSB", parent=PS, fontName="Helvetica-Bold", textColor=SLATE)
PTITLE = ParagraphStyle("PTITLE", parent=P, fontName="Helvetica-Bold", fontSize=15.5, leading=18, textColor=NAVY)
PSUB = ParagraphStyle("PSUB", parent=P, fontSize=7.8, leading=9.5, textColor=MUTED)
PCENTER = ParagraphStyle("PCENTER", parent=P, alignment=TA_CENTER)


def _safe_filename(value: str) -> str:
    cleaned = (value or "certificado").strip().replace(" ", "_")
    for ch in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        cleaned = cleaned.replace(ch, "-")
    return cleaned


def _v(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def _display(value: Any, default: str = "—") -> str:
    text = _v(value).strip()
    return text if text else default


def _date(value: Any) -> str:
    if value is None:
        return ""
    s = str(value)
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return f"{s[8:10]}/{s[5:7]}/{s[0:4]}"
    return s


def _esc(value: Any) -> str:
    text = _v(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text.replace("\n", "<br/>")


def _p(value: Any, style: ParagraphStyle = P, default: str = "—") -> Paragraph:
    return Paragraph(_esc(_display(value, default)), style)


def _stroke(c: canvas.Canvas, color=LINE, width: float = 0.45):
    c.setStrokeColor(color)
    c.setLineWidth(width)


def _validation_payload(cert: dict) -> str:
    public_url = _v(cert.get("public_validation_url")).strip()
    if public_url:
        return public_url if public_url.startswith("http") else f"{settings.PUBLIC_BASE_URL}{public_url}"
    validation_hash = _v(cert.get("validation_hash")).strip()
    if validation_hash:
        return f"{settings.PUBLIC_BASE_URL}/public/validate/{validation_hash}"
    return _v(cert.get("certificate_number")).strip() or "SIP-CERTIFICADO"


def _qr_image_reader(cert: dict):
    payload = _validation_payload(cert)
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return ImageReader(buffer)


def _draw_logo(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    logo_path = BRANDING_DIR / "sip_logo.png"
    if logo_path.exists():
        try:
            reader = ImageReader(str(logo_path))
            iw, ih = reader.getSize()
            ratio = iw / ih if ih else 1
            target_w = w
            target_h = target_w / ratio
            if target_h > h:
                target_h = h
                target_w = target_h * ratio
            c.drawImage(
                reader,
                x,
                y + (h - target_h) / 2,
                width=target_w,
                height=target_h,
                preserveAspectRatio=True,
                mask="auto",
            )
            return
        except Exception:
            pass

    c.saveState()
    c.setFillColor(RED)
    c.setFont("Helvetica-BoldOblique", 24)
    c.drawString(x, y + h - 13 * mm, "SIP")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-BoldOblique", 8)
    c.drawString(x, y + 5 * mm, "Instrumentación")
    c.restoreState()


def _draw_header(c: canvas.Canvas, cert: dict, title: str, page_no: int):
    c.saveState()
    x = MARGIN_X
    top_y = PAGE_H - 8 * mm
    header_h = 35 * mm
    y = top_y - header_h

    # Línea institucional superior
    c.setFillColor(RED)
    c.rect(x, top_y - 1.5 * mm, CONTENT_W, 0.8 * mm, stroke=0, fill=1)

    # Logo institucional más arriba y con mayor presencia
    _draw_logo(c, x, y + 12 * mm, 46 * mm, 19.5 * mm)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15.5)
    c.drawString(x + 56 * mm, y + 24 * mm, title)
    c.setFont("Helvetica", 7.3)
    c.setFillColor(MUTED)
    c.drawString(x + 56 * mm, y + 18 * mm, "Documento técnico emitido por SIP Instrumentación")

    box_w = 46 * mm
    box_h = 17 * mm
    bx = x + CONTENT_W - box_w
    by = y + 13.5 * mm
    c.setFillColor(NAVY)
    c.roundRect(bx, by, box_w, box_h, 3 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 6.6)
    c.drawCentredString(bx + box_w / 2, by + 11.2 * mm, "CERTIFICADO NÚMERO")
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(bx + box_w / 2, by + 5.1 * mm, cert.get("certificate_number") or "")

    # Metadatos compactos
    meta_y = y + 0.8 * mm
    meta_h = 7.2 * mm
    meta = [
        ("Código", cert.get("certificate_code") or "CE-SIP-01"),
        ("Vigencia", _date(cert.get("certificate_validity")) or "01/10/2024"),
        ("Rev.", cert.get("certificate_revision") or "5"),
        ("Página", f"{page_no} de 2"),
    ]
    col_w = CONTENT_W / 4
    for i, (label, value) in enumerate(meta):
        xx = x + i * col_w
        c.setFillColor(LIGHTER if i % 2 == 0 else LIGHT)
        c.rect(xx, meta_y, col_w, meta_h, stroke=0, fill=1)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 5.7)
        c.drawString(xx + 2 * mm, meta_y + 4.5 * mm, label)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 6.3)
        c.drawString(xx + 2 * mm, meta_y + 1.5 * mm, _display(value))

    _stroke(c, LINE, 0.6)
    c.line(x, y - 2.5 * mm, x + CONTENT_W, y - 2.5 * mm)
    c.restoreState()
    return y - 8 * mm


def _draw_footer(c: canvas.Canvas):
    c.saveState()
    _stroke(c, LINE, 0.45)
    c.line(MARGIN_X, 13 * mm, PAGE_W - MARGIN_X, 13 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.8)
    footer = f"{settings.COMPANY_ADDRESS} · Cel: {settings.COMPANY_PHONE} · {settings.COMPANY_EMAIL}"
    c.drawCentredString(PAGE_W / 2, 8.5 * mm, footer)
    c.restoreState()


def _section_title(c: canvas.Canvas, text: str, y: float) -> float:
    c.saveState()
    x = MARGIN_X
    h = 6.8 * mm
    c.setFillColor(LIGHT)
    c.roundRect(x, y - h, CONTENT_W, h, 1.8 * mm, stroke=0, fill=1)
    c.setFillColor(RED)
    c.roundRect(x, y - h, 1.4 * mm, h, 0.7 * mm, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 7.6)
    c.drawString(x + 3.5 * mm, y - 4.6 * mm, text.upper())
    c.restoreState()
    return y - 8.8 * mm


def _table(c: canvas.Canvas, rows: list[list[Any]], x: float, top_y: float, col_widths: list[float], header: bool = False) -> float:
    table = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
    ]
    if not header:
        for col in range(0, len(col_widths), 2):
            style.append(("BACKGROUND", (col, 0), (col, -1), LIGHTER))
            style.append(("FONTNAME", (col, 0), (col, -1), "Helvetica-Bold"))
            style.append(("TEXTCOLOR", (col, 0), (col, -1), SLATE))
    else:
        style.extend([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            ("TOPPADDING", (0, 0), (-1, 0), 4),
        ])
    table.setStyle(TableStyle(style))
    _, th = table.wrapOn(c, CONTENT_W, PAGE_H)
    table.drawOn(c, x, top_y - th)
    return th


def _draw_text_box(c: canvas.Canvas, title: str, text: Any, y: float, h: float = 17 * mm, empty_text: str = "—") -> float:
    y = _section_title(c, title, y)
    x = MARGIN_X
    _stroke(c, LINE, 0.35)
    c.setFillColor(WHITE)
    c.roundRect(x, y - h, CONTENT_W, h, 1.8 * mm, stroke=1, fill=1)
    p = _p(text, P, empty_text)
    p.wrapOn(c, CONTENT_W - 6 * mm, h - 5 * mm)
    p.drawOn(c, x + 3 * mm, y - h + 3 * mm)
    return y - h - 5.5 * mm


def _badge(c: canvas.Canvas, x: float, y: float, text: str, tone: str = "green"):
    if tone == "red":
        bg, fg = RED_BG, colors.HexColor("#991b1b")
    elif tone == "amber":
        bg, fg = AMBER_BG, AMBER
    else:
        bg, fg = GREEN_BG, GREEN
    c.setFillColor(bg)
    c.roundRect(x, y, 32 * mm, 7 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 6.2)
    c.drawCentredString(x + 16 * mm, y + 2.2 * mm, text)


def _draw_signature_area(c: canvas.Canvas, cert: dict, y: float):
    x = MARGIN_X
    gap = 10 * mm
    box_w = (CONTENT_W - gap) / 2
    box_h = 29 * mm
    titles = ["Responsable del ensayo", "Firma y sello del responsable"]
    for i, title in enumerate(titles):
        xx = x + i * (box_w + gap)
        c.setFillColor(WHITE)
        _stroke(c, LINE, 0.45)
        c.roundRect(xx, y, box_w, box_h, 2 * mm, stroke=1, fill=1)
        c.setFillColor(LIGHTER)
        c.roundRect(xx, y + box_h - 7 * mm, box_w, 7 * mm, 2 * mm, stroke=0, fill=1)
        c.setFillColor(SLATE)
        c.setFont("Helvetica-Bold", 6.7)
        c.drawCentredString(xx + box_w / 2, y + box_h - 4.8 * mm, title.upper())
        c.setStrokeColor(LINE)
        c.setLineWidth(0.45)
        c.line(xx + 14 * mm, y + 12 * mm, xx + box_w - 14 * mm, y + 12 * mm)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 5.8)
        c.drawCentredString(xx + box_w / 2, y + 4.5 * mm, f"Certificado N° {cert.get('certificate_number') or ''}")


def _draw_qr_card(c: canvas.Canvas, cert: dict, x: float, y: float, w: float, h: float):
    c.saveState()
    c.setFillColor(WHITE)
    _stroke(c, LINE, 0.45)
    c.roundRect(x, y, w, h, 2 * mm, stroke=1, fill=1)
    c.setFillColor(LIGHTER)
    c.roundRect(x, y + h - 8 * mm, w, 8 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(SLATE)
    c.setFont("Helvetica-Bold", 6.7)
    c.drawString(x + 3 * mm, y + h - 5.2 * mm, "VALIDACIÓN DE AUTENTICIDAD")
    qr_size = min(h - 13 * mm, 27 * mm)
    try:
        c.drawImage(
            _qr_image_reader(cert),
            x + 3 * mm,
            y + 3.5 * mm,
            width=qr_size,
            height=qr_size,
            preserveAspectRatio=True,
            mask="auto",
        )
    except Exception:
        c.setFillColor(RED)
        c.setFont("Helvetica", 6)
        c.drawString(x + 4 * mm, y + 13 * mm, "QR no disponible")

    tx = x + 3 * mm + qr_size + 4 * mm
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.7)
    c.drawString(tx, y + h - 16 * mm, "Documento")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 6.4)
    c.drawString(tx, y + h - 20 * mm, _display(cert.get("certificate_number")))
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.6)
    c.drawString(tx, y + h - 27 * mm, "Escanear para verificar autenticidad")
    c.restoreState()


def _has_pattern_data(p: dict) -> bool:
    keys = ["pattern_name", "pattern_serial_number", "pattern_certificate_number", "pattern_range_value", "pattern_calibration_date", "pattern_recalibration_date"]
    return any(_v(p.get(k)).strip() for k in keys)


def _draw_page_1(c: canvas.Canvas, cert: dict, patterns: list[dict]):
    y = _draw_header(c, cert, "Certificado de calibración", 1)

    y = _section_title(c, "Datos del cliente y documento", y)
    rows = [
        [_p("Cliente", PB), _p(cert.get("client_name") or cert.get("client_name_snapshot")), _p("CUIT", PB), _p(cert.get("client_cuit") or cert.get("client_cuit_snapshot"))],
        [_p("Orden de compra", PB), _p(cert.get("purchase_order")), _p("Estado administrativo", PB), _p("Pagado" if cert.get("is_paid") else "Pendiente")],
    ]
    y -= _table(c, rows, MARGIN_X, y, [34 * mm, 67 * mm, 34 * mm, CONTENT_W - 135 * mm]) + 6.5 * mm

    y = _section_title(c, "Datos del equipo certificado", y)
    range_full = f"{_v(cert.get('range_value')).strip()} {_v(cert.get('unit')).strip()}".strip()
    rows = [
        [_p("Elemento", PB), _p(cert.get("element")), _p("Tipo / Modelo", PB), _p(cert.get("type_model"))],
        [_p("Marca", PB), _p(cert.get("brand")), _p("Serie", PB), _p(cert.get("serial_number"))],
        [_p("Rango", PB), _p(range_full), _p("Size", PB), _p(cert.get("size_value"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [30 * mm, 70 * mm, 30 * mm, CONTENT_W - 130 * mm]) + 6.5 * mm

    y = _section_title(c, "Fechas y frecuencia", y)
    rows = [[
        _p("Calibración", PB), _p(_date(cert.get("calibration_date"))),
        _p("Vencimiento", PB), _p(_date(cert.get("expiration_date"))),
        _p("Frecuencia", PB), _p(f"{cert.get('test_frequency_months') or ''} meses".strip()),
    ]]
    y -= _table(c, rows, MARGIN_X, y, [27 * mm, 36 * mm, 27 * mm, 36 * mm, 27 * mm, CONTENT_W - 153 * mm]) + 6.5 * mm

    y = _draw_text_box(c, "Método de referencia y protocolo aplicado", cert.get("reference_method"), y, 19 * mm, "Sin método declarado.")

    y = _section_title(c, "Condiciones del ensayo", y)
    rows = [
        [_p("Tipo de prueba", PB), _p(cert.get("test_type")), _p("Unidad de medida", PB), _p(cert.get("measurement_unit"))],
        [_p("Condiciones ambientales", PB), _p(cert.get("environmental_conditions")), _p("Observaciones", PB), _p(cert.get("observations"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [39 * mm, 62 * mm, 34 * mm, CONTENT_W - 135 * mm]) + 6.5 * mm

    y = _draw_text_box(c, "Conclusiones", cert.get("conclusions"), y, 15 * mm, "Sin conclusiones declaradas.")

    real_patterns = [p for p in patterns if _has_pattern_data(p)]
    if real_patterns and y > 64 * mm:
        y = _section_title(c, "Equipos patrón aplicados", y)
        table_rows = [[_p("Patrón", PSB), _p("Certificado", PSB), _p("Rango", PSB), _p("Calibración", PSB), _p("Recalibración", PSB)]]
        for p in real_patterns[:4]:
            pattern_name = " ".join(filter(None, [_v(p.get("pattern_name")), _v(p.get("pattern_serial_number"))])).strip()
            table_rows.append([
                _p(pattern_name, PS),
                _p(p.get("pattern_certificate_number"), PS),
                _p(f"{_v(p.get('pattern_range_value')).strip()} {_v(p.get('pattern_unit')).strip()}".strip(), PS),
                _p(_date(p.get("pattern_calibration_date")), PS),
                _p(_date(p.get("pattern_recalibration_date")), PS),
            ])
        th = _table(c, table_rows, MARGIN_X, y, [43 * mm, 42 * mm, 32 * mm, 35 * mm, CONTENT_W - 152 * mm], header=True)
        y -= th + 6 * mm

    _draw_signature_area(c, cert, 24 * mm)
    _draw_footer(c)


def _draw_page_2(c: canvas.Canvas, cert: dict, tests: list[dict]):
    y = _draw_header(c, cert, "Registro de ensayo", 2)

    y = _section_title(c, "Resumen del ensayo", y)
    rows = [
        [_p("Elemento", PB), _p(cert.get("element")), _p("Serie", PB), _p(cert.get("serial_number"))],
        [_p("Resultado del ensayo", PB), _p(cert.get("trial_result")), _p("Aprobado", PB), _p("SI" if cert.get("approved_result") else "NO")],
        [_p("Frecuencia", PB), _p(f"{cert.get('test_frequency_months') or ''} meses".strip()), _p("Vencimiento", PB), _p(_date(cert.get("expiration_date")))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [39 * mm, 67 * mm, 34 * mm, CONTENT_W - 140 * mm]) + 6.5 * mm

    if cert.get("approved_result"):
        _badge(c, MARGIN_X, y - 7.5 * mm, "APROBADO", "green")
    else:
        _badge(c, MARGIN_X, y - 7.5 * mm, "NO APROBADO", "red")
    y -= 13 * mm

    y = _section_title(c, "Resultados de presión / control", y)
    table_rows = [[
        _p("Presión", PSB),
        _p("Rango / Unidad", PSB),
        _p("Criterio de aceptación", PSB),
        _p("Resultado", PSB),
        _p("Observaciones", PSB),
    ]]
    for t in tests[:12]:
        table_rows.append([
            _p(t.get("pressure_label"), PS),
            _p(f"{t.get('range_value') if t.get('range_value') is not None else ''} {_v(t.get('unit')).strip()}".strip(), PS),
            _p(t.get("acceptance_criteria"), PS),
            _p(t.get("result"), PS),
            _p(t.get("observations"), PS),
        ])
    while len(table_rows) < 7:
        idx = len(table_rows)
        table_rows.append([_p(f"PRESIÓN DE PRUEBA N°{idx}", PS), _p("", PS), _p("", PS), _p("", PS), _p("", PS)])

    th = _table(c, table_rows, MARGIN_X, y, [45 * mm, 33 * mm, 42 * mm, 30 * mm, CONTENT_W - 150 * mm], header=True)
    y -= th + 7 * mm

    y = _draw_text_box(c, "Comentarios finales", cert.get("final_comments"), y, 14 * mm, "Sin comentarios finales.")

    y = _section_title(c, "Emisión y control", y)
    notes = "Documento emitido para impresión, revisión y firma por el responsable autorizado. La información técnica corresponde a los datos cargados y aprobados en el sistema de gestión."
    left_w = CONTENT_W - 58 * mm
    box_h = 28 * mm
    c.setFillColor(LIGHTER)
    c.roundRect(MARGIN_X, y - box_h, left_w - 5 * mm, box_h, 2 * mm, stroke=0, fill=1)
    p = _p(notes, PS, "")
    p.wrapOn(c, left_w - 11 * mm, box_h - 7 * mm)
    p.drawOn(c, MARGIN_X + 3 * mm, y - 13 * mm)
    _draw_qr_card(c, cert, MARGIN_X + left_w, y - box_h, 58 * mm, box_h)

    _draw_signature_area(c, cert, 24 * mm)
    _draw_footer(c)


def generate_certificate_pdf(cert_id: str, user) -> str:
    detail = certificate_detail(cert_id, user)
    cert = detail["certificate"]
    tests = detail.get("test_rows", [])
    patterns = detail.get("patterns", [])

    filename = f"{_safe_filename(cert['certificate_number'])}.pdf"
    filepath = CERT_DIR / filename
    public_url = f"{settings.PUBLIC_BASE_URL}/static/certificates/{filename}"

    c = canvas.Canvas(str(filepath), pagesize=A4)
    c.setTitle(f"Certificado {cert.get('certificate_number')}")
    c.setAuthor(settings.COMPANY_NAME)
    c.setSubject("Certificado de calibración")

    _draw_page_1(c, cert, patterns)
    c.showPage()
    _draw_page_2(c, cert, tests)
    c.save()

    execute("update certificates set pdf_url=%s where id=%s returning id", [public_url, cert_id])
    execute(
        """
        insert into certificate_files (certificate_id, file_type, file_name, file_url, storage_path, uploaded_by)
        values (%s,'pdf',%s,%s,%s,%s)
        """,
        [cert_id, filename, public_url, str(filepath), user["id"]],
    )
    execute(
        "select add_certificate_audit(%s,%s,'pdf_generated',%s,null,null)",
        [cert_id, user["id"], "PDF moderno formal generado con logo más arriba, QR de validación de autenticidad y layout compacto."],
    )
    return public_url
