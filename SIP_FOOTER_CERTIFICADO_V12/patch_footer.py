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

helper = """
FOOTER_LOGO_FIRMA = "logo_firma.png"
FOOTER_LOGO_SELLO = "logo_sello_sip.png"

def _certificate_asset_path(filename: str) -> Path:
    return Path(__file__).resolve().parent.parent / "static" / "certificate_assets" / filename

def draw_certificate_footer_images(c):
    try:
        page_width, _ = c._pagesize
        base_y = 18

        left_path = _certificate_asset_path(FOOTER_LOGO_FIRMA)
        right_path = _certificate_asset_path(FOOTER_LOGO_SELLO)

        try:
            c.saveState()
            c.setLineWidth(0.6)
            c.setStrokeColorRGB(0.82, 0.84, 0.88)
            c.line(35, base_y + 42, page_width - 35, base_y + 42)
            c.restoreState()
        except Exception:
            pass

        if left_path.exists():
            try:
                img = ImageReader(str(left_path))
                iw, ih = img.getSize()
                target_h = 32
                target_w = max(20, (iw / ih) * target_h)
                c.drawImage(
                    str(left_path),
                    42,
                    base_y,
                    width=target_w,
                    height=target_h,
                    preserveAspectRatio=True,
                    mask="auto",
                )
            except Exception:
                pass

        if right_path.exists():
            try:
                img = ImageReader(str(right_path))
                iw, ih = img.getSize()
                target_h = 40
                target_w = max(24, (iw / ih) * target_h)
                c.drawImage(
                    str(right_path),
                    page_width - target_w - 42,
                    base_y - 3,
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

if "def draw_certificate_footer_images(c):" not in text:
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
    raise SystemExit("No pude insertar el footer en pdf_service.py")

path.write_text(text, encoding="utf-8")
print("PATCH_OK")
