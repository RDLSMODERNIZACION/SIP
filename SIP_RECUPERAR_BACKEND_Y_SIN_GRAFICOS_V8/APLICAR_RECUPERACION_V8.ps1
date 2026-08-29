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
        if (Test-Path "$p\back\app\services\certificate_service.py") {
            return $p
        }

        $parent = Split-Path -Parent $p
        if ($parent -and (Test-Path "$parent\back\app\services\certificate_service.py")) {
            return $parent
        }
    }
    throw "No encontré la raíz de SIP."
}

$root = Resolve-Root $ProjectRoot
$target = Join-Path $root "back\app\services\certificate_service.py"

Step "Proyecto detectado: $root"

# Buscar backups previos al parche destructivo.
# Priorizamos V4 porque el usuario confirmó que existe y fue creado antes de que V4 modificara el archivo.
$backupCandidates = @()

$preferred = Get-ChildItem $root -Directory -Filter "_backup_fix_sin_graficos_v4_*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending

foreach ($dir in $preferred) {
    $candidate = Join-Path $dir.FullName "back\app\services\certificate_service.py"
    if (Test-Path $candidate) { $backupCandidates += $candidate }
}

# Como fallback, backups anteriores.
foreach ($pattern in @("_backup_fix_sin_graficos_v2_*","_backup_fix_sin_graficos_*")) {
    $dirs = Get-ChildItem $root -Directory -Filter $pattern -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending
    foreach ($dir in $dirs) {
        $candidate = Join-Path $dir.FullName "back\app\services\certificate_service.py"
        if ((Test-Path $candidate) -and -not ($backupCandidates -contains $candidate)) {
            $backupCandidates += $candidate
        }
    }
}

if ($backupCandidates.Count -eq 0) {
    throw "No encontré ningún backup de certificate_service.py para restaurar."
}

$source = $null
foreach ($candidate in $backupCandidates) {
    $txt = [IO.File]::ReadAllText($candidate)
    if ($txt -match '(?m)^def certificate_detail\(' -and
        $txt -match '(?m)^def validate_certificate_before_approval\(') {
        $source = $candidate
        break
    }
}

if (-not $source) {
    throw "Encontré backups, pero ninguno contiene certificate_detail y validate_certificate_before_approval."
}

Step "Restaurando certificate_service.py desde backup sano"
Write-Host "   Fuente: $source" -ForegroundColor White

# Backup del estado actual roto
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$brokenBackup = "$target.roto_antes_v8_$stamp"
Copy-Item $target $brokenBackup -Force
Ok "Guardé copia del archivo actual roto en $brokenBackup"

Copy-Item $source $target -Force
Ok "certificate_service.py restaurado"

# Parche mínimo con Python embebido para no usar regex destructiva.
Step "Aplicando cambio mínimo: gráfico nunca obligatorio"

$patchPy = @'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")

# 1) Helper siempre False, reemplazando sólo su cuerpo hasta la próxima función.
m = re.search(
    r'(?ms)^def template_requires_hydraulic_chart\(.*?\):\s*\n(?P<body>(?:[ \t]+.*\n)+?)(?=^def |\Z)',
    text
)
if m:
    replacement = (
        'def template_requires_hydraulic_chart(template_type: str | None) -> bool:\n'
        '    # Regla global SIP: el gráfico/carta hidráulica nunca es obligatorio.\n'
        '    return False\n\n\n'
    )
    text = text[:m.start()] + replacement + text[m.end():]

# 2) Dentro de apply_client_requirements, si existe, forzar False justo antes de return data.
m = re.search(
    r'(?ms)^def apply_client_requirements\(data: dict\):\n(?P<body>.*?)(?=^def |\Z)',
    text
)
if m:
    block = m.group(0)
    block2 = re.sub(
        r'(?m)^([ \t]+)return data\s*$',
        r'\1data["requires_hydraulic_chart"] = False\n\1return data',
        block,
        count=1
    )
    text = text[:m.start()] + block2 + text[m.end():]

