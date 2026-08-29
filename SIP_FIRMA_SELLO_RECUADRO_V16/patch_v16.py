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
    helper = 'FOOTER_LOGO_FIRMA = "logo_firma.png"\nFOOTER_LOGO_SELLO = "logo_sello_sip.png"\n\ndef _certificate_asset_path(filename: str) -> Path:\n    return Path(__file__).resolve().parent.parent / "static" / "certificate_assets" / filename\n\n\n'
    if first_def:
        text = text[:first_def.start()] + helper + text[first_def.start():]
    else:
        text += helper

pattern = re.compile(r'(?ms)^def _draw_signature_area\(c: canvas\.Canvas, cert: dict, y: float\):\n.*?(?=^def _draw_qr_card)')
replacement = 'def _draw_signature_area(c: canvas.Canvas, cert: dict, y: float):\n    x = MARGIN_X\n    gap = 10 * mm\n    box_w = (CONTENT_W - gap) / 2\n    box_h = 29 * mm\n    titles = ["Responsable del ensayo", "Firma y sello del responsable"]\n    responsible = _display(cert.get("responsible_name"), "")\n    license_text = _display(cert.get("responsible_license"), "")\n\n    for i, title in enumerate(titles):\n        xx = x + i * (box_w + gap)\n        c.setFillColor(WHITE)\n        _stroke(c, LINE, 0.45)\n        c.roundRect(xx, y, box_w, box_h, 2 * mm, stroke=1, fill=1)\n        c.setFillColor(LIGHTER)\n        c.roundRect(xx, y + box_h - 7 * mm, box_w, 7 * mm, 2 * mm, stroke=0, fill=1)\n        c.setFillColor(SLATE)\n        c.setFont("Helvetica-Bold", 6.7)\n        c.drawCentredString(xx + box_w / 2, y + box_h - 4.8 * mm, title.upper())\n        c.setStrokeColor(LINE)\n        c.setLineWidth(0.45)\n        c.line(xx + 14 * mm, y + 13 * mm, xx + box_w - 14 * mm, y + 13 * mm)\n        c.setFillColor(MUTED)\n        c.setFont("Helvetica", 5.6)\n\n        if responsible and i == 0:\n            c.drawCentredString(xx + box_w / 2, y + 8.2 * mm, responsible)\n            if license_text:\n                c.drawCentredString(xx + box_w / 2, y + 5.4 * mm, license_text)\n\n        if i == 1:\n            firma_path = _certificate_asset_path(FOOTER_LOGO_FIRMA)\n            sello_path = _certificate_asset_path(FOOTER_LOGO_SELLO)\n            image_y = y + 4.8 * mm\n\n            if firma_path.exists():\n                try:\n                    firma = ImageReader(str(firma_path))\n                    fw, fh = firma.getSize()\n                    target_h = 8.2 * mm\n                    target_w = target_h * fw / fh\n                    max_w = box_w * 0.46\n                    if target_w > max_w:\n                        target_w = max_w\n                        target_h = target_w * fh / fw\n                    c.drawImage(str(firma_path), xx + 10 * mm, image_y, width=target_w, height=target_h, preserveAspectRatio=True, mask="auto")\n                except Exception:\n                    pass\n\n            if sello_path.exists():\n                try:\n                    sello = ImageReader(str(sello_path))\n                    sw, sh = sello.getSize()\n                    target_h = 9.5 * mm\n                    target_w = target_h * sw / sh\n                    max_w = box_w * 0.26\n                    if target_w > max_w:\n                        target_w = max_w\n                        target_h = target_w * sh / sw\n                    c.drawImage(str(sello_path), xx + box_w - target_w - 10 * mm, image_y - 0.5 * mm, width=target_w, height=target_h, preserveAspectRatio=True, mask="auto")\n                except Exception:\n                    pass\n\n        c.drawCentredString(xx + box_w / 2, y + 2.9 * mm, f"Certificado N° {cert.get(\'certificate_number\') or \'\'}")\n\n\n'
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("No pude encontrar/reemplazar _draw_signature_area")

text = re.sub(r'(?m)^[ \t]*draw_certificate_footer_images\(c\)\s*\n', '', text)
path.write_text(text, encoding="utf-8")
print("PATCH_OK")
