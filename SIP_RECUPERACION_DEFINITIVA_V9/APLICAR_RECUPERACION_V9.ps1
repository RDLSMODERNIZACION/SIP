param(
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$GOOD_COMMIT = "fda17a44fd71ab51b973abf553a16a8f724c79d5"
$RELATIVE_FILE = "back/app/services/certificate_service.py"

function Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok([string]$m) { Write-Host "   [OK] $m" -ForegroundColor Green }

function Resolve-Root([string]$Requested) {
    $candidates = @()
    if ($Requested) { $candidates += $Requested }
    $candidates += (Get-Location).Path
    $candidates += (Split-Path -Parent $PSScriptRoot)

    foreach ($x in $candidates) {
        if (-not $x) { continue }
        $p = [IO.Path]::GetFullPath($x)
        if ((Test-Path "$p\.git") -and (Test-Path "$p\back")) { return $p }

        $parent = Split-Path -Parent $p
        if ($parent -and (Test-Path "$parent\.git") -and (Test-Path "$parent\back")) {
            return $parent
        }
    }

    throw "No encontré la raíz Git del proyecto SIP."
}

$root = Resolve-Root $ProjectRoot
$target = Join-Path $root "back\app\services\certificate_service.py"

Step "Proyecto detectado: $root"

Push-Location $root
try {
    Step "Verificando commit sano"
    & git cat-file -e "$GOOD_COMMIT`^{commit}"
    if ($LASTEXITCODE -ne 0) {
        throw "No existe localmente el commit $GOOD_COMMIT. Ejecutá git fetch origin y volvé a correr este script."
    }
    Ok "Commit sano disponible: $GOOD_COMMIT"

    Step "Guardando copia del archivo actual"
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $broken = "$target.antes_v9_$stamp"
    Copy-Item $target $broken -Force
    Ok "Backup local: $broken"

    Step "Restaurando certificate_service.py desde Git"
    $restored = & git show "$GOOD_COMMIT`:$RELATIVE_FILE"
    if ($LASTEXITCODE -ne 0 -or -not $restored) {
        throw "No pude obtener $RELATIVE_FILE desde $GOOD_COMMIT"
    }

    $restoredText = ($restored -join "`n") + "`n"
    [IO.File]::WriteAllText($target, $restoredText, (New-Object Text.UTF8Encoding($false)))
    Ok "Archivo completo restaurado"

    Step "Aplicando únicamente el cambio de gráfico opcional"

    $patchPy = @'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# 1. Helper: jamás requerir gráfico.
text, n1 = re.subn(
    r'(?ms)^def template_requires_hydraulic_chart\(template_type: str \| None\) -> bool:\n.*?(?=^def )',
    'def template_requires_hydraulic_chart(template_type: str | None) -> bool:\n'
    '    # Regla global SIP: ningún certificado exige gráfico/carta hidráulica.\n'
    '    return False\n\n\n',
    text,
    count=1,
)

if n1 != 1:
    raise SystemExit("No pude parchear template_requires_hydraulic_chart")

# 2. apply_client_requirements: reemplazar SOLO la lógica del gráfico por false.
m = re.search(
    r'(?ms)^def apply_client_requirements\(data: dict\):\n.*?(?=^def )',
    text
)
if not m:
    raise SystemExit("No encontré apply_client_requirements")

block = m.group(0)

# Quitar lógica que fuerza gráfico por plantilla.
block = re.sub(
    r'(?ms)\n    # El gráfico/carta hidráulica se fuerza.*?'
    r'(?=\n    req = get_client_template_requirement)',
    '\n    # El gráfico/carta hidráulica nunca es obligatorio.\n'
    '    data["requires_hydraulic_chart"] = False\n',
    block,
    count=1,
)

# Quitar regla por cliente que vuelve a poner True.
block = re.sub(
    r'\n        if req\.get\("requires_hydraulic_chart"\):\n'
    r'            data\["requires_hydraulic_chart"\] = True',
    '',
    block,
    count=1,
)

# Red de seguridad justo antes de return.
block = re.sub(
    r'\n    return data\n',
    '\n    data["requires_hydraulic_chart"] = False\n'
    '    return data\n',
    block,
    count=1,
)

text = text[:m.start()] + block + text[m.end():]

# 3. validate_certificate_before_approval:
# quitar EXCLUSIVAMENTE el bloque de validación del gráfico.
m = re.search(
    r'(?ms)^def validate_certificate_before_approval\(cert_id: str, cert: dict\):\n.*?(?=^def )',
    text
)
if not m:
    raise SystemExit("No encontré validate_certificate_before_approval")

block = m.group(0)

chart_block = re.compile(
    r'\n    if cert\.get\("requires_hydraulic_chart"\) or template_type in \("relief_valve_set", "hydrostatic_line"\):\n'
    r'        chart = _get_hydraulic_chart_row\(cert_id\)\n'
    r'        if not chart:\n'
    r'            raise HTTPException\(status_code=400, detail="Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar\."\)\n'
)

block, n3 = chart_block.subn(
    '\n    # Gráfico/carta hidráulica: opcional, no bloquea aprobación.\n',
    block,
    count=1,
)

if n3 != 1:
    raise SystemExit("No pude quitar el bloqueo exacto del gráfico")

text = text[:m.start()] + block + text[m.end():]

# Verificaciones estructurales.
required_functions = [
    "certificate_detail",
    "validate_certificate_before_approval",
    "create_certificate",
    "update_certificate",
]
for fn in required_functions:
    if not re.search(rf'(?m)^def {fn}\(', text):
        raise SystemExit(f"Falta función crítica: {fn}")

if "Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar." in text:
    raise SystemExit("El mensaje de bloqueo todavía quedó activo")

path.write_text(text, encoding="utf-8")
print("PATCH_OK")
'@

    $temp = Join-Path $env:TEMP "sip_v9_patch.py"
    [IO.File]::WriteAllText($temp, $patchPy, (New-Object Text.UTF8Encoding($false)))

    & python $temp $target
    if ($LASTEXITCODE -ne 0) {
        throw "Falló el parche mínimo V9"
    }
    Ok "Gráfico hidráulico quedó opcional"

    Step "Verificando sintaxis"
    & python -m py_compile $target
    if ($LASTEXITCODE -ne 0) {
        throw "Error de sintaxis en certificate_service.py"
    }
    Ok "py_compile correcto"

    Step "Verificando imports reales del backend"
    Push-Location (Join-Path $root "back")
    try {
        & python -c "from app.services.certificate_service import certificate_detail, validate_certificate_before_approval; from app.services.pdf_service import generate_certificate_pdf; print('IMPORT_OK')"
        if ($LASTEXITCODE -ne 0) {
            throw "Los imports del backend todavía fallan"
        }
    } finally {
        Pop-Location
    }
    Ok "certificate_detail + pdf_service importan correctamente"

    Step "Comprobando tamaño del archivo"
    $lines = (Get-Content $target).Count
    Write-Host "   Líneas: $lines" -ForegroundColor White
    if ($lines -lt 400) {
        throw "El archivo quedó sospechosamente corto ($lines líneas). No continúes."
    }
    Ok "Archivo completo"

    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host " SIP RECUPERACION DEFINITIVA V9 CORRECTA" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ahora subí SOLO este arreglo:" -ForegroundColor Cyan
    Write-Host "  git add back/app/services/certificate_service.py" -ForegroundColor White
    Write-Host "  git commit -m `"fix: restaurar certificate service y quitar grafico obligatorio`"" -ForegroundColor White
    Write-Host "  git push" -ForegroundColor White
}
finally {
    Pop-Location
}
