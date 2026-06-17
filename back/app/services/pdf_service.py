from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase.pdfmetrics import stringWidth

from ..config import settings
from ..db import execute
from .certificate_service import certificate_detail

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
CERT_DIR = STATIC_DIR / "certificates"
QR_DIR = STATIC_DIR / "qr"
BRANDING_DIR = STATIC_DIR / "branding"
CERT_DIR.mkdir(parents=True, exist_ok=True)
QR_DIR.mkdir(parents=True, exist_ok=True)
BRANDING_DIR.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = A4
MARGIN_X = 10 * mm
TOP_Y = PAGE_H - 10 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

LINE = colors.HexColor("#111827")
GRID = colors.HexColor("#1f2937")
LIGHT = colors.HexColor("#e5e7eb")
LIGHTER = colors.HexColor("#f8fafc")
DARK = colors.HexColor("#111827")
MUTED = colors.HexColor("#475569")
BLUE = colors.HexColor("#1d4ed8")
RED_STAMP = colors.HexColor("#b91c1c")
VIOLET_STAMP = colors.HexColor("#4f46e5")
GREEN = colors.HexColor("#166534")

styles = getSampleStyleSheet()
P_SMALL = ParagraphStyle(
    "P_SMALL",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=6.4,
    leading=7.8,
    textColor=DARK,
)
P_SMALL_BOLD = ParagraphStyle(
    "P_SMALL_BOLD",
    parent=P_SMALL,
    fontName="Helvetica-Bold",
)
P_CENTER = ParagraphStyle(
    "P_CENTER",
    parent=P_SMALL,
    alignment=TA_CENTER,
)
P_RIGHT = ParagraphStyle(
    "P_RIGHT",
    parent=P_SMALL,
    alignment=TA_RIGHT,
)
P_TITLE = ParagraphStyle(
    "P_TITLE",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=10.5,
    leading=12,
    alignment=TA_CENTER,
    textColor=DARK,
)
P_CELL = ParagraphStyle(
    "P_CELL",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=6.8,
    leading=8.4,
    textColor=DARK,
)
P_CELL_BOLD = ParagraphStyle(
    "P_CELL_BOLD",
    parent=P_CELL,
    fontName="Helvetica-Bold",
)
P_SECTION = ParagraphStyle(
    "P_SECTION",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=7.2,
    leading=8.8,
    alignment=TA_CENTER,
    textColor=DARK,
)


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
    # YYYY-MM-DD -> DD-MM-YYYY
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return f"{s[8:10]}-{s[5:7]}-{s[0:4]}"
    return s


def _money_or_empty(value: Any) -> str:
    return "" if value is None else str(value)