# 3) Quitar SOLAMENTE el bloqueo del gráfico dentro de validate_certificate_before_approval.
m = re.search(
    r'(?ms)^def validate_certificate_before_approval\(cert_id: str, cert: dict\):\n(?P<body>.*?)(?=^def |\Z)',
    text
)
if not m:
    raise SystemExit("No encontré validate_certificate_before_approval")

block = m.group(0)

# Remover bloque típico:
# if cert.get("requires_hydraulic_chart") or template_type in (...):
#     chart = ...
#     if not chart:
#         raise HTTPException(...)
pattern = re.compile(
    r'(?ms)^[ \t]{4}if[^\n]*(?:requires_hydraulic_chart|relief_valve_set|hydrostatic_line)[^\n]*:\n'
    r'(?:^[ \t]{8}.*\n)+?'
    r'(?=^[ \t]{4}(?:if|elif|return|[A-Za-z_])|\Z)'
)
block2 = pattern.sub('    # Gráfico/carta hidráulica: no requerido para aprobación.\n\n', block, count=1)

# Si el bloque anterior no coincidió, eliminar sólo el raise con el mensaje exacto y
# dejar el if con pass para preservar sintaxis.
msg = "Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar."
if msg in block2:
    lines = block2.splitlines()
    out = []
    skip_next = False
    for i, line in enumerate(lines):
        if msg in line and "raise HTTPException" in line:
            indent = line[:len(line)-len(line.lstrip())]
            out.append(indent + "pass  # gráfico hidráulico no requerido")
        else:
            out.append(line)
    block2 = "\n".join(out) + ("\n" if block2.endswith("\n") else "")

text = text[:m.start()] + block2 + text[m.end():]

# Verificaciones antes de escribir.
if not re.search(r'(?m)^def certificate_detail\(', text):
    raise SystemExit("ERROR: certificate_detail desapareció; no escribo cambios.")
if not re.search(r'(?m)^def validate_certificate_before_approval\(', text):
    raise SystemExit("ERROR: validate_certificate_before_approval desapareció; no escribo cambios.")

path.write_text(text, encoding="utf-8")
print("PATCH_OK")
'@

$tempPy = Join-Path $env:TEMP "sip_patch_v8.py"
[IO.File]::WriteAllText($tempPy, $patchPy, (New-Object Text.UTF8Encoding($false)))

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python no está disponible en PATH. Es necesario para aplicar el parche seguro."
}

& python $tempPy $target
if ($LASTEXITCODE -ne 0) {
    throw "Falló el parche seguro de certificate_service.py"
}
Ok "Parche mínimo aplicado"

Step "Verificando funciones críticas"

$content = [IO.File]::ReadAllText($target)

if ($content -notmatch '(?m)^def certificate_detail\(') {
    throw "certificate_detail NO está presente después de restaurar."
}
Ok "certificate_detail existe"

if ($content -notmatch '(?m)^def validate_certificate_before_approval\(') {
    throw "validate_certificate_before_approval NO está presente."
}
Ok "validate_certificate_before_approval existe"

if ($content -match 'Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar\.') {
    Warn "El texto todavía existe en el archivo, aunque podría estar inactivo."
} else {
    Ok "Mensaje de bloqueo eliminado"
}

Step "Compilando backend"
& python -m py_compile $target
if ($LASTEXITCODE -ne 0) {
    throw "certificate_service.py tiene error de sintaxis."
}
Ok "certificate_service.py compila"

# Probar import real desde la carpeta back.
Push-Location (Join-Path $root "back")
try {
    & python -c "from app.services.certificate_service import certificate_detail, validate_certificate_before_approval; print('IMPORT_OK')"
    if ($LASTEXITCODE -ne 0) {
        throw "El import real del backend todavía falla."
    }
    Ok "Import real certificate_detail: correcto"
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " SIP V8: BACKEND RECUPERADO Y GRAFICO NO OBLIGATORIO" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecutá:" -ForegroundColor Cyan
Write-Host "  git diff -- back/app/services/certificate_service.py" -ForegroundColor White
Write-Host "  git add ." -ForegroundColor White
Write-Host "  git commit -m `"fix: recuperar backend y eliminar requisito de grafico`"" -ForegroundColor White
Write-Host "  git push" -ForegroundColor White
