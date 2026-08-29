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

        if ((Test-Path "$p\back\app\services\certificate_service.py") -and
            (Test-Path "$p\front\src\components\certificates\CertificateFormModal.tsx")) {
            return $p
        }

        $parent = Split-Path -Parent $p
        if ($parent -and
            (Test-Path "$parent\back\app\services\certificate_service.py") -and
            (Test-Path "$parent\front\src\components\certificates\CertificateFormModal.tsx")) {
            return $parent
        }
    }

    throw "No encontré la raíz del proyecto SIP."
}

function ReadText([string]$Path) {
    return [IO.File]::ReadAllText($Path)
}

function WriteText([string]$Path,[string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Backup([string]$Path,[string]$BackupRoot,[string]$Root) {
    if (-not (Test-Path $Path)) { return }
    $rel = $Path.Substring($Root.Length).TrimStart('\','/')
    $dst = Join-Path $BackupRoot $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
    Copy-Item $Path $dst -Force
}

$root = Resolve-Root $ProjectRoot
Step "Proyecto detectado: $root"

$back   = "$root\back\app\services\certificate_service.py"
$pdf    = "$root\back\app\services\pdf_service.py"
$form   = "$root\front\src\components\certificates\CertificateFormModal.tsx"
$detail = "$root\front\src\components\certificates\CertificateDetailModal.tsx"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = "$root\_backup_fix_sin_graficos_v4_$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Step "Backup"
foreach ($f in @($back,$pdf,$form,$detail)) {
    Backup $f $backupRoot $root
}
Ok "Backup creado: $backupRoot"

# =========================================================
# BACKEND
# =========================================================
Step "Backend - neutralizando cualquier requisito de gráfico"

$t = ReadText $back

# 1. Si existe la función, dejarla siempre False.
$rx = New-Object Text.RegularExpressions.Regex(
    '(?ms)^def template_requires_hydraulic_chart\(.*?\):\s*\r?\n(?:(?:    |\t).*\r?\n)+?(?=^def |\Z)'
)
if ($rx.IsMatch($t)) {
    $t = $rx.Replace($t, @'
def template_requires_hydraulic_chart(template_type: str | None) -> bool:
    # Regla global SIP: ningún certificado exige gráfico/carta hidráulica.
    return False


'@, 1)
    Ok "template_requires_hydraulic_chart => False"
} else {
    Warn "template_requires_hydraulic_chart no encontrada; continúo"
}

# 2. Cambiar asignaciones explícitas comunes a False.
$original = $t

# data["requires_hydraulic_chart"] = ...
$t = [regex]::Replace(
    $t,
    '(?m)^(\s*)data\["requires_hydraulic_chart"\]\s*=\s*.+$',
    '$1data["requires_hydraulic_chart"] = False'
)

# data['requires_hydraulic_chart'] = ...
$t = [regex]::Replace(
    $t,
    "(?m)^(\s*)data\['requires_hydraulic_chart'\]\s*=\s*.+$",
    '$1data["requires_hydraulic_chart"] = False'
)

# payload / dict style in backend
$t = [regex]::Replace(
    $t,
    '(?m)^(\s*)"requires_hydraulic_chart"\s*:\s*.+,?\s*$',
    '$1"requires_hydraulic_chart": False,'
)

if ($t -ne $original) {
    Ok "asignaciones requires_hydraulic_chart forzadas a False"
} else {
    Warn "no encontré asignaciones backend para cambiar"
}

# 3. Eliminar bloques que bloquean aprobación por gráfico.
$patterns = @(
    '(?ms)^\s{4}if\s+cert\.get\(["'']requires_hydraulic_chart["'']\).*?(?=^\s{4}(?:if|elif|return|[a-zA-Z_])|\Z)',
    '(?ms)^\s{4}if\s+.*?relief_valve_set.*?hydrostatic_line.*?:\s*\r?\n\s{8}chart\s*=.*?\r?\n\s{8}if not chart:\s*\r?\n\s{12}raise HTTPException\(.*?\)\s*\r?\n'
)

$removed = $false
foreach ($pat in $patterns) {
    $r = New-Object Text.RegularExpressions.Regex(
        $pat,
        [Text.RegularExpressions.RegexOptions]::Singleline -bor [Text.RegularExpressions.RegexOptions]::Multiline
    )
    if ($r.IsMatch($t)) {
        $t = $r.Replace($t, "    # Gráfico hidráulico no requerido para aprobación.`r`n", 1)
        $removed = $true
    }
}

if ($removed) {
    Ok "validación de aprobación por gráfico eliminada"
} else {
    Warn "no encontré bloqueo explícito de aprobación; puede estar ya eliminado"
}

# 4. Como red de seguridad, antes de cada 'return data' de cualquier función,
#    si existe data dict en esa función, no insertamos nada para evitar romper scope.
#    En cambio agregamos normalización dentro de create/update si encontramos patrones:
$t = [regex]::Replace(
    $t,
    '(?m)^(\s*)(payload|data)\.setdefault\(["'']requires_hydraulic_chart["''].*$',
    '$1$2["requires_hydraulic_chart"] = False'
)

WriteText $back $t

# =========================================================
# PDF
# =========================================================
Step "PDF - sin ANEXO A"

$t = ReadText $pdf

if ($t -notmatch 'SIN GRAFICOS V4') {
    $rxCert = New-Object Text.RegularExpressions.Regex(
        '(?m)^(\s{4}cert\s*=\s*detail\["certificate"\]\s*)$'
    )
    if ($rxCert.IsMatch($t)) {
        $t = $rxCert.Replace($t, '$1' + "`r`n" + @'
    # SIN GRAFICOS V4:
    # incluso certificados viejos se generan sin anexo hidráulico.
    cert["requires_hydraulic_chart"] = False
'@, 1)
        Ok "PDF fuerza requires_hydraulic_chart=False"
    } else {
        Warn "no encontré cert = detail[`"certificate`"]; continúo"
    }
} else {
    Ok "PDF ya estaba parcheado"
}

WriteText $pdf $t

# =========================================================
# FRONT FORM
# =========================================================
Step "Frontend formulario"

$t = ReadText $form

# Siempre false en cualquier objeto/payload.
$before = $t

$t = [regex]::Replace(
    $t,
    'requires_hydraulic_chart\s*:\s*[^,\r\n}]+',
    'requires_hydraulic_chart: false'
)

# Función de fuerza de gráfico.
$rxForce = New-Object Text.RegularExpressions.Regex(
    '(?ms)^  function templateForcesHydraulicChart\(.*?\)\s*\{.*?^  \}\s*'
)
if ($rxForce.IsMatch($t)) {
    $t = $rxForce.Replace($t, @'
  function templateForcesHydraulicChart(_templateCode: string) {
    return false;
  }

'@, 1)
    Ok "templateForcesHydraulicChart => false"
}

# Función effective
$rxEffective = New-Object Text.RegularExpressions.Regex(
    '(?ms)^  function effectiveRequiresHydraulicChart\(.*?\)\s*\{.*?^  \}\s*'
)
if ($rxEffective.IsMatch($t)) {
    $t = $rxEffective.Replace($t, @'
  function effectiveRequiresHydraulicChart(
    _templateCode = String(form.template_type || "general_pressure"),
    _manualValue = Boolean(form.requires_hydraulic_chart)
  ) {
    return false;
  }

'@, 1)
    Ok "effectiveRequiresHydraulicChart => false"
}

# Campo visual.
$rxField = New-Object Text.RegularExpressions.Regex(
    '\s*<Field label="Gráfico / carta hidráulica">.*?</Field>',
    [Text.RegularExpressions.RegexOptions]::Singleline
)
if ($rxField.IsMatch($t)) {
    $t = $rxField.Replace($t, "", 1)
    Ok "campo gráfico eliminado del formulario"
} else {
    Warn "campo gráfico no encontrado; puede estar ya eliminado"
}

# Mensajes.
$t = $t.Replace('Esta plantilla requiere gráfico/carta de prueba hidráulica antes de aprobar.', '')
$t = $t.Replace('Este certificado se emitirá con ANEXO A: gráfico/carta de prueba hidráulica como adjunto técnico obligatorio.', '')
$t = $t.Replace(' y gráfico/carta de prueba.', '.')
$t = $t.Replace(' y gráfico/carta de presión vs tiempo.', '.')

if ($t -ne $before) {
    Ok "formulario actualizado"
}

WriteText $form $t

# =========================================================
# FRONT DETAIL
# =========================================================
Step "Frontend detalle"

$t = ReadText $detail

$t = [regex]::Replace(
    $t,
    'const requiresHydraulicChart\s*=\s*[^;]+;',
    'const requiresHydraulicChart = false;'
)

$rxAdj = New-Object Text.RegularExpressions.Regex(
    '\s*<section className="rounded-2xl border border-slate-200 p-5">\s*<h4 className="font-bold text-slate-950">Adjuntos técnicos</h4>.*?</section>',
    [Text.RegularExpressions.RegexOptions]::Singleline
)

if ($rxAdj.IsMatch($t)) {
    $t = $rxAdj.Replace($t, "", 1)
    Ok "sección Adjuntos técnicos eliminada"
} else {
    Warn "sección Adjuntos técnicos no encontrada; puede estar ya eliminada"
}

$t = $t.Replace(
    'value={requiresHydraulicChart ? "Obligatorio para aprobar" : "No obligatorio"}',
    'value="No obligatorio"'
)

WriteText $detail $t

# =========================================================
# VERIFICACION
# =========================================================
Step "Verificación final"

$errors = @()
$b = ReadText $back
$f = ReadText $form
$d = ReadText $detail
$p = ReadText $pdf

if ($b -match 'requiere adjuntar el gr[aá]fico/carta.*antes de aprobar') {
    $errors += "Todavía aparece un bloqueo textual de aprobación por gráfico en backend."
}

if ($f -match '<Field label="Gráfico / carta hidráulica">') {
    $errors += "El formulario todavía muestra el campo de gráfico."
}

if ($d -match '>Adjuntos técnicos</h4>') {
    $errors += "El detalle todavía muestra la sección Adjuntos técnicos."
}

# Python syntax
if (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m py_compile $back $pdf
    if ($LASTEXITCODE -ne 0) {
        $errors += "Python detectó un error de sintaxis."
    } else {
        Ok "backend Python compila"
    }
}

# TypeScript no se compila aquí porque podría requerir node_modules;
# pero chequeamos que no haya quedado el campo visual.
if ($errors.Count -gt 0) {
    Write-Host "`nFIX INCOMPLETO:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host " - $e" -ForegroundColor Red
    }
    Write-Host "`nBackup: $backupRoot" -ForegroundColor Yellow
    exit 2
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " SIP FIX SIN GRAFICOS V4 APLICADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "El gráfico/carta hidráulica queda NO requerido para:" -ForegroundColor White
Write-Host " - creación" -ForegroundColor White
Write-Host " - edición" -ForegroundColor White
Write-Host " - envío a aprobación" -ForegroundColor White
Write-Host " - aprobación" -ForegroundColor White
Write-Host " - generación del PDF" -ForegroundColor White
Write-Host ""
Write-Host "Backup: $backupRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Ahora ejecutá: git diff" -ForegroundColor Cyan