def _p(text: Any, style: ParagraphStyle = P_CELL) -> Paragraph:
    # ReportLab Paragraph interpreta algunos caracteres como XML.
    value = _v(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    value = value.replace("\n", "<br/>")
    return Paragraph(value, style)


def _set_line(c: canvas.Canvas, width: float = 0.55, color=GRID):
    c.setStrokeColor(color)
    c.setLineWidth(width)


def _draw_company_mark(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    """Dibuja marca SIP si no existe logo real.

    Si subís un archivo app/static/branding/sip_logo.png, se usa automáticamente.
    """
    logo_path = BRANDING_DIR / "sip_logo.png"
    if logo_path.exists():
        try:
            c.drawImage(str(logo_path), x + 3 * mm, y + 2 * mm, width=w - 6 * mm, height=h - 4 * mm, preserveAspectRatio=True, mask="auto")
            return
        except Exception:
            pass

    c.saveState()
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(1.0)
    c.ellipse(x + 4 * mm, y + 3 * mm, x + 30 * mm, y + h - 3 * mm)
    c.setFillColor(colors.HexColor("#dc2626"))
    c.setFont("Helvetica-BoldOblique", 26)
    c.drawString(x + 22 * mm, y + h - 15 * mm, "SIP")
    c.setFillColor(DARK)
    c.setFont("Helvetica-BoldOblique", 7.5)
    c.drawString(x + 18 * mm, y + 8 * mm, "Servicios Industriales Petroleros")
    c.setFont("Helvetica", 4.4)
    c.drawString(x + 18 * mm, y + 4.5 * mm, "CALIBRACIONES · ENSAYOS · CERTIFICACIONES")
    c.restoreState()


def _draw_header(c: canvas.Canvas, cert: dict, page_title: str, page_no: int):
    header_h = 30 * mm
    y = PAGE_H - 10 * mm - header_h
    x = MARGIN_X

    _set_line(c, 0.65)
    c.rect(x, y, CONTENT_W, header_h)

    logo_w = 58 * mm
    title_w = 74 * mm
    meta_w = CONTENT_W - logo_w - title_w

    c.line(x + logo_w, y, x + logo_w, y + header_h)
    c.line(x + logo_w + title_w, y, x + logo_w + title_w, y + header_h)

    _draw_company_mark(c, x, y, logo_w, header_h)

    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(DARK)
    c.drawCentredString(x + logo_w + title_w / 2, y + 17 * mm, page_title)

    c.setFont("Helvetica", 5.8)
    c.setFillColor(MUTED)
    c.drawCentredString(x + logo_w + title_w / 2, y + 10 * mm, "Documento generado por sistema autorizado")

    mx = x + logo_w + title_w
    row_h = 5.2 * mm
    labels = [
        ("Código:", cert.get("certificate_code") or "CE-SIP-01"),
        ("Vigencia:", _date(cert.get("certificate_validity")) or "01/10/2024"),
        ("Rev:", cert.get("certificate_revision") or "5"),
    ]
    for idx, (lab, val) in enumerate(labels):
        yy = y + header_h - (idx + 1) * row_h
        c.line(mx, yy, mx + meta_w, yy)
        c.setFont("Helvetica", 5.5)
        c.drawCentredString(mx + 18 * mm, yy + 1.7 * mm, lab)
        c.setFont("Helvetica-Bold", 5.7)
        c.drawCentredString(mx + meta_w - 18 * mm, yy + 1.7 * mm, _v(val))

    cert_box_h = header_h - 3 * row_h
    c.setFillColor(LIGHT)
    c.rect(mx, y, meta_w, cert_box_h, stroke=1, fill=1)
    c.setFillColor(DARK)
    c.setFont("Helvetica-BoldOblique", 5.7)
    c.drawCentredString(mx + meta_w / 2, y + cert_box_h - 4 * mm, "CERTIFICADO NÚMERO")
    c.setFont("Helvetica-Bold", 12.5)
    c.drawCentredString(mx + meta_w / 2, y + 4.2 * mm, cert.get("certificate_number") or "")

    c.setFont("Helvetica", 5.4)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - MARGIN_X, y - 2.5 * mm, f"Página {page_no} de 2")
    return y


def _draw_footer(c: canvas.Canvas, cert: dict):
    c.saveState()
    c.setFont("Helvetica", 5.2)
    c.setFillColor(DARK)
    footer = f"{settings.COMPANY_ADDRESS} Cel: {settings.COMPANY_PHONE} {settings.COMPANY_EMAIL}"
    c.drawCentredString(PAGE_W / 2, 7.5 * mm, footer)
    c.restoreState()


def _draw_signature_boxes(c: canvas.Canvas, cert: dict, y: float):
    box_w = 76 * mm
    box_h = 24 * mm
    gap = 15 * mm
    left_x = MARGIN_X + 13 * mm
    right_x = left_x + box_w + gap

    c.setFont("Helvetica-Bold", 7.2)
    c.setFillColor(DARK)
    c.drawCentredString(PAGE_W / 2, y + box_h + 8 * mm, "RESPONSABLE DEL ENSAYO")

    for x, title, color, text2 in [
        (left_x, settings.COMPANY_NAME.upper(), VIOLET_STAMP, "CERTIFICADO N°"),
        (right_x, "SELLO", RED_STAMP, "CERTIFICADO N°"),
    ]:
        _set_line(c, 0.65)
        c.rect(x, y, box_w, box_h)
        c.setFillColor(LIGHT)
        c.rect(x, y + box_h - 6 * mm, box_w, 6 * mm, stroke=1, fill=1)
        c.setFillColor(DARK)
        c.setFont("Helvetica-Bold", 5.5)
        c.drawCentredString(x + box_w / 2, y + box_h - 4 * mm, title)
        _draw_stamp(c, x + box_w / 2, y + 9.5 * mm, color, cert.get("certificate_number") or "", text2)


def _draw_stamp(c: canvas.Canvas, cx: float, cy: float, color, cert_number: str, title: str):
    c.saveState()
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(0.75)
    c.setFillAlpha(0.42)
    c.setStrokeAlpha(0.42)
    c.ellipse(cx - 21 * mm, cy - 10 * mm, cx + 21 * mm, cy + 10 * mm)
    c.ellipse(cx - 17 * mm, cy - 7 * mm, cx + 17 * mm, cy + 7 * mm)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(cx, cy + 1.8 * mm, "SIP")
    c.setFont("Helvetica-Bold", 6.2)
    c.drawCentredString(cx, cy - 3.5 * mm, title)
    c.setFont("Helvetica-Bold", 5.6)
    c.drawCentredString(cx, cy - 7 * mm, cert_number)
    c.restoreState()


def _section_bar(c: canvas.Canvas, x: float, y: float, w: float, text: str, h: float = 6 * mm):
    _set_line(c, 0.55)
    c.setFillColor(LIGHT)
    c.rect(x, y, w, h, stroke=1, fill=1)
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 6.4)
    c.drawCentredString(x + w / 2, y + 2 * mm, text)


