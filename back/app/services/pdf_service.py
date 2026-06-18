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
from reportlab.lib.utils import ImageReader
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
BOTTOM_SAFE = 23 * mm

# Paleta sobria / formal
NAVY = colors.HexColor("#0b1220")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#d6dee8")
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
P = ParagraphStyle("P", parent=styles["Normal"], fontName="Helvetica", fontSize=7.1, leading=8.7, textColor=NAVY)
PB = ParagraphStyle("PB", parent=P, fontName="Helvetica-Bold")
PS = ParagraphStyle("PS", parent=P, fontSize=6.25, leading=7.4, textColor=SLATE)
PSB = ParagraphStyle("PSB", parent=PS, fontName="Helvetica-Bold", textColor=SLATE)
PTITLE = ParagraphStyle("PTITLE", parent=P, fontName="Helvetica-Bold", fontSize=14.8, leading=17, textColor=NAVY)
PSUB = ParagraphStyle("PSUB", parent=P, fontSize=7.3, leading=8.7, textColor=MUTED)
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


def _num_unit(value: Any, unit: Any = None) -> str:
    left = _v(value).strip()
    right = _v(unit).strip()
    if left and right:
        return f"{left} {right}"
    return left or right or "—"


def _validation_payload(cert: dict) -> str:
    public_url = _v(cert.get("public_validation_url")).strip()
    if public_url:
        return public_url if public_url.startswith("http") else f"{settings.PUBLIC_BASE_URL}{public_url}"
    validation_hash = _v(cert.get("validation_hash")).strip()
    if validation_hash:
        return f"{settings.PUBLIC_BASE_URL}/public/validate/{validation_hash}"
    return _v(cert.get("certificate_number")).strip() or "SIP-CERTIFICADO"


def _qr_image_reader(cert: dict):
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(_validation_payload(cert))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return ImageReader(buffer)




def _draw_header_text(c: canvas.Canvas, text: str, x: float, y: float, max_w: float, font_size: float = 11.6):
    """Draw a compact one/two-line title and return its height.

    The PDF header has a fixed certificate-number box on the right. Long
    document names like "Certificado de Ensayo de Apertura / Seteo" must wrap
    without colliding with the subtitle or the right-hand box.
    """
    clean = _display(text, "Certificado técnico")
    style = ParagraphStyle(
        "HEADER_TITLE_DYNAMIC",
        parent=PTITLE,
        fontSize=font_size,
        leading=font_size + 1.7,
        textColor=NAVY,
        fontName="Helvetica-Bold",
    )
    paragraph = Paragraph(_esc(clean), style)
    _, h = paragraph.wrap(max_w, 18 * mm)
    paragraph.drawOn(c, x, y - h)
    return h

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


def _template_label(code: str | None) -> str:
    return {
        "pressure_gauge": "Manómetro / indicador de presión",
        "pressure_head_sensor": "Cabeza de presión / sensor electrónico",
        "relief_valve_set": "Válvula de seguridad / Relief / PRV",
        "hydrostatic_line": "Línea / manguera / brida / conexión",
        "general_pressure": "Ensayo general de presión",
    }.get(code or "", code or "Ensayo general")


def _document_title(cert: dict, page_no: int) -> str:
    if page_no == 2:
        return "Registro técnico del ensayo"
    if page_no == 3:
        return "ANEXO A"
    return _display(cert.get("document_type"), "Certificado técnico")


