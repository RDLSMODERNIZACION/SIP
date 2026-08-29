from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

if "from reportlab.lib.utils import ImageReader" not in text:
    anchor = re.search(r'(?m)^(from reportlab\.[^\n]+\n(?:from reportlab\.[^\n]+\n)*)', text)
    if anchor:
        text = text[:anchor.end()] + "from reportlab.lib.utils import ImageReader\n" + text[anchor.end():]
    else:
        text = "from reportlab.lib.utils import ImageReader\n" + text

if "FOOTER_LOGO_FIRMA" not in text:
    first_def = re.search(r'(?m)^def ', text)
    helper = (
        'FOOTER_LOGO_FIRMA = "logo_firma.png"\n'
        'FOOTER_LOGO_SELLO = "logo_sello_sip.png"\n\n'
        'def _certificate_asset_path(filename: str) -> Path:\n'
        '    return Path(__file__).resolve().parent.parent / "static" / "certificate_assets" / filename\n\n\n'
    )
    if first_def:
        text = text[:first_def.start()] + helper + text[first_def.start():]
    else:
        text += helper
elif "FOOTER_LOGO_SELLO" not in text:
    text = text.replace('FOOTER_LOGO_FIRMA = "logo_firma.png"\n', 'FOOTER_LOGO_FIRMA = "logo_firma.png"\nFOOTER_LOGO_SELLO = "logo_sello_sip.png"\n', 1)

pattern = re.compile(r'(?ms)^def _draw_signature_area\(c: canvas\.Canvas, cert: dict, y: float\):\n.*?(?=^def _draw_qr_card)')
replacement = 'def _draw_signature_area(c: canvas.Canvas, cert: dict, y: float):\n    x = MARGIN_X\n    gap = 10 * mm\n    box_w = (CONTENT_W - gap) / 2\n    box_h = 29 * mm\n\n    titles = [\n        "Firma y sello del responsable",\n        "Sello de laboratorio",\n    ]\n    certificate_number = cert.get("certificate_number") or ""\n\n    firma_path = _certificate_asset_path(FOOTER_LOGO_FIRMA)\n    sello_path = _certificate_asset_path(FOOTER_LOGO_SELLO)\n\n    for i, title in enumerate(titles):\n        xx = x + i * (box_w + gap)\n\n        c.setFillColor(WHITE)\n        _stroke(c, LINE, 0.45)\n        c.roundRect(xx, y, box_w, box_h, 2 * mm, stroke=1, fill=1)\n\n        c.setFillColor(LIGHTER)\n        c.roundRect(xx, y + box_h - 7 * mm, box_w, 7 * mm, 2 * mm, stroke=0, fill=1)\n\n        c.setFillColor(SLATE)\n        c.setFont("Helvetica-Bold", 6.7)\n        c.drawCentredString(xx + box_w / 2, y + box_h - 4.8 * mm, title.upper())\n\n        c.setStrokeColor(LINE)\n        c.setLineWidth(0.45)\n        c.line(xx + 14 * mm, y + 13 * mm, xx + box_w - 14 * mm, y + 13 * mm)\n\n        if i == 0 and firma_path.exists():\n            try:\n                firma = ImageReader(str(firma_path))\n                fw, fh = firma.getSize()\n                target_h = 19.5 * mm\n                target_w = target_h * fw / fh\n                max_w = box_w * 0.78\n                if target_w > max_w:\n                    target_w = max_w\n                    target_h = target_w * fh / fw\n\n                firma_x = xx + (box_w - target_w) / 2\n                firma_y = y + 5.8 * mm\n\n                c.drawImage(\n                    str(firma_path),\n                    firma_x,\n                    firma_y,\n                    width=target_w,\n                    height=target_h,\n                    preserveAspectRatio=True,\n                    mask="auto",\n                )\n            except Exception:\n                pass\n\n        if i == 1 and sello_path.exists():\n            try:\n                sello = ImageReader(str(sello_path))\n                sw, sh = sello.getSize()\n                target_h = 17.5 * mm\n                target_w = target_h * sw / sh\n                max_w = box_w * 0.42\n                if target_w > max_w:\n                    target_w = max_w\n                    target_h = target_w * sh / sw\n\n                sello_x = xx + (box_w - target_w) / 2\n                sello_y = y + 6.2 * mm\n\n                c.drawImage(\n                    str(sello_path),\n                    sello_x,\n                    sello_y,\n                    width=target_w,\n                    height=target_h,\n                    preserveAspectRatio=True,\n                    mask="auto",\n                )\n            except Exception:\n                pass\n\n        c.setFillColor(MUTED)\n        c.setFont("Helvetica", 5.5)\n\n        if i == 0:\n            c.drawCentredString(xx + box_w / 2, y + 1.9 * mm, f"Certificado N° {certificate_number}")\n        else:\n            c.drawCentredString(xx + box_w / 2, y + 1.9 * mm, "Sello institucional")\n\n\n'
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("No pude reemplazar _draw_signature_area")

text = re.sub(r'(?m)^[ \t]*draw_certificate_footer_images\(c\)\s*\n', '', text)
path.write_text(text, encoding="utf-8")
print("PATCH_OK")