def _draw_table(c: canvas.Canvas, data: list[list[Any]], x: float, top_y: float, col_widths: list[float], style_extra: list[tuple] | None = None):
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.45, GRID),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 5.8),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]
    if style_extra:
        style.extend(style_extra)
    table.setStyle(TableStyle(style))
    tw, th = table.wrapOn(c, PAGE_W, PAGE_H)
    table.drawOn(c, x, top_y - th)
    return th


def _draw_client_equipment_block(c: canvas.Canvas, cert: dict, y_top: float) -> float:
    x = MARGIN_X
    row_h = 7.1 * mm

    data = [
        [_p("CLIENTE", P_CELL_BOLD), _p(cert.get("client_name") or cert.get("client_name_snapshot"), P_CELL_BOLD), _p("EQUIPO", P_CELL_BOLD), _p("", P_CELL_BOLD)],
        [_p("CUIT", P_CELL_BOLD), _p(cert.get("client_cuit") or cert.get("client_cuit_snapshot"), P_CELL_BOLD), _p("ORDEN DE\nCOMPRA", P_CELL_BOLD), _p(cert.get("purchase_order"), P_CELL_BOLD)],
    ]
    th = _draw_table(
        c,
        data,
        x,
        y_top,
        [27 * mm, 103 * mm, 24 * mm, CONTENT_W - 154 * mm],
        [
            ("BACKGROUND", (0, 0), (0, -1), LIGHT),
            ("BACKGROUND", (2, 0), (2, -1), LIGHT),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ],
    )
    y_top -= th + 7 * mm

    data2 = [
        [_p("FECHA CALIBRACIÓN", P_CELL_BOLD), _p(_date(cert.get("calibration_date")), P_CELL_BOLD), _p("VENCIMIENTO CALIBRACIÓN", P_CELL_BOLD), _p(_date(cert.get("expiration_date")), P_CELL_BOLD)],
        [_p("ELEMENTO", P_CELL_BOLD), _p(cert.get("element"), P_CELL_BOLD), _p("SERIE:", P_CELL_BOLD), _p(cert.get("serial_number"), P_CELL_BOLD)],
        [_p("TIPO / MODELO", P_CELL_BOLD), _p(cert.get("type_model"), P_CELL_BOLD), _p("RANGO:", P_CELL_BOLD), _p(f"{cert.get('range_value') or ''} {cert.get('unit') or ''}".strip(), P_CELL_BOLD), _p("SIZE:", P_CELL_BOLD), _p(cert.get("size_value"), P_CELL_BOLD), _p("MARCA:", P_CELL_BOLD), _p(cert.get("brand"), P_CELL_BOLD)],
    ]
    th = _draw_table(
        c,
        data2,
        x,
        y_top,
        [28 * mm, 73 * mm, 34 * mm, CONTENT_W - 135 * mm],
        [
            ("SPAN", (2, 0), (2, 0)),
            ("BACKGROUND", (0, 0), (0, -1), LIGHT),
            ("BACKGROUND", (2, 0), (2, -1), LIGHT),
            ("BACKGROUND", (1, 0), (1, 0), colors.black),
            ("TEXTCOLOR", (1, 0), (1, 0), colors.white),
            ("BACKGROUND", (3, 0), (3, 0), colors.black),
            ("TEXTCOLOR", (3, 0), (3, 0), colors.white),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("SPAN", (3, 1), (3, 1)),
            ("SPAN", (1, 2), (1, 2)),
        ],
    )
    # La fila con tipo/modelo/rango/size/marca necesita más columnas; se dibuja encima con tabla específica.
    # Para conservar proporción sin complicar spans, hacemos una tabla adicional fina.
    y_after = y_top - th
    # Cubrimos la última fila con tabla más detallada.
    last_top = y_top - 2 * 7.1 * mm
    data3 = [[
        _p("TIPO / MODELO", P_CELL_BOLD),
        _p(cert.get("type_model"), P_CELL_BOLD),
        _p("RANGO:", P_CELL_BOLD),
        _p(f"{cert.get('range_value') or ''} {cert.get('unit') or ''}".strip(), P_CELL_BOLD),
        _p("SIZE:", P_CELL_BOLD),
        _p(cert.get("size_value"), P_CELL_BOLD),
        _p("MARCA:", P_CELL_BOLD),
        _p(cert.get("brand"), P_CELL_BOLD),
    ]]
    _draw_table(c, data3, x, last_top, [28 * mm, 38 * mm, 16 * mm, 25 * mm, 13 * mm, 25 * mm, 17 * mm, CONTENT_W - 162 * mm], [
        ("BACKGROUND", (0, 0), (0, 0), LIGHT),
        ("BACKGROUND", (2, 0), (2, 0), LIGHT),
        ("BACKGROUND", (4, 0), (4, 0), LIGHT),
        ("BACKGROUND", (6, 0), (6, 0), LIGHT),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ])
    return y_after - 8 * mm


