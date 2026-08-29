from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

if "from pathlib import Path" not in text:
    text = "from pathlib import Path\n" + text

if "from reportlab.lib.utils import ImageReader" not in text:
    anchor = re.search(r'(?m)^(from reportlab\.[^\n]+\n(?:from reportlab\.[^\n]+\n)*)', text)
    if anchor:
        text = text[:anchor.end()] + "from reportlab.lib.utils import ImageReader\n" + text[anchor.end():]
    else:
        text = "from reportlab.lib.utils import ImageReader\n" + text

helper = '''
FOOTER_LOGO_FIRMA = "logo_firma.png"
FOOTER_LOGO_SELLO = "logo_sello_sip.png"

def _certificate_asset_path(filename: str) -> Path:
    return Path(__file__).resolve().parent.parent / "static" / "certificate_assets" / filename

def draw_certificate_footer_images(c):
    # Dibuja firma y sello dentro del recuadro "FIRMA Y SELLO DEL RESPONSABLE".
    try:
        page_width, _ = c._pagesize
        try:
            if int(c.getPageNumber()) != 1:
                return
        except Exception:
            pass

        firma_path = _certificate_asset_path(FOOTER_LOGO_FIRMA)
        sello_path = _certificate_asset_path(FOOTER_LOGO_SELLO)
        box_x = page_width * 0.52
        box_w = page_width * 0.42
        box_y = 92

        if firma_path.exists():
            try:
                img = ImageReader(str(firma_path))
                iw, ih = img.getSize()
                target_h = 24
                target_w = max(32, (iw / ih) * target_h)
                c.drawImage(str(firma_path), box_x + 48, box_y + 18, width=target_w, height=target_h, preserveAspectRatio=True, mask='auto')
            except Exception:
                pass

        if sello_path.exists():
            try:
                img = ImageReader(str(sello_path))
                iw, ih = img.getSize()
                target_h = 34
                target_w = max(24, (iw / ih) * target_h)
                c.drawImage(str(sello_path), box_x + box_w - target_w - 40, box_y + 10, width=target_w, height=target_h, preserveAspectRatio=True, mask='auto')
            except Exception:
                pass
    except Exception:
        pass


'''

start = text.find('FOOTER_LOGO_FIRMA = "logo_firma.png"')
if start != -1:
    next_def = re.search(r'(?m)^def (?!_certificate_asset_path|draw_certificate_footer_images)', text[start:])
    if next_def:
        end = start + next_def.start()
        text = text[:start] + text[end:]
    else:
        text = text[:start]

first_def = re.search(r'(?m)^def ', text)
if first_def:
    text = text[:first_def.start()] + helper + text[first_def.start():]
else:
    text += helper

def inject_before(src: str, exact_call: str) -> str:
    lines = src.splitlines(True)
    out = []
    for line in lines:
        if line.strip() == exact_call:
            indent = line[:len(line)-len(line.lstrip())]
            prev = out[-1].strip() if out else ''
            if prev != "draw_certificate_footer_images(c)":
                out.append(f"{indent}draw_certificate_footer_images(c)\n")
        out.append(line)
    return "".join(out)

text = inject_before(text, "c.showPage()")
text = inject_before(text, "c.save()")
path.write_text(text, encoding="utf-8")
print("PATCH_OK")