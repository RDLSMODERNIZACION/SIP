from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# Imports requeridos
if "from pathlib import Path" not in text:
    text = "from pathlib import Path\n" + text

if "from reportlab.lib.utils import ImageReader" not in text:
    anchor = re.search(r'(?m)^(from reportlab\.[^\n]+\n(?:from reportlab\.[^\n]+\n)*)', text)
    if anchor:
        text = text[:anchor.end()] + "from reportlab.lib.utils import ImageReader\n" + text[anchor.end():]
    else:
        text = "from reportlab.lib.utils import ImageReader\n" + text

helper = """
FOOTER_LOGO_FIRMA = "logo_firma.png"
FOOTER_LOGO_SELLO = "logo_sello_sip.png"

def _certificate_asset_path(filename: str) -> Path:
    return Path(__file__).resolve().parent.parent / "static" / "certificate_assets" / filename

def draw_certificate_footer_images(c):
    \"\"
    Dibuja la firma y el sello dentro del recuadro inferior derecho:
    'FIRMA Y SELLO DEL RESPONSABLE'.
    No los dibuja en el pie absoluto de la página.
    \"\"
    try:
        page_width, page_height = c._pagesize

        # Solo primera página del certificado.
        try:
            if int(c.getPageNumber()) != 1:
                return
        except Exception:
            pass

        firma_path = _certificate_asset_path(FOOTER_LOGO_FIRMA)
        sello_path = _certificate_asset_path(FOOTER_LOGO_SELLO)

        # Coordenadas aproximadas para A4 apaisado / layout actual del certificado.
        # Recuadro derecho inferior.
        box_x = page_width * 0.52
        box_w = page_width * 0.42
        box_y = 92
        box_h = 72

        # Firma: centrada horizontalmente en el sector izquierdo del recuadro derecho.
        if firma_path.exists():
            try:
                img = ImageReader(str(firma_path))
                iw, ih = img.getSize()
                target_h = 24
                target_w = max(32, (iw / ih) * target_h)
                sig_x = box_x + 48
                sig_y = box_y + 18
                c.drawImage(
                    str(firma_path),
                    sig_x,
                    sig_y,
                    width=target_w,
                    height=target_h,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                pass

        # Sello SIP: dentro del mismo recuadro, hacia la derecha.
        if sello_path.exists():
            try:
                img = ImageReader(str(sello_path))
                iw, ih = img.getSize()
                target_h = 34
                target_w = max(24, (iw / ih) * target_h)
                seal_x = box_x + box_w - target_w - 40
                seal_y = box_y + 10
                c.drawImage(
                    str(sello_path),
                    seal_x,
                    seal_y,
                    width=target_w,
                    height=target_h,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                pass
    except Exception:
        pass


"""

# Reemplazar helper si ya existía, o insertarlo si no existía.
pattern_existing = re.compile(
    r'(?ms)^FOOTER_LOGO_FIRMA = "logo_firma\.png".*?^def draw_certificate_footer_images\(c\):.*?(?=^def |\Z)'
)
if pattern_existing.search(text):
    text = pattern_existing.sub(helper, text, count=1)
else:
    first_def = re.search(r'(?m)^def ', text)
    if first_def:
        text = text[:first_def.start()] + helper + text[first_def.start():]
    else:
        text += helper

def inject_before(src: str, exact_call: str) -> str:
    lines = src.splitlines(True)
    out = []
    for line in lines:
        stripped = line.strip()
        if stripped == exact_call:
            indent = line[:len(line)-len(line.lstrip())]
            prev = out[-1].strip() if out else ""
            if prev != "draw_certificate_footer_images(c)":
                out.append(f"{indent}draw_certificate_footer_images(c)\n")
        out.append(line)
    return "".join(out)

text = inject_before(text, "c.showPage()")
text = inject_before(text, "c.save()")

if "draw_certificate_footer_images(c)" not in text:
    raise SystemExit("No pude insertar la llamada del recuadro de firma")

path.write_text(text, encoding="utf-8")
print("PATCH_OK")