def _draw_results_block(c: canvas.Canvas, cert: dict, y_top: float) -> float:
    x = MARGIN_X
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(DARK)
    c.drawCentredString(PAGE_W / 2, y_top, "RESULTADOS DE LAS PRUEBAS REALIZADAS")
    y_top -= 8 * mm

    data = [
        [_p("TIPO DE PRUEBA", P_CELL_BOLD), _p(cert.get("test_type"), P_CELL)],
        [_p("MÉTODO DE REFERENCIA Y PROTOCOLO APLICADO", P_CELL_BOLD), _p(cert.get("reference_method"), P_CELL)],
        [_p("CONDICIONES AMBIENTALES", P_CELL_BOLD), _p(cert.get("environmental_conditions"), P_CELL)],
        [_p("UNIDAD DE MEDIDA UTILIZADA", P_CELL_BOLD), _p(cert.get("measurement_unit"), P_CELL)],
        [_p("OBSERVACIONES", P_CELL_BOLD), _p(cert.get("observations"), P_CELL)],
    ]
    th = _draw_table(c, data, x, y_top, [56 * mm, CONTENT_W - 56 * mm], [
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])
    y_top -= th + 7 * mm

    data2 = [[_p("CONCLUSIONES:", P_CELL_BOLD), _p(cert.get("conclusions"), P_CELL)]]
    th = _draw_table(c, data2, x, y_top, [30 * mm, CONTENT_W - 30 * mm], [
        ("BACKGROUND", (0, 0), (0, 0), LIGHT),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
    ])
    return y_top - th - 8 * mm


