param(
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok([string]$m) { Write-Host "   [OK] $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "   [AVISO] $m" -ForegroundColor Yellow }

function Resolve-Root([string]$Requested) {
    $c = @()
    if ($Requested) { $c += $Requested }
    $c += (Get-Location).Path
    $c += (Split-Path -Parent $PSScriptRoot)
    foreach ($x in $c) {
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
    throw "No encontré la raíz de SIP."
}

function Backup([string]$Path,[string]$BackupRoot,[string]$Root) {
    $rel = $Path.Substring($Root.Length).TrimStart('\','/')
    $dst = Join-Path $BackupRoot $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
    Copy-Item $Path $dst -Force
}

function ReadText([string]$Path) {
    return [IO.File]::ReadAllText($Path)
}
function WriteText([string]$Path,[string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}
function RegexReplaceOnce([string]$Text,[string]$Pattern,[string]$Replacement,[string]$Label) {
    $rx = New-Object Text.RegularExpressions.Regex($Pattern, [Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $rx.IsMatch($Text)) {
        Warn "$Label: no encontré el bloque exacto; sigo porque puede estar ya modificado."
        return $Text
    }
    Ok $Label
    return $rx.Replace($Text, $Replacement, 1)
}

$root = Resolve-Root $ProjectRoot
Step "Proyecto detectado: $root"

$back   = "$root\back\app\services\certificate_service.py"
$pdf    = "$root\back\app\services\pdf_service.py"
$form   = "$root\front\src\components\certificates\CertificateFormModal.tsx"
$detail = "$root\front\src\components\certificates\CertificateDetailModal.tsx"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = "$root\_backup_fix_sin_graficos_v2_$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Step "Backup"
foreach ($f in @($back,$pdf,$form,$detail)) {
    if (Test-Path $f) { Backup $f $backupRoot $root }
}
Ok "Backup creado en $backupRoot"

# ---------------- BACKEND ----------------
Step "Backend"

$t = ReadText $back

# 1) Reemplazar función completa template_requires_hydraulic_chart, sin importar su implementación actual.
$t2 = RegexReplaceOnce $t '(?m)^def template_requires_hydraulic_chart\(.*?\):\s*\r?\n(?:(?:    |\t).*\r?\n)+?(?=^def |\Z)' @'
def template_requires_hydraulic_chart(template_type: str | None) -> bool:
    # Regla global SIP: ningún certificado exige gráfico/carta hidráulica.
    return False


'@ 'template_requires_hydraulic_chart => False'
$t = $t2

# 2) Forzar false antes de return data dentro de apply_client_requirements.
$rxApply = New-Object Text.RegularExpressions.Regex('(?ms)(^def apply_client_requirements\(data: dict\):.*?)(^    return data\s*$)')
$m = $rxApply.Match($t)
if ($m.Success) {
    $body = $m.Groups[1].Value
    if ($body -notmatch 'REGLA GLOBAL SIN GRAFICOS') {
        $newBlock = $body + @'
    # REGLA GLOBAL SIN GRAFICOS:
    # prevalece sobre plantillas, clientes y configuraciones históricas.
    data["requires_hydraulic_chart"] = False

'@ + $m.Groups[2].Value
        $t = $t.Substring(0,$m.Index) + $newBlock + $t.Substring($m.Index + $m.Length)
        Ok "apply_client_requirements fuerza requires_hydraulic_chart=False"
    } else {
        Ok "apply_client_requirements ya estaba forzado a false"
    }
} else {
    throw "No pude localizar apply_client_requirements en certificate_service.py"
}

# 3) Eliminar validación de aprobación del gráfico de forma flexible.
$patterns = @(
    '(?ms)^\s{4}if cert\.get\("requires_hydraulic_chart"\).*?raise HTTPException\(status_code=400,\s*detail=.*?gr[aá]fico.*?\)\s*\r?\n',
    '(?ms)^\s{4}if .*?template_type.*?relief_valve_set.*?hydrostatic_line.*?:\s*\r?\n\s{8}chart\s*=.*?\r?\n\s{8}if not chart:\s*\r?\n\s{12}raise HTTPException\(.*?\)\s*\r?\n'
)
$removed = $false
foreach ($p in $patterns) {
    $rx = New-Object Text.RegularExpressions.Regex($p,[Text.RegularExpressions.RegexOptions]::Singleline -bor [Text.RegularExpressions.RegexOptions]::Multiline)
    if ($rx.IsMatch($t)) {
        $t = $rx.Replace($t, "    # Gráfico hidráulico: no requerido para aprobación.`r`n", 1)
        $removed = $true
        break
    }
}
if ($removed) { Ok "bloqueo de aprobación por gráfico eliminado" }
else { Warn "no encontré bloqueo de aprobación; posiblemente ya estaba eliminado" }

WriteText $back $t

# ---------------- PDF ----------------
Step "PDF"

$t = ReadText $pdf
if ($t -notmatch 'COMPATIBILIDAD SIN GRAFICOS') {
    $rx = New-Object Text.RegularExpressions.Regex('(?m)^(\s{4}cert\s*=\s*detail\["certificate"\]\s*)$')
    if ($rx.IsMatch($t)) {
        $t = $rx.Replace($t, '$1' + "`r`n" + @'
    # COMPATIBILIDAD SIN GRAFICOS:
    # certificados históricos también se generan sin ANEXO A.
    cert["requires_hydraulic_chart"] = False
'@, 1)
        Ok "PDF fuerza requires_hydraulic_chart=False"
    } else {
        Warn "no encontré asignación cert = detail[...] en PDF"
    }
} else { Ok "PDF ya estaba parcheado" }
WriteText $pdf $t

# ---------------- FRONT FORM ----------------
Step "Frontend - formulario"

$t = ReadText $form

# payload siempre false
$t = [regex]::Replace(
    $t,
    'requires_hydraulic_chart:\s*effectiveRequiresHydraulicChart\([^,\r\n]*,\s*Boolean\(form\.requires_hydraulic_chart\)\)',
    'requires_hydraulic_chart: false'
)
$t = [regex]::Replace(
    $t,
    'requires_hydraulic_chart:\s*templateForcesHydraulicChart\(templateCode\)\s*\|\|\s*\(templateCode\s*===\s*"general_pressure"\s*\?\s*Boolean\(form\.requires_hydraulic_chart\)\s*:\s*false\)',
    'requires_hydraulic_chart: false'
)

# convertir funciones a false, sin depender de contenido
$t = RegexReplaceOnce $t '(?m)^  function templateForcesHydraulicChart\(.*?\) \{.*?^  \}\s*' @'
  function templateForcesHydraulicChart(_templateCode: string) {
    return false;
  }

'@ 'templateForcesHydraulicChart => false'

$t = RegexReplaceOnce $t '(?m)^  function effectiveRequiresHydraulicChart\(.*?\) \{.*?^  \}\s*' @'
  function effectiveRequiresHydraulicChart(
    _templateCode = String(form.template_type || "general_pressure"),
    _manualValue = Boolean(form.requires_hydraulic_chart)
  ) {
    return false;
  }

'@ 'effectiveRequiresHydraulicChart => false'

# quitar campo visual del formulario
$rxField = New-Object Text.RegularExpressions.Regex('\s*<Field label="Gráfico / carta hidráulica">.*?</Field>', [Text.RegularExpressions.RegexOptions]::Singleline)
if ($rxField.IsMatch($t)) {
    $t = $rxField.Replace($t, "", 1)
    Ok "campo Gráfico / carta hidráulica eliminado"
} else { Warn "campo gráfico no encontrado; puede estar ya eliminado" }

# quitar mensajes textuales que dicen que requiere gráfico
$t = $t.Replace(' y gráfico/carta de prueba.', '.')
$t = $t.Replace(' y gráfico/carta de presión vs tiempo.', '.')
$t = $t.Replace('Esta plantilla requiere gráfico/carta de prueba hidráulica antes de aprobar.', '')
$t = $t.Replace('Este certificado se emitirá con ANEXO A: gráfico/carta de prueba hidráulica como adjunto técnico obligatorio.', '')

WriteText $form $t

# ---------------- FRONT DETAIL ----------------
Step "Frontend - detalle"

$t = ReadText $detail

# requisito siempre false
$t = [regex]::Replace(
    $t,
    'const requiresHydraulicChart\s*=\s*Boolean\([^;]+;',
    'const requiresHydraulicChart = false;'
)

# quitar tarjeta de Adjuntos técnicos, usando el título como ancla
$rxAdj = New-Object Text.RegularExpressions.Regex(
    '\s*<section className="rounded-2xl border border-slate-200 p-5">\s*<h4 className="font-bold text-slate-950">Adjuntos técnicos</h4>.*?</section>',
    [Text.RegularExpressions.RegexOptions]::Singleline
)
if ($rxAdj.IsMatch($t)) {
    $t = $rxAdj.Replace($t, "", 1)
    Ok "tarjeta Adjuntos técnicos eliminada"
} else { Warn "tarjeta Adjuntos técnicos no encontrada; puede estar ya eliminada" }

# texto de requisito técnico no debe decir obligatorio
$t = $t.Replace('value={requiresHydraulicChart ? "Obligatorio para aprobar" : "No obligatorio"}', 'value="No obligatorio"')
$t = $t.Replace('{requiresHydraulicChart ? "Pendiente: esta plantilla requiere gráfico/carta de prueba hidráulica." : "Sin gráfico de prueba hidráulica cargado."}', '"Sin gráfico requerido."')

WriteText $detail $t

# ---------------- VERIFICACION ----------------
Step "Verificación"

$errors = @()

$b = ReadText $back
$f = ReadText $form
$d = ReadText $detail
$p = ReadText $pdf

if ($b -notmatch 'data\["requires_hydraulic_chart"\]\s*=\s*False') {
    $errors += "Backend no quedó forzado a False."
}
if ($f -match '<Field label="Gráfico / carta hidráulica">') {
    $errors += "El formulario todavía muestra el campo de gráfico."
}
if ($d -match '>Adjuntos técnicos</h4>') {
    $errors += "El detalle todavía muestra Adjuntos técnicos."
}
if ($p -notmatch 'cert\["requires_hydraulic_chart"\]\s*=\s*False') {
    $errors += "PDF no quedó protegido para certificados históricos."
}

# chequeos sintácticos básicos si existen herramientas
if (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m py_compile $back $pdf
    if ($LASTEXITCODE -ne 0) { $errors += "Python detectó error de sintaxis en backend." }
    else { Ok "Python backend: sintaxis correcta" }
}

if ($errors.Count -gt 0) {
    Write-Host "`nFIX INCOMPLETO:" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host " - $e" -ForegroundColor Red }
    Write-Host "`nBackup: $backupRoot" -ForegroundColor Yellow
    exit 2
}

Write-Host "`n===============================================" -ForegroundColor Green
Write-Host " FIX SIN GRAFICOS V2 APLICADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Ningún certificado debería exigir gráfico para:" -ForegroundColor White
Write-Host " - crear" -ForegroundColor White
Write-Host " - editar" -ForegroundColor White
Write-Host " - enviar a aprobación" -ForegroundColor White
Write-Host " - aprobar" -ForegroundColor White
Write-Host " - generar PDF" -ForegroundColor White
Write-Host "`nBackup: $backupRoot" -ForegroundColor DarkGray
Write-Host "`nRevisá ahora con: git diff" -ForegroundColor Cyan
