from pathlib import Path
import sys, hashlib

try:
    from PIL import Image
except Exception:
    Image = None

for raw in sys.argv[1:]:
    p = Path(raw)
    print(f"\nArchivo: {p}")
    if not p.exists():
        print("  NO EXISTE")
        continue
    data = p.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    print(f"  bytes: {len(data)}")
    print(f"  sha256: {sha}")
    if Image:
        try:
            im = Image.open(p)
            print(f"  size: {im.size}")
            print(f"  mode: {im.mode}")
            has_alpha = "A" in im.getbands()
            print(f"  alpha: {has_alpha}")
        except Exception as e:
            print(f"  no pude abrir la imagen: {e}")
