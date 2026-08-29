param(
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok([string]$m) { Write-Host "   [OK] $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "   [AVISO] $m" -ForegroundColor Yellow }

function Resolve-Root([string]$Requested) {
    $candidates = @()
    if ($Requested) { $candidates += $Requested }
    $candidates += (Get-Location).Path
    $candidates += (Split-Path -Parent $PSScriptRoot)

    foreach ($x in $candidates) {
        if (-not $x) { continue }
        $p = [IO.Path]::GetFullPath($x)

        if ((Test-Path "$p\back\app\services\pdf_service.py") -and (Test-Path "$p\.git")) {
            return $p
        }

        $parent = Split-Path -Parent $p
        if ($parent -and (Test-Path "$parent\back\app\services\pdf_service.py")) {
            return $parent
        }
    }

    throw "No encontré la raíz del proyecto SIP."
}

$root = Resolve-Root $ProjectRoot
$pdfService = Join-Path $root "back\app\services\pdf_service.py"
$assetsDir = Join-Path $root "back\app\static\certificate_assets"

Step "Proyecto detectado: $root"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$pdfService.backup_footer_$stamp"
Copy-Item $pdfService $backup -Force
Ok "Backup de pdf_service.py: $backup"

Step "Copiando imágenes al backend"
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "logo_firma.png") (Join-Path $assetsDir "logo_firma.png") -Force
Copy-Item (Join-Path $PSScriptRoot "logo_sello_sip.png") (Join-Path $assetsDir "logo_sello_sip.png") -Force
Ok "Imágenes copiadas a back\app\static\certificate_assets"

$patchPy = @'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# 1) Import helper if missing
if "from reportlab.lib.utils import ImageReader" not in text:
    # try to insert next to other reportlab imports
    reportlab_anchor = re.search(r'(?m)^(from reportlab\.[^\n]+\n(?:from reportlab\.[^\n]+\n)*)', text)
    if reportlab_anchor:
        insert_at = reportlab_anchor.end()
        text = text[:insert_at] + "from reportlab.lib.utils import ImageReader\n" + text[insert_at:]
    else:
        # fallback after pathlib import or top imports
        generic_anchor = re.search(r'(?m)^from pathlib import Path\n', text)
        if generic_anchor:
            insert_at = generic_anchor.end()
            text = text[:insert_at] + "from reportlab.lib.utils import ImageReader\n" + text[insert_at:]
        else:
            text = "from reportlab.lib.utils import ImageReader\n" + text

# 2) Ensure Path import exists
if "from pathlib import Path" not in text and "import pathlib" not in text:
    first_import = re.search(r'(?m)^(from [^\n]+ import [^\n]+\n|import [^\n]+\n)+', text)
    if first_import:
        insert_at = first_import.end()
        text = text[:insert_at] + "from pathlib import Path\n" + text[insert_at:]
    else:
        text = "from pathlib import Path\n" + text

# 3) Add footer helper once
helper_name = "draw_certificate_footer_images"
if helper_name not in text:
    helper_block = 