from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# Ensure imports
if "from pathlib import Path" not in text:
    text = "from pathlib import Path\n" + text

if "from reportlab.lib.utils import ImageReader" not in text:
    anchor = re.search(r'(?m)^(from reportlab\.[^\n]+\n(?:from reportlab\.[^\n]+\n)*)', text)
    if anchor:
        text = text[:anchor.end()] + "from reportlab.lib.utils import ImageReader\n" + text[anchor.end():]
    else:
        text = "from reportlab.lib.utils import ImageReader\n" + text

helper = r