def _draw_patterns_block(c: canvas.Canvas, patterns: list[dict], y_top: float) -> float:
    x = MARGIN_X
    _section_bar(c, x, y_top, CONTENT_W, "DATOS EQUIPOS PATRÓN APLICADO")
    y_top -= 6 * mm
    data = [[
        _p("PATRÓN", P_CELL_BOLD),
        _p("CERTIFICADO", P_CELL_BOLD),
        _p("RANGO", P_CELL_BOLD),
        _p("FECHA DE CALIBRACIÓN", P_CELL_BOLD),
        _p("FECHA DE RECALIBRACIÓN", P_CELL_BOLD),
    ]]
    if patterns:
        for p in patterns:
            pattern_name = " ".join(filter(None, [_v(p.get("pattern_name")), _v(p.get("pattern_serial_number"))])).strip()
            data.append([
                _p(pattern_name, P_CELL),
                _p(p.get("pattern_certificate_number"), P_CELL),
                _p(f"{p.get('pattern_range_value') or ''} {p.get('pattern_unit') or ''}".strip(), P_CELL),
                _p(_date(p.get("pattern_calibration_date")), P_CELL),
                _p(_date(p.get("pattern_recalibration_date")), P_CELL),
            ])
            if p.get("pattern_certificate_url"):
                data.append([_p("CERTIFICADO PATRÓN", P_CELL_BOLD), _p(p.get("pattern_certificate_url"), P_CELL), "", "", ""])
    else:
        data.append([_p("", P_CELL), _p("", P_CELL), _p("", P_CELL), _p("", P_CELL), _p("", P_CELL)])

    th = _draw_table(c, data, x, y_top, [42 * mm, 45 * mm, 35 * mm, 35 * mm, CONTENT_W - 157 * mm], [
        ("SPAN", (1, -1), (-1, -1)) if len(data) > 1 and patterns and patterns[-1].get("pattern_certificate_url") else ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
    ])
    return y_top - th - 8 * mm


def _draw_observation_box(c: canvas.Canvas, y_top: float, text: str = "") -> float:
    x = MARGIN_X
    h = 18 * mm
    _set_line(c, 0.55)
    c.setFillColor(LIGHT)
    c.rect(x, y_top - 5 * mm, CONTENT_W, 5 * mm, stroke=1, fill=1)
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 5.6)
    c.drawString(x + 2 * mm, y_top - 3.4 * mm, "OBSERVACIÓN")
    c.rect(x, y_top - h, CONTENT_W, h - 5 * mm, stroke=1, fill=0)
    if text:
        p = _p(text, P_CELL)
        p.wrapOn(c, CONTENT_W - 4 * mm, h - 7 * mm)
        p.drawOn(c, x + 2 * mm, y_top - h + 2 * mm)
    return y_top - h - 4 * mm