def _draw_header(c: canvas.Canvas, cert: dict, page_no: int, total_pages: int = 2):
    c.saveState()
    x = MARGIN_X
    top_y = PAGE_H - 7 * mm
    header_h = 36 * mm
    y = top_y - header_h

    c.setFillColor(RED)
    c.rect(x, top_y - 1.5 * mm, CONTENT_W, 0.85 * mm, stroke=0, fill=1)

    # Logo más arriba, sin recargar el encabezado
    _draw_logo(c, x, y + 13.4 * mm, 45 * mm, 19 * mm)

    title = _document_title(cert, page_no)
    title_x = x + 55 * mm
    title_top = y + 29.4 * mm
    # Leave a safe gap before the certificate-number box.
    title_max_w = CONTENT_W - 55 * mm - 58 * mm
    title_h = _draw_header_text(c, title, title_x, title_top, title_max_w, 11.6)
    c.setFont("Helvetica", 7.0)
    c.setFillColor(MUTED)
    subtitle = _template_label(cert.get("template_type"))
    subtitle_y = max(y + 16.6 * mm, title_top - title_h - 2.1 * mm)
    c.drawString(title_x, subtitle_y, subtitle)

    box_w = 46 * mm
    box_h = 17 * mm
    bx = x + CONTENT_W - box_w
    by = y + 14 * mm
    c.setFillColor(NAVY)
    c.roundRect(bx, by, box_w, box_h, 3 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawCentredString(bx + box_w / 2, by + 11.4 * mm, "CERTIFICADO NÚMERO")
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(bx + box_w / 2, by + 5.1 * mm, cert.get("certificate_number") or "")

    meta_y = y + 0.8 * mm
    meta_h = 7.2 * mm
    meta = [
        ("Código", cert.get("certificate_code") or "CE-SIP-01"),
        ("Vigencia", _date(cert.get("certificate_validity")) or "01/10/2024"),
        ("Rev.", cert.get("certificate_revision") or "5"),
        ("Página", f"{page_no} de {total_pages}"),
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
        c.setFont("Helvetica-Bold", 6.25)
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
    c.setFont("Helvetica", 5.75)
    footer = f"{settings.COMPANY_ADDRESS} · Cel: {settings.COMPANY_PHONE} · {settings.COMPANY_EMAIL}"
    c.drawCentredString(PAGE_W / 2, 8.5 * mm, footer)
    c.restoreState()


def _section_title(c: canvas.Canvas, text: str, y: float) -> float:
    c.saveState()
    x = MARGIN_X
    h = 6.6 * mm
    c.setFillColor(LIGHT)
    c.roundRect(x, y - h, CONTENT_W, h, 1.8 * mm, stroke=0, fill=1)
    c.setFillColor(RED)
    c.roundRect(x, y - h, 1.4 * mm, h, 0.7 * mm, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 7.4)
    c.drawString(x + 3.5 * mm, y - 4.5 * mm, text.upper())
    c.restoreState()
    return y - 8.6 * mm


def _table(c: canvas.Canvas, rows: list[list[Any]], x: float, top_y: float, col_widths: list[float], header: bool = False) -> float:
    table = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 6.6),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.2),
        ("TOPPADDING", (0, 0), (-1, -1), 3.0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.0),
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


def _draw_text_box(c: canvas.Canvas, title: str, text: Any, y: float, h: float = 16 * mm, empty_text: str = "—") -> float:
    y = _section_title(c, title, y)
    x = MARGIN_X
    _stroke(c, LINE, 0.35)
    c.setFillColor(WHITE)
    c.roundRect(x, y - h, CONTENT_W, h, 1.8 * mm, stroke=1, fill=1)
    p = _p(text, P, empty_text)
    p.wrapOn(c, CONTENT_W - 6 * mm, h - 5 * mm)
    p.drawOn(c, x + 3 * mm, y - h + 3 * mm)
    return y - h - 5 * mm


def _badge(c: canvas.Canvas, x: float, y: float, text: str, tone: str = "green"):
    if tone == "red":
        bg, fg = RED_BG, colors.HexColor("#991b1b")
    elif tone == "amber":
        bg, fg = AMBER_BG, AMBER
    else:
        bg, fg = GREEN_BG, GREEN
    c.setFillColor(bg)
    c.roundRect(x, y, 34 * mm, 7 * mm, 3 * mm, stroke=0, fill=1)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 6.15)
    c.drawCentredString(x + 17 * mm, y + 2.2 * mm, text)


