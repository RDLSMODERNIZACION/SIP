from __future__ import annotations

from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
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

NAVY = colors.HexColor("#0f172a")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#cbd5e1")
LIGHT = colors.HexColor("#f1f5f9")
LIGHTER = colors.HexColor("#f8fafc")
WHITE = colors.white
GREEN = colors.HexColor("#166534")
RED = colors.HexColor("#991b1b")
AMBER = colors.HexColor("#92400e")
BLUE = colors.HexColor("#1d4ed8")

styles = getSampleStyleSheet()

P = ParagraphStyle(
    "P",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=7.4,
    leading=9.2,
    textColor=NAVY,
)
PB = ParagraphStyle("PB", parent=P, fontName="Helvetica-Bold")
PS = ParagraphStyle("PS", parent=P, fontSize=6.4, leading=7.8, textColor=SLATE)
PSB = ParagraphStyle("PSB", parent=PS, fontName="Helvetica-Bold")
PTITLE = ParagraphStyle(
    "PTITLE",
    parent=P,
    fontName="Helvetica-Bold",
    fontSize=15,
    leading=18,
    textColor=NAVY,
)
PSUB = ParagraphStyle("PSUB", parent=P, fontSize=8.2, leading=10, textColor=MUTED)
PSECTION = ParagraphStyle(
    "PSECTION",
    parent=P,
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=NAVY,
)
PCENTER = ParagraphStyle("PCENTER", parent=P, alignment=TA_CENTER)
PRIGHT = ParagraphStyle("PRIGHT", parent=P, alignment=TA_RIGHT)


def _safe_filename(value: str) -> str:
    cleaned = (value or "certificado").strip().replace(" ", "_")
    for ch in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        cleaned = cleaned.replace(ch, "-")
    return cleaned