def _draw_trial_header(c: canvas.Canvas, cert: dict, y_top: float) -> float:
    x = MARGIN_X
    _section_bar(c, x, y_top, CONTENT_W, "REGISTRO DE ENSAYO")
    y_top -= 8 * mm
    data = [
        [_p("ELEMENTO", P_CELL_BOLD), _p(cert.get("element"), P_CELL_BOLD), _p("SERIE:", P_CELL_BOLD), _p(cert.get("serial_number"), P_CELL_BOLD)],
        [_p("RESULTADO DEL ENSAYO", P_CELL_BOLD), _p(cert.get("trial_result"), P_CELL_BOLD), _p("APROBADO", P_CELL_BOLD), _p("SI" if cert.get("approved_result") else "NO", P_CELL_BOLD)],
        [_p("FRECUENCIA DEL ENSAYO", P_CELL_BOLD), _p(f"{cert.get('test_frequency_months') or ''} MESES", P_CELL_BOLD), _p("VENCIMIENTO", P_CELL_BOLD), _p(_date(cert.get("expiration_date")), P_CELL_BOLD)],
    ]
    th = _draw_table(c, data, x, y_top, [39 * mm, 90 * mm, 32 * mm, CONTENT_W - 161 * mm], [
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("BACKGROUND", (2, 0), (2, -1), LIGHT),
        ("BACKGROUND", (3, 2), (3, 2), colors.black),
        ("TEXTCOLOR", (3, 2), (3, 2), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ])
    return y_top - th - 8 * mm


def _draw_tests_table(c: canvas.Canvas, tests: list[dict], y_top: float) -> float:
    x = MARGIN_X
    data = [[_p("PRESIÓN", P_CELL_BOLD), _p("RANGO / UNIDAD", P_CELL_BOLD), _p("CRITERIO DE\nACEPTACIÓN", P_CELL_BOLD), _p("RESULTADO", P_CELL_BOLD), _p("OBSERVACIONES", P_CELL_BOLD)]]
    if tests:
        for t in tests[:8]:
            data.append([
                _p(t.get("pressure_label"), P_CELL_BOLD),
                _p(f"{_money_or_empty(t.get('range_value'))} {t.get('unit') or ''}".strip(), P_CELL),
                _p(t.get("acceptance_criteria"), P_CELL),
                _p(t.get("result"), P_CELL),
                _p(t.get("observations"), P_CELL),
            ])
    while len(data) < 7:
        n = len(data)
        data.append([_p(f"PRESIÓN DE PRUEBA N°{n}", P_CELL_BOLD), _p("", P_CELL), _p("", P_CELL), _p("", P_CELL), _p("", P_CELL)])

    th = _draw_table(c, data, x, y_top, [48 * mm, 35 * mm, 35 * mm, 32 * mm, CONTENT_W - 150 * mm], [
        ("BACKGROUND", (0, 1), (0, -1), LIGHT),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ])
    return y_top - th - 8 * mm


def _draw_comments(c: canvas.Canvas, cert: dict, y_top: float) -> float:
    x = MARGIN_X
    _section_bar(c, x, y_top, CONTENT_W, "COMENTARIOS FINALES")
    h = 17 * mm
    _set_line(c, 0.45)
    c.rect(x, y_top - 6 * mm - h, CONTENT_W, h, stroke=1, fill=0)
    p = _p(cert.get("final_comments"), P_CELL)
    p.wrapOn(c, CONTENT_W - 4 * mm, h - 4 * mm)
    p.drawOn(c, x + 2 * mm, y_top - 6 * mm - h + 2 * mm)
    return y_top - 6 * mm - h - 8 * mm


def _draw_pressure_chart(c: canvas.Canvas, tests: list[dict], x: float, y: float, w: float, h: float):
    _section_bar(c, x, y + h - 5 * mm, w, "GRÁFICO DE PRUEBA PRESIÓN VS TIEMPO", 5 * mm)
    chart_x = x + 9 * mm
    chart_y = y + 8 * mm
    chart_w = w - 18 * mm
    chart_h = h - 20 * mm
    _set_line(c, 0.35, colors.HexColor("#94a3b8"))
    c.rect(chart_x, chart_y, chart_w, chart_h)

    values = []
    for t in tests:
        try:
            if t.get("range_value") is not None:
                values.append(float(t.get("range_value")))
        except Exception:
            pass
    if not values:
        values = [0, 46, 93, 185]
    max_v = max(values + [1])
    scale_max = max_v * 1.15

    # grilla y etiquetas
    c.setFont("Helvetica", 4.8)
    c.setFillColor(MUTED)
    for i in range(5):
        yy = chart_y + chart_h * i / 4
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.line(chart_x, yy, chart_x + chart_w, yy)
        val = int(scale_max * i / 4)
        c.drawRightString(chart_x - 1.5 * mm, yy - 1.2 * mm, str(val))

    points = [(0, 0)]
    for idx, val in enumerate(values):
        points.append((idx + 1, val))
    n = max(1, len(points) - 1)
    px_points = []
    for idx, val in points:
        px = chart_x + (chart_w * idx / max(1, n))
        py = chart_y + chart_h * (val / scale_max)
        px_points.append((px, py))

    c.setStrokeColor(BLUE)
    c.setFillColor(colors.HexColor("#dbeafe"))
    path = c.beginPath()
    path.moveTo(px_points[0][0], chart_y)
    for px, py in px_points:
        path.lineTo(px, py)
    path.lineTo(px_points[-1][0], chart_y)
    path.close()
    c.drawPath(path, stroke=0, fill=1)

    c.setLineWidth(1.2)
    for a, b in zip(px_points, px_points[1:]):
        c.line(a[0], a[1], b[0], b[1])
    c.setFillColor(BLUE)
    for px, py in px_points:
        c.circle(px, py, 1.1 * mm, stroke=0, fill=1)


def _draw_validation_box(c: canvas.Canvas, cert: dict, x: float, y: float, w: float, h: float):
    _section_bar(c, x, y + h - 5 * mm, w, "VALIDA QUE EL CERTIFICADO NO ESTÉ CORROMPIDO", 5 * mm)
    _set_line(c, 0.45)
    c.rect(x, y, w, h, stroke=1, fill=0)
    text = (
        "El estado de este certificado es válido solo si la verificación es exitosa en la plataforma indicada. "
        "Cualquier modificación o alteración de este documento fuera del sistema autorizado será invalidada."
    )
    p = _p(text, ParagraphStyle("validation", parent=P_CELL, fontSize=5.4, leading=6.2))
    p.wrapOn(c, w - 36 * mm, h - 10 * mm)
    p.drawOn(c, x + 3 * mm, y + 8 * mm)

    qr_url = cert.get("qr_url")
    if qr_url:
        try:
            qr_filename = str(qr_url).split("/")[-1]
            qr_path = QR_DIR / qr_filename
            if qr_path.exists():
                c.drawImage(str(qr_path), x + w - 31 * mm, y + 7 * mm, width=25 * mm, height=25 * mm, preserveAspectRatio=True, mask="auto")
        except Exception:
            pass
    else:
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(MUTED)
        c.drawCentredString(x + w - 18 * mm, y + 19 * mm, "QR")

    link = cert.get("public_validation_url") or ""
    c.setFillColor(BLUE)
    c.setFont("Helvetica", 4.7)
    c.drawCentredString(x + w / 2, y + 2.5 * mm, link)


def generate_certificate_pdf(cert_id: str, user) -> str:
    detail = certificate_detail(cert_id, user)
    cert = detail["certificate"]
    tests = detail["test_rows"]
    patterns = detail["patterns"]

    filename = f"{_safe_filename(cert['certificate_number'])}.pdf"
    filepath = CERT_DIR / filename
    public_url = f"{settings.PUBLIC_BASE_URL}/static/certificates/{filename}"

    c = canvas.Canvas(str(filepath), pagesize=A4)
    c.setTitle(f"Certificado {cert.get('certificate_number')}")
    c.setAuthor(settings.COMPANY_NAME)
    c.setSubject("Certificado de calibración")

    # Página 1
    header_y = _draw_header(c, cert, "CERTIFICADO DE CALIBRACIÓN", 1)
    y = header_y - 10 * mm
    y = _draw_client_equipment_block(c, cert, y)
    y = _draw_results_block(c, cert, y)
    y = _draw_patterns_block(c, patterns, y)
    _draw_signature_boxes(c, cert, 27 * mm)
    _draw_observation_box(c, 24 * mm, "")
    _draw_footer(c, cert)
    c.showPage()

    # Página 2
    header_y = _draw_header(c, cert, "CERTIFICADO DE CALIBRACIÓN", 2)
    y = header_y - 10 * mm
    y = _draw_trial_header(c, cert, y)
    y = _draw_tests_table(c, tests, y)
    y = _draw_comments(c, cert, y)

    # Chart + QR validation block
    lower_y = y - 45 * mm
    _draw_pressure_chart(c, tests, MARGIN_X + 13 * mm, lower_y, 76 * mm, 45 * mm)
    _draw_validation_box(c, cert, MARGIN_X + 110 * mm, lower_y + 7 * mm, 76 * mm, 34 * mm)

    _draw_signature_boxes(c, cert, 27 * mm)
    _draw_footer(c, cert)
    c.save()

    execute("update certificates set pdf_url=%s where id=%s returning id", [public_url, cert_id])
    execute(
        """
        insert into certificate_files (certificate_id, file_type, file_name, file_url, storage_path, uploaded_by)
        values (%s,'pdf',%s,%s,%s,%s)
        """,
        [cert_id, filename, public_url, str(filepath), user["id"]],
    )
    execute("select add_certificate_audit(%s,%s,'pdf_generated',%s,null,null)", [cert_id, user["id"], "PDF profesional generado."])
    return public_url