def _draw_signature_area(c: canvas.Canvas, cert: dict, y: float):
    x = MARGIN_X
    gap = 10 * mm
    box_w = (CONTENT_W - gap) / 2
    box_h = 29 * mm
    titles = ["Responsable del ensayo", "Firma y sello del responsable"]
    responsible = _display(cert.get("responsible_name"), "")
    license_text = _display(cert.get("responsible_license"), "")
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
        c.line(xx + 14 * mm, y + 13 * mm, xx + box_w - 14 * mm, y + 13 * mm)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 5.6)
        if responsible and i == 0:
            c.drawCentredString(xx + box_w / 2, y + 8.2 * mm, responsible)
            if license_text:
                c.drawCentredString(xx + box_w / 2, y + 5.4 * mm, license_text)
        c.drawCentredString(xx + box_w / 2, y + 2.9 * mm, f"Certificado N° {cert.get('certificate_number') or ''}")


def _draw_qr_card(c: canvas.Canvas, cert: dict, x: float, y: float, w: float, h: float):
    c.saveState()
    c.setFillColor(WHITE)
    _stroke(c, LINE, 0.45)
    c.roundRect(x, y, w, h, 2 * mm, stroke=1, fill=1)
    c.setFillColor(LIGHTER)
    c.roundRect(x, y + h - 8 * mm, w, 8 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(SLATE)
    c.setFont("Helvetica-Bold", 6.4)
    c.drawString(x + 3 * mm, y + h - 5.2 * mm, "VALIDACIÓN DE AUTENTICIDAD")

    # QR más grande y alineado dentro de la tarjeta. En versiones previas quedaba
    # demasiado chico porque el alto de la tarjeta era bajo.
    qr_size = min(27 * mm, h - 12 * mm, w * 0.42)
    qr_x = x + 4 * mm
    qr_y = y + 4 * mm
    try:
        c.drawImage(_qr_image_reader(cert), qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True, mask="auto")
    except Exception:
        c.setFillColor(RED)
        c.setFont("Helvetica", 6)
        c.drawString(qr_x, y + 13 * mm, "QR no disponible")

    tx = qr_x + qr_size + 5 * mm
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.6)
    c.drawString(tx, y + h - 14 * mm, "Documento")
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 6.4)
    c.drawString(tx, y + h - 18.2 * mm, _display(cert.get("certificate_number")))
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5.4)
    c.drawString(tx, y + 8.4 * mm, "Escanear para verificar")
    c.drawString(tx, y + 5.2 * mm, "autenticidad")
    c.restoreState()




def _annex_label(chart_url: str | None, required: bool = True) -> str:
    if chart_url:
        return "Anexo A - Gráfico/carta de prueba hidráulica disponible como adjunto técnico."
    if required:
        return "Anexo A - Gráfico/carta de prueba hidráulica pendiente de carga."
    return "No aplica."

def _has_pattern_data(p: dict) -> bool:
    keys = ["pattern_name", "pattern_serial_number", "pattern_certificate_number", "pattern_range_value", "pattern_calibration_date", "pattern_recalibration_date"]
    return any(_v(p.get(k)).strip() for k in keys)