def _v(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


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


def _p(value: Any, style: ParagraphStyle = P) -> Paragraph:
    return Paragraph(_esc(value), style)


def _set_stroke(c: canvas.Canvas, color=LINE, width: float = 0.55):
    c.setStrokeColor(color)
    c.setLineWidth(width)


def _draw_logo(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    logo_path = BRANDING_DIR / "sip_logo.png"
    if logo_path.exists():
        try:
            c.drawImage(str(logo_path), x, y, width=w, height=h, preserveAspectRatio=True, mask="auto")
            return
        except Exception:
            pass

    # Marca fallback si no hay logo cargado.
    c.saveState()
    c.setFillColor(colors.HexColor("#dc2626"))
    c.setFont("Helvetica-BoldOblique", 28)
    c.drawString(x, y + h - 18 * mm, "SIP")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-BoldOblique", 9)
    c.drawString(x, y + 6 * mm, "Instrumentación")
    c.restoreState()


def _draw_header(c: canvas.Canvas, cert: dict, title: str, page_no: int):
    c.saveState()
    header_h = 34 * mm
    x = MARGIN_X
    y = PAGE_H - MARGIN_X - header_h

    c.setFillColor(WHITE)
    c.rect(x, y, CONTENT_W, header_h, stroke=0, fill=1)

    _draw_logo(c, x, y + 4 * mm, 55 * mm, 24 * mm)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(x + 63 * mm, y + 22 * mm, title)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    c.drawString(x + 63 * mm, y + 16 * mm, "Certificado técnico generado por sistema de gestión SIP")

    box_w = 47 * mm
    c.setFillColor(NAVY)
    c.roundRect(x + CONTENT_W - box_w, y + 11 * mm, box_w, 17 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawCentredString(x + CONTENT_W - box_w / 2, y + 23 * mm, "CERTIFICADO NÚMERO")
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(x + CONTENT_W - box_w / 2, y + 16 * mm, cert.get("certificate_number") or "")

    meta_y = y + 2 * mm
    meta_h = 7 * mm
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
        c.setFont("Helvetica", 5.8)
        c.drawString(xx + 2 * mm, meta_y + 4.4 * mm, label)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 6.4)
        c.drawString(xx + 2 * mm, meta_y + 1.6 * mm, _v(value))

    _set_stroke(c, LINE, 0.7)
    c.line(x, y - 1.5 * mm, x + CONTENT_W, y - 1.5 * mm)
    c.restoreState()
    return y - 9 * mm


def _draw_footer(c: canvas.Canvas):
    c.saveState()
    _set_stroke(c, LINE, 0.5)
    c.line(MARGIN_X, 13 * mm, PAGE_W - MARGIN_X, 13 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6)
    footer = f"{settings.COMPANY_ADDRESS} · Cel: {settings.COMPANY_PHONE} · {settings.COMPANY_EMAIL}"
    c.drawCentredString(PAGE_W / 2, 8.5 * mm, footer)
    c.restoreState()


def _section_title(c: canvas.Canvas, text: str, y: float) -> float:
    c.saveState()
    x = MARGIN_X
    c.setFillColor(LIGHT)
    c.roundRect(x, y - 7 * mm, CONTENT_W, 7 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 7.8)
    c.drawString(x + 3 * mm, y - 4.7 * mm, text.upper())
    c.restoreState()
    return y - 9 * mm


def _kv_table(c: canvas.Canvas, rows: list[list[Any]], x: float, top_y: float, col_widths: list[float], header: bool = False) -> float:
    table = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for col in range(0, len(col_widths), 2):
        style.append(("BACKGROUND", (col, 0), (col, -1), LIGHTER))
        style.append(("FONTNAME", (col, 0), (col, -1), "Helvetica-Bold"))
        style.append(("TEXTCOLOR", (col, 0), (col, -1), SLATE))
    if header:
        style.extend([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ])
    table.setStyle(TableStyle(style))
    tw, th = table.wrapOn(c, CONTENT_W, PAGE_H)
    table.drawOn(c, x, top_y - th)
    return th


def _draw_text_box(c: canvas.Canvas, title: str, text: Any, y: float, h: float = 18 * mm) -> float:
    y = _section_title(c, title, y)
    x = MARGIN_X
    _set_stroke(c, LINE, 0.4)
    c.setFillColor(WHITE)
    c.roundRect(x, y - h, CONTENT_W, h, 2 * mm, stroke=1, fill=1)
    p = _p(text, P)
    p.wrapOn(c, CONTENT_W - 6 * mm, h - 5 * mm)
    p.drawOn(c, x + 3 * mm, y - h + 3 * mm)
    return y - h - 6 * mm


def _badge(c: canvas.Canvas, x: float, y: float, text: str, tone: str = "green"):
    if tone == "red":
        bg, fg = colors.HexColor("#fee2e2"), RED
    elif tone == "amber":
        bg, fg = colors.HexColor("#fef3c7"), AMBER
    else:
        bg, fg = colors.HexColor("#dcfce7"), GREEN
    c.setFillColor(bg)
    c.roundRect(x, y, 30 * mm, 7 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 6.4)
    c.drawCentredString(x + 15 * mm, y + 2.2 * mm, text)


def _draw_signature_area(c: canvas.Canvas, cert: dict, y: float):
    x = MARGIN_X
    gap = 10 * mm
    box_w = (CONTENT_W - gap) / 2
    box_h = 32 * mm

    for i, title in enumerate(["Responsable del ensayo", "Firma y sello del responsable"]):
        xx = x + i * (box_w + gap)
        c.setFillColor(WHITE)
        _set_stroke(c, LINE, 0.5)
        c.roundRect(xx, y, box_w, box_h, 2 * mm, stroke=1, fill=1)
        c.setFillColor(LIGHTER)
        c.roundRect(xx, y + box_h - 8 * mm, box_w, 8 * mm, 2 * mm, stroke=0, fill=1)
        c.setFillColor(SLATE)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(xx + box_w / 2, y + box_h - 5.2 * mm, title.upper())
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6)
        c.drawCentredString(xx + box_w / 2, y + 5 * mm, f"Certificado N° {cert.get('certificate_number') or ''}")
        c.setStrokeColor(LINE)
        c.line(xx + 12 * mm, y + 13 * mm, xx + box_w - 12 * mm, y + 13 * mm)


def _draw_page_1(c: canvas.Canvas, cert: dict, patterns: list[dict]):
    y = _draw_header(c, cert, "Certificado de calibración", 1)

    y = _section_title(c, "Datos del cliente y documento", y)
    rows = [
        [_p("Cliente", PB), _p(cert.get("client_name") or cert.get("client_name_snapshot")), _p("CUIT", PB), _p(cert.get("client_cuit") or cert.get("client_cuit_snapshot"))],
        [_p("Orden de compra", PB), _p(cert.get("purchase_order")), _p("Estado administrativo", PB), _p("Pagado" if cert.get("is_paid") else "Pendiente")],
    ]
    y -= _kv_table(c, rows, MARGIN_X, y, [34 * mm, 67 * mm, 34 * mm, CONTENT_W - 135 * mm]) + 7 * mm

    y = _section_title(c, "Datos del equipo certificado", y)
    range_full = f"{cert.get('range_value') or ''} {cert.get('unit') or ''}".strip()
    rows = [
        [_p("Elemento", PB), _p(cert.get("element")), _p("Tipo / Modelo", PB), _p(cert.get("type_model"))],
        [_p("Marca", PB), _p(cert.get("brand")), _p("Serie", PB), _p(cert.get("serial_number"))],
        [_p("Rango", PB), _p(range_full), _p("Size", PB), _p(cert.get("size_value"))],
    ]
    y -= _kv_table(c, rows, MARGIN_X, y, [30 * mm, 70 * mm, 30 * mm, CONTENT_W - 130 * mm]) + 7 * mm

    y = _section_title(c, "Fechas y frecuencia", y)
    rows = [[
        _p("Fecha de calibración", PB), _p(_date(cert.get("calibration_date"))),
        _p("Vencimiento", PB), _p(_date(cert.get("expiration_date"))),
        _p("Frecuencia", PB), _p(f"{cert.get('test_frequency_months') or ''} meses".strip()),
    ]]
    y -= _kv_table(c, rows, MARGIN_X, y, [33 * mm, 31 * mm, 25 * mm, 31 * mm, 25 * mm, CONTENT_W - 145 * mm]) + 7 * mm

    y = _draw_text_box(c, "Método de referencia y protocolo aplicado", cert.get("reference_method"), y, 22 * mm)

    y = _section_title(c, "Condiciones del ensayo", y)
    rows = [
        [_p("Tipo de prueba", PB), _p(cert.get("test_type")), _p("Unidad de medida", PB), _p(cert.get("measurement_unit"))],
        [_p("Condiciones ambientales", PB), _p(cert.get("environmental_conditions")), _p("Observaciones", PB), _p(cert.get("observations"))],
    ]
    y -= _kv_table(c, rows, MARGIN_X, y, [39 * mm, 62 * mm, 34 * mm, CONTENT_W - 135 * mm]) + 7 * mm

    y = _draw_text_box(c, "Conclusiones", cert.get("conclusions"), y, 17 * mm)

    y = _section_title(c, "Equipos patrón aplicados", y)
    table_rows = [[_p("Patrón", PSB), _p("Certificado", PSB), _p("Rango", PSB), _p("Calibración", PSB), _p("Recalibración", PSB)]]
    if patterns:
        for p in patterns:
            pattern_name = " ".join(filter(None, [_v(p.get("pattern_name")), _v(p.get("pattern_serial_number"))])).strip()
            table_rows.append([
                _p(pattern_name, PS),
                _p(p.get("pattern_certificate_number"), PS),
                _p(f"{p.get('pattern_range_value') or ''} {p.get('pattern_unit') or ''}".strip(), PS),
                _p(_date(p.get("pattern_calibration_date")), PS),
                _p(_date(p.get("pattern_recalibration_date")), PS),
            ])
            if p.get("pattern_certificate_url"):
                table_rows.append([_p("Certificado patrón", PSB), _p(p.get("pattern_certificate_url"), PS), "", "", ""])
    else:
        table_rows.append([_p("", PS), _p("", PS), _p("", PS), _p("", PS), _p("", PS)])

    th = _kv_table(c, table_rows, MARGIN_X, y, [43 * mm, 42 * mm, 32 * mm, 35 * mm, CONTENT_W - 152 * mm], header=True)
    y -= th + 8 * mm

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
    y -= _kv_table(c, rows, MARGIN_X, y, [39 * mm, 67 * mm, 34 * mm, CONTENT_W - 140 * mm]) + 7 * mm

    # Estado visible en una línea limpia para imprimir.
    if cert.get("approved_result"):
        _badge(c, MARGIN_X, y - 8 * mm, "APROBADO", "green")
    else:
        _badge(c, MARGIN_X, y - 8 * mm, "NO APROBADO", "red")
    y -= 14 * mm

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
            _p(f"{t.get('range_value') if t.get('range_value') is not None else ''} {t.get('unit') or ''}".strip(), PS),
            _p(t.get("acceptance_criteria"), PS),
            _p(t.get("result"), PS),
            _p(t.get("observations"), PS),
        ])
    while len(table_rows) < 7:
        idx = len(table_rows)
        table_rows.append([_p(f"PRESIÓN DE PRUEBA N°{idx}", PS), _p("", PS), _p("", PS), _p("", PS), _p("", PS)])

    th = _kv_table(c, table_rows, MARGIN_X, y, [45 * mm, 33 * mm, 42 * mm, 30 * mm, CONTENT_W - 150 * mm], header=True)
    y -= th + 8 * mm

    y = _draw_text_box(c, "Comentarios finales", cert.get("final_comments"), y, 20 * mm)

    y = _section_title(c, "Notas para impresión y firma", y)
    notes = (
        "Este documento se emite para su impresión, revisión y firma por el responsable autorizado. "
        "La información técnica declarada corresponde a los datos cargados y aprobados en el sistema de gestión."
    )
    p = _p(notes, PS)
    p.wrapOn(c, CONTENT_W - 6 * mm, 14 * mm)
    c.setFillColor(LIGHTER)
    c.roundRect(MARGIN_X, y - 17 * mm, CONTENT_W, 17 * mm, 2 * mm, stroke=0, fill=1)
    p.drawOn(c, MARGIN_X + 3 * mm, y - 13 * mm)

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
        [cert_id, user["id"], "PDF moderno formal generado sin gráfico ni validación de autenticidad."],
    )
    return public_url