def _draw_patterns(c: canvas.Canvas, patterns: list[dict], y: float) -> float:
    real_patterns = [p for p in patterns if _has_pattern_data(p)]
    y = _section_title(c, "Trazabilidad de patrones aplicados", y)
    if not real_patterns:
        rows = [[_p("Equipo patrón", PB), _p("Sin equipo patrón declarado"), _p("Estado", PB), _p("—")]]
        y -= _table(c, rows, MARGIN_X, y, [38 * mm, 68 * mm, 25 * mm, CONTENT_W - 131 * mm]) + 6 * mm
        return y

    table_rows = [[_p("Patrón", PSB), _p("Certificado", PSB), _p("Rango", PSB), _p("Calibración", PSB), _p("Recalibración", PSB)]]
    for p in real_patterns[:5]:
        pattern_name = " ".join(filter(None, [_v(p.get("pattern_name")), _v(p.get("pattern_serial_number"))])).strip()
        table_rows.append([
            _p(pattern_name, PS),
            _p(p.get("pattern_certificate_number"), PS),
            _p(_num_unit(p.get("pattern_range_value"), p.get("pattern_unit")), PS),
            _p(_date(p.get("pattern_calibration_date")), PS),
            _p(_date(p.get("pattern_recalibration_date")), PS),
        ])
    th = _table(c, table_rows, MARGIN_X, y, [43 * mm, 42 * mm, 32 * mm, 35 * mm, CONTENT_W - 152 * mm], header=True)
    return y - th - 6 * mm


def _draw_page_1(c: canvas.Canvas, cert: dict, patterns: list[dict]):
    y = _draw_header(c, cert, 1, 3 if cert.get("requires_hydraulic_chart") else 2)

    y = _section_title(c, "Datos del cliente y documento", y)
    rows = [
        [_p("Cliente", PB), _p(cert.get("client_name") or cert.get("client_name_snapshot")), _p("CUIT", PB), _p(cert.get("client_cuit") or cert.get("client_cuit_snapshot"))],
        [_p("Orden de compra", PB), _p(cert.get("purchase_order")), _p("Tipo de documento", PB), _p(cert.get("document_type"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [34 * mm, 67 * mm, 34 * mm, CONTENT_W - 135 * mm]) + 5.5 * mm

    y = _section_title(c, "Datos del equipo / activo certificado", y)
    rows = [
        [_p("Elemento", PB), _p(cert.get("element")), _p("Tipo / Modelo", PB), _p(cert.get("type_model"))],
        [_p("Marca", PB), _p(cert.get("brand")), _p("Serie", PB), _p(cert.get("serial_number"))],
        [_p("Rango", PB), _p(_num_unit(cert.get("range_value"), cert.get("unit"))), _p("Size", PB), _p(cert.get("size_value"))],
        [_p("Unidad / Equipo", PB), _p(cert.get("asset_unit_code")), _p("Precinto", PB), _p(cert.get("seal_number"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [30 * mm, 70 * mm, 30 * mm, CONTENT_W - 130 * mm]) + 5.5 * mm

    y = _section_title(c, "Fechas, frecuencia y condiciones", y)
    rows = [
        [_p("Calibración", PB), _p(_date(cert.get("calibration_date"))), _p("Vencimiento", PB), _p(_date(cert.get("expiration_date"))), _p("Frecuencia", PB), _p(f"{cert.get('test_frequency_months') or ''} meses".strip())],
        [_p("Medio prueba", PB), _p(cert.get("test_medium")), _p("Temp. ambiente", PB), _p(cert.get("ambient_temperature")), _p("Unidad ensayo", PB), _p(cert.get("measurement_unit"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [25 * mm, 35 * mm, 27 * mm, 35 * mm, 27 * mm, CONTENT_W - 149 * mm]) + 5.5 * mm

    y = _draw_text_box(c, "Método de referencia y protocolo aplicado", cert.get("reference_method"), y, 20 * mm, "Sin método declarado.")

    y = _section_title(c, "Condiciones del ensayo", y)
    rows = [
        [_p("Tipo de prueba", PB), _p(cert.get("test_type")), _p("Observaciones", PB), _p(cert.get("observations"))],
        [_p("Condiciones ambientales", PB), _p(cert.get("environmental_conditions")), _p("Resultado", PB), _p(cert.get("trial_result"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [39 * mm, 62 * mm, 34 * mm, CONTENT_W - 135 * mm]) + 5.5 * mm

    y = _draw_text_box(c, "Conclusiones", cert.get("conclusions"), y, 14 * mm, "Sin conclusiones declaradas.")

    if y > 72 * mm:
        y = _draw_patterns(c, patterns, y)

    _draw_signature_area(c, cert, 24 * mm)
    _draw_footer(c)


def _draw_simple_pressure_table(c: canvas.Canvas, tests: list[dict], y: float) -> float:
    y = _section_title(c, "Resultados de presión / control", y)
    rows = [[_p("Presión", PSB), _p("Rango / Unidad", PSB), _p("Criterio", PSB), _p("Resultado", PSB), _p("Observaciones", PSB)]]
    for t in tests[:10]:
        rows.append([
            _p(t.get("pressure_label"), PS),
            _p(_num_unit(t.get("range_value"), t.get("unit")), PS),
            _p(t.get("acceptance_criteria"), PS),
            _p(t.get("result"), PS),
            _p(t.get("observations"), PS),
        ])
    if len(rows) == 1:
        rows.append([_p("Sin registros", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS)])
    th = _table(c, rows, MARGIN_X, y, [44 * mm, 33 * mm, 42 * mm, 30 * mm, CONTENT_W - 149 * mm], header=True)
    return y - th - 6 * mm


def _draw_metrology_table(c: canvas.Canvas, rows_data: list[dict], y: float) -> float:
    y = _section_title(c, "Tabla metrológica - Patrón vs instrumento MD", y)
    rows = [[_p("Punto", PSB), _p("Dir.", PSB), _p("Patrón", PSB), _p("Instrumento MD", PSB), _p("Error", PSB), _p("Error adm.", PSB), _p("Incert.", PSB), _p("Resultado", PSB)]]
    for r in rows_data[:10]:
        rows.append([
            _p(r.get("point_label"), PS),
            _p(r.get("direction"), PS),
            _p(_num_unit(r.get("pattern_pressure"), r.get("unit")), PS),
            _p(_num_unit(r.get("instrument_reading"), r.get("unit")), PS),
            _p(_num_unit(r.get("error_value"), r.get("unit")), PS),
            _p(_num_unit(r.get("max_allowed_error"), r.get("unit")), PS),
            _p(_num_unit(r.get("uncertainty"), r.get("unit")), PS),
            _p(r.get("result"), PS),
        ])
    if len(rows) == 1:
        rows.append([_p("Sin registros", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS)])
    th = _table(c, rows, MARGIN_X, y, [24 * mm, 20 * mm, 28 * mm, 31 * mm, 23 * mm, 25 * mm, 23 * mm, CONTENT_W - 174 * mm], header=True)
    return y - th - 6 * mm


def _draw_sensor_loop_table(c: canvas.Canvas, rows_data: list[dict], y: float) -> float:
    y = _section_title(c, "Tabla de calibración de lazo eléctrico", y)
    rows = [[_p("Presión", PSB), _p("Patrón", PSB), _p("Señal esp.", PSB), _p("Señal med.", PSB), _p("Unidad", PSB), _p("Lectura pantalla", PSB), _p("Error", PSB), _p("Resultado", PSB)]]
    for r in rows_data[:10]:
        rows.append([
            _p(_display(r.get("pressure_applied")), PS),
            _p(_display(r.get("pattern_reading")), PS),
            _p(_display(r.get("expected_signal")), PS),
            _p(_display(r.get("measured_signal")), PS),
            _p(r.get("signal_unit"), PS),
            _p(_display(r.get("display_reading")), PS),
            _p(_display(r.get("error_value")), PS),
            _p(r.get("result"), PS),
        ])
    if len(rows) == 1:
        rows.append([_p("Sin registros", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS), _p("—", PS)])
    th = _table(c, rows, MARGIN_X, y, [24 * mm, 24 * mm, 25 * mm, 25 * mm, 18 * mm, 34 * mm, 20 * mm, CONTENT_W - 170 * mm], header=True)
    return y - th - 6 * mm


def _draw_relief_section(c: canvas.Canvas, result: dict | None, chart_url: str | None, y: float) -> float:
    y = _section_title(c, "Ensayo de apertura / seteo de válvula Relief / PRV", y)
    r = result or {}
    rows = [
        [_p("Presión de seteo", PB), _p(r.get("set_pressure_required")), _p("Apertura real", PB), _p(r.get("opening_pressure"))],
        [_p("Tolerancia", PB), _p(f"{_display(r.get('tolerance_percent'))}%"), _p("Reasentamiento / cierre", PB), _p(r.get("reclosing_pressure"))],
        [_p("Hermeticidad asiento", PB), _p(r.get("leak_test_pressure")), _p("Resultado hermeticidad", PB), _p(r.get("leak_test_result"))],
        [_p("Precinto", PB), _p(r.get("seal_number")), _p("Resultado final", PB), _p(r.get("result"))],
        [_p("Medio / temperatura", PB), _p(" / ".join(filter(None, [_v(r.get("test_medium")).strip(), _v(r.get("ambient_temperature")).strip()]))), _p("Observaciones", PB), _p(r.get("observations"))],
        [_p("Anexo A", PB), _p("Gráfico/carta de prueba hidráulica adjunto al legajo técnico." if chart_url else "Gráfico/carta de prueba hidráulica pendiente de carga."), _p("", PB), _p("")],
    ]
    th = _table(c, rows, MARGIN_X, y, [35 * mm, 60 * mm, 35 * mm, CONTENT_W - 130 * mm])
    return y - th - 6 * mm


def _draw_hydrostatic_section(c: canvas.Canvas, result: dict | None, chart_url: str | None, y: float) -> float:
    y = _section_title(c, "Ensayo hidrostático de resistencia y estanqueidad", y)
    r = result or {}
    chart_text = _annex_label(chart_url, True)
    rows = [
        [_p("Presión trabajo", PB), _p(r.get("work_pressure")), _p("Presión prueba", PB), _p(r.get("test_pressure"))],
        [_p("Sostenimiento", PB), _p(f"{_display(r.get('hold_minutes'))} min"), _p("Caída presión", PB), _p(r.get("pressure_drop"))],
        [_p("Medio prueba", PB), _p(r.get("test_medium")), _p("Resultado", PB), _p(r.get("result"))],
        [_p("Control espesores", PB), _p("Sí" if r.get("thickness_control") else "No"), _p("Método espesores", PB), _p(r.get("thickness_method"))],
        [_p("Valores espesores", PB), _p(r.get("thickness_values")), _p("Anexo A", PB), _p("Gráfico/carta de prueba hidráulica adjunto al legajo técnico." if chart_url else "Gráfico/carta de prueba hidráulica pendiente de carga.")],
        [_p("Observaciones", PB), _p(r.get("observations")), _p("", PB), _p("")],
    ]
    th = _table(c, rows, MARGIN_X, y, [38 * mm, 57 * mm, 38 * mm, CONTENT_W - 133 * mm])
    return y - th - 6 * mm


def _draw_emission_control(c: canvas.Canvas, cert: dict, y: float):
    y = _section_title(c, "Emisión y control", y)
    left_w = CONTENT_W - 68 * mm
    box_h = 31 * mm
    note_parts = [
        "Documento emitido para impresión, revisión y firma por el responsable autorizado.",
        "La información técnica corresponde a los datos cargados y aprobados en el sistema.",
    ]
    if cert.get("requires_hydraulic_chart"):
        note_parts.append("El gráfico/carta de prueba hidráulica se identifica como ANEXO A y forma parte del legajo técnico asociado.")
    notes = " ".join(note_parts)
    c.setFillColor(LIGHTER)
    c.roundRect(MARGIN_X, y - box_h, left_w - 5 * mm, box_h, 2 * mm, stroke=0, fill=1)
    p = _p(notes, PS, "")
    p.wrapOn(c, left_w - 11 * mm, box_h - 6 * mm)
    p.drawOn(c, MARGIN_X + 3 * mm, y - box_h + 6 * mm)
    _draw_qr_card(c, cert, MARGIN_X + left_w, y - box_h, 68 * mm, box_h)
    return y - box_h - 6 * mm


def _draw_page_2(c: canvas.Canvas, cert: dict, detail: dict):
    y = _draw_header(c, cert, 2, 3 if cert.get("requires_hydraulic_chart") else 2)
    tests = detail.get("test_rows", []) or []
    metrology = detail.get("metrology_results", []) or []
    sensor_loop = detail.get("sensor_loop_results", []) or []
    relief = detail.get("relief_valve_result")
    hydro = detail.get("hydrostatic_result")
    template = cert.get("template_type") or "general_pressure"
    chart_url = cert.get("hydraulic_test_chart_url") or (detail.get("hydraulic_test_chart") or {}).get("file_url")

    y = _section_title(c, "Resumen del ensayo", y)
    rows = [
        [_p("Elemento", PB), _p(cert.get("element")), _p("Serie", PB), _p(cert.get("serial_number"))],
        [_p("Resultado", PB), _p(cert.get("trial_result")), _p("Aprobado", PB), _p("SI" if cert.get("approved_result") else "NO")],
        [_p("Frecuencia", PB), _p(f"{cert.get('test_frequency_months') or ''} meses".strip()), _p("Vencimiento", PB), _p(_date(cert.get("expiration_date")))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [35 * mm, 70 * mm, 34 * mm, CONTENT_W - 139 * mm]) + 6 * mm

    if cert.get("approved_result"):
        _badge(c, MARGIN_X, y - 7.5 * mm, "APROBADO", "green")
    else:
        _badge(c, MARGIN_X, y - 7.5 * mm, "NO APROBADO", "red")
    if cert.get("requires_hydraulic_chart"):
        _badge(c, MARGIN_X + 38 * mm, y - 7.5 * mm, "ANEXO A", "amber")
    y -= 13 * mm

    if template == "pressure_gauge":
        y = _draw_metrology_table(c, metrology, y)
    elif template == "pressure_head_sensor":
        y = _draw_sensor_loop_table(c, sensor_loop, y)
    elif template == "relief_valve_set":
        # For relief valves the specific set/open/reseat/leak table is the governing
        # technical result. The generic pressure table is intentionally omitted to
        # avoid duplicating default rows that do not belong to this method.
        y = _draw_relief_section(c, relief, chart_url, y)
    elif template == "hydrostatic_line":
        # For hydrostatic certificates the specific hydrostatic section is sufficient;
        # pressure chart/carta is referenced as Annex A.
        y = _draw_hydrostatic_section(c, hydro, chart_url, y)
    else:
        y = _draw_simple_pressure_table(c, tests, y)

    if y > 122 * mm:
        y = _draw_text_box(c, "Comentarios finales", cert.get("final_comments"), y, 11 * mm, "Sin comentarios finales.")

    if cert.get("requires_hydraulic_chart"):
        # For certificates with Annex A, do not force QR/emission/signatures on page 2.
        # Keeping those blocks on the annex page prevents the visual overlap seen in dense reports.
        y = _section_title(c, "Referencia documental", y)
        rows = [[
            _p("ANEXO A", PB),
            _p("El gráfico/carta de prueba hidráulica se identifica como ANEXO A y forma parte del legajo técnico asociado a este certificado.")
        ]]
        _table(c, rows, MARGIN_X, y, [34 * mm, CONTENT_W - 34 * mm])
        _draw_footer(c)
        return

    # Keep emission/QR and signatures in fixed safe zones so they never overlap.
    _draw_emission_control(c, cert, 82 * mm)
    _draw_signature_area(c, cert, 20 * mm)
    _draw_footer(c)


def _draw_annex_a_page(c: canvas.Canvas, cert: dict, detail: dict):
    y = _draw_header(c, cert, 3, 3)
    chart_url = cert.get("hydraulic_test_chart_url") or (detail.get("hydraulic_test_chart") or {}).get("file_url")
    chart_name = cert.get("hydraulic_test_chart_file_name") or (detail.get("hydraulic_test_chart") or {}).get("file_name")

    y = _section_title(c, "ANEXO A - Gráfico / carta de prueba hidráulica", y)
    rows = [
        [_p("Certificado", PB), _p(cert.get("certificate_number")), _p("Tipo de anexo", PB), _p("Gráfico/carta de prueba hidráulica")],
        [_p("Documento asociado", PB), _p(cert.get("document_type")), _p("Estado", PB), _p("Adjunto cargado" if chart_url else "Pendiente de carga")],
        [_p("Archivo", PB), _p(chart_name or "—"), _p("Cliente", PB), _p(cert.get("client_name") or cert.get("client_name_snapshot"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [34 * mm, 64 * mm, 34 * mm, CONTENT_W - 132 * mm]) + 7 * mm

    y = _draw_text_box(
        c,
        "Alcance del anexo",
        "El gráfico/carta de prueba hidráulica asociado a este certificado se identifica como ANEXO A. "
        "Este documento constituye evidencia técnica complementaria del ensayo realizado y forma parte del legajo técnico del certificado.",
        y,
        22 * mm,
        "—",
    )

    y = _section_title(c, "Referencia al ensayo", y)
    rows = [
        [_p("Elemento", PB), _p(cert.get("element")), _p("Serie", PB), _p(cert.get("serial_number"))],
        [_p("Rango", PB), _p(_num_unit(cert.get("range_value"), cert.get("unit"))), _p("Fecha de ensayo", PB), _p(_date(cert.get("calibration_date")))],
        [_p("Medio de prueba", PB), _p(cert.get("test_medium")), _p("Temperatura", PB), _p(cert.get("ambient_temperature"))],
    ]
    y -= _table(c, rows, MARGIN_X, y, [34 * mm, 64 * mm, 34 * mm, CONTENT_W - 132 * mm]) + 8 * mm

    if chart_url:
        y = _draw_text_box(
            c,
            "Archivo adjunto",
            f"El ANEXO A se encuentra disponible para descarga desde la web del cliente, dentro del legajo del certificado N° {cert.get('certificate_number')}. Debe consultarse bajo ese número de certificado como archivo técnico asociado.",
            y,
            21 * mm,
            "—",
        )
    else:
        y = _draw_text_box(c, "Archivo adjunto", "El gráfico/carta de prueba hidráulica todavía no fue cargado. El certificado no debería aprobarse sin este adjunto cuando la plantilla lo requiere.", y, 19 * mm, "—")

    # Page 3 is intentionally reserved for annex control, QR and signatures.
    _draw_emission_control(c, cert, 98 * mm)
    _draw_signature_area(c, cert, 22 * mm)
    _draw_footer(c)


def generate_certificate_pdf(cert_id: str, user) -> str:
    detail = certificate_detail(cert_id, user)
    cert = detail["certificate"]
    patterns = detail.get("patterns", []) or []

    filename = f"{_safe_filename(cert['certificate_number'])}.pdf"
    filepath = CERT_DIR / filename
    public_url = f"{settings.PUBLIC_BASE_URL}/static/certificates/{filename}"

    c = canvas.Canvas(str(filepath), pagesize=A4)
    title = _display(cert.get("document_type"), "Certificado técnico")
    c.setTitle(f"{title} {cert.get('certificate_number')}")
    c.setAuthor(settings.COMPANY_NAME)
    c.setSubject(title)

    _draw_page_1(c, cert, patterns)
    c.showPage()
    _draw_page_2(c, cert, detail)
    if cert.get("requires_hydraulic_chart"):
        c.showPage()
        _draw_annex_a_page(c, cert, detail)
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
        [cert_id, user["id"], "PDF generado con secciones técnicas según plantilla MD, QR de autenticidad y datos completos del ensayo."],
    )
    return public_url
