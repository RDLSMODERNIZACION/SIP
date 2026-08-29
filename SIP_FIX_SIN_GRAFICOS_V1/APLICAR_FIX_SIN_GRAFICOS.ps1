param(
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Resolve-ProjectRoot {
    param([string]$Requested)

    $candidates = @()
    if ($Requested) { $candidates += (Resolve-Path $Requested -ErrorAction SilentlyContinue) }
    $candidates += (Get-Location).Path
    $candidates += (Split-Path -Parent $PSScriptRoot)

    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $root = [string]$candidate
        if ((Test-Path (Join-Path $root "back\app\services\certificate_service.py")) -and
            (Test-Path (Join-Path $root "front\src\components\certificates\CertificateFormModal.tsx"))) {
            return $root
        }

        # Si el ZIP se descomprimió dentro del proyecto.
        $parent = Split-Path -Parent $root
        if ($parent -and
            (Test-Path (Join-Path $parent "back\app\services\certificate_service.py")) -and
            (Test-Path (Join-Path $parent "front\src\components\certificates\CertificateFormModal.tsx"))) {
            return $parent
        }
    }

    throw "No encontré la raíz del proyecto SIP. Ejecutá este script desde la carpeta raíz de SIP o usá: .\APLICAR_FIX_SIN_GRAFICOS.ps1 -ProjectRoot 'C:\ruta\SIP'"
}

function Backup-File {
    param([string]$Path, [string]$BackupRoot, [string]$Root)
    $relative = $Path.Substring($Root.Length).TrimStart('\','/')
    $dest = Join-Path $BackupRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
    Copy-Item $Path $dest -Force
}

function Replace-Literal {
    param(
        [string]$Path,
        [string]$Old,
        [string]$New,
        [string]$Description,
        [switch]$Optional
    )
    $content = Get-Content -Raw -Encoding UTF8 $Path
    if (-not $content.Contains($Old)) {
        if ($Optional) {
            Write-Host "   [omitido] $Description (ya aplicado o bloque distinto)" -ForegroundColor DarkYellow
            return $false
        }
        throw "No encontré el bloque esperado para: $Description`nArchivo: $Path"
    }
    $content = $content.Replace($Old, $New)
    Set-Content -Path $Path -Value $content -Encoding UTF8
    Write-Host "   [OK] $Description" -ForegroundColor Green
    return $true
}

$root = Resolve-ProjectRoot -Requested $ProjectRoot
Write-Step "Proyecto detectado: $root"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = Join-Path $root "_backup_fix_sin_graficos_$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$files = @(
    (Join-Path $root "back\app\services\certificate_service.py"),
    (Join-Path $root "back\app\services\pdf_service.py"),
    (Join-Path $root "front\src\components\certificates\CertificateFormModal.tsx"),
    (Join-Path $root "front\src\components\certificates\CertificateDetailModal.tsx")
)

Write-Step "Creando backup"
foreach ($file in $files) {
    Backup-File -Path $file -BackupRoot $backupRoot -Root $root
}
Write-Host "   Backup: $backupRoot" -ForegroundColor Green

$back = Join-Path $root "back\app\services\certificate_service.py"
$pdf  = Join-Path $root "back\app\services\pdf_service.py"
$form = Join-Path $root "front\src\components\certificates\CertificateFormModal.tsx"
$detail = Join-Path $root "front\src\components\certificates\CertificateDetailModal.tsx"

Write-Step "Backend: desactivando requisito de gráfico"

Replace-Literal -Path $back -Description "template_requires_hydraulic_chart siempre falso" -Old @'
def template_requires_hydraulic_chart(template_type: str | None) -> bool:
    code = template_type or "general_pressure"
    if code in ("relief_valve_set", "hydrostatic_line"):
        return True
    template = fetch_one("select requires_hydraulic_chart from certificate_templates where code=%s", [code])
    return bool(template and template.get("requires_hydraulic_chart"))
'@ -New @'
def template_requires_hydraulic_chart(template_type: str | None) -> bool:
    # Los gráficos/cartas hidráulicas dejaron de ser requisito en todos los certificados.
    return False
'@

Replace-Literal -Path $back -Description "apply_client_requirements fuerza gráfico=false" -Old @'
    data["md_required"] = is_md_client(client_id)
    # El gráfico/carta hidráulica se fuerza para plantillas técnicas específicas.
    # En ensayo general se permite que el usuario lo marque manualmente para emitir ANEXO A.
    if template_type == "general_pressure":
        data["requires_hydraulic_chart"] = bool(data.get("requires_hydraulic_chart"))
    else:
        data["requires_hydraulic_chart"] = template_requires_hydraulic_chart(template_type)

    req = get_client_template_requirement(client_id, template_type)
    if req:
        data["md_required"] = True
        if req.get("requires_hydraulic_chart"):
            data["requires_hydraulic_chart"] = True
        if req.get("frequency_months"):
            data["test_frequency_months"] = req.get("frequency_months")
'@ -New @'
    data["md_required"] = is_md_client(client_id)
    # Regla global SIP: ningún certificado requiere gráfico/carta hidráulica.
    # Ignoramos tanto la plantilla como reglas históricas por cliente.
    data["requires_hydraulic_chart"] = False

    req = get_client_template_requirement(client_id, template_type)
    if req:
        data["md_required"] = True
        if req.get("frequency_months"):
            data["test_frequency_months"] = req.get("frequency_months")
'@

Replace-Literal -Path $back -Description "aprobación sin validar gráfico" -Old @'
    if cert.get("requires_hydraulic_chart") or template_type in ("relief_valve_set", "hydrostatic_line"):
        chart = _get_hydraulic_chart_row(cert_id)
        if not chart:
            raise HTTPException(status_code=400, detail="Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar.")

'@ -New @'
    # El gráfico/carta hidráulica ya no es requisito de aprobación.

'@

Write-Step "PDF: evitando ANEXO A incluso en certificados históricos"
Replace-Literal -Path $pdf -Description "forzar requires_hydraulic_chart=false al generar PDF" -Old @'
    detail = certificate_detail(cert_id, user)
    cert = detail["certificate"]
    patterns = detail.get("patterns", []) or []
'@ -New @'
    detail = certificate_detail(cert_id, user)
    cert = detail["certificate"]
    # Compatibilidad con certificados históricos: nunca generar ni exigir ANEXO A hidráulico.
    cert["requires_hydraulic_chart"] = False
    patterns = detail.get("patterns", []) or []
'@

Write-Step "Frontend formulario: quitando cualquier pedido de gráfico"

Replace-Literal -Path $form -Description "ayuda de plantillas sin mencionar gráficos" -Old @'
  relief_valve_set: "Válvula relief/PRV: requiere apertura/seteo, cierre, hermeticidad, precinto y gráfico/carta de prueba.",
  hydrostatic_line: "Línea/manguera/brida/conexión: requiere parámetros hidrostáticos y gráfico/carta de presión vs tiempo.",
'@ -New @'
  relief_valve_set: "Válvula relief/PRV: requiere apertura/seteo, cierre, hermeticidad y precinto.",
  hydrostatic_line: "Línea/manguera/brida/conexión: requiere parámetros hidrostáticos del ensayo.",
'@

Replace-Literal -Path $form -Description "funciones de requisito gráfico desactivadas" -Old @'
  function templateForcesHydraulicChart(templateCode: string) {
    const template = templates.find((item) => item.code === templateCode);
    return Boolean(template?.requires_hydraulic_chart || ["relief_valve_set", "hydrostatic_line"].includes(templateCode));
  }

  function effectiveRequiresHydraulicChart(templateCode = String(form.template_type || "general_pressure"), manualValue = Boolean(form.requires_hydraulic_chart)) {
    return templateForcesHydraulicChart(templateCode) || manualValue;
  }

  function getAutomaticRequirementInfo(templateCode = String(form.template_type || "general_pressure")) {
    const chartForced = templateForcesHydraulicChart(templateCode);
    const chartRequired = effectiveRequiresHydraulicChart(templateCode);
    return { chartForced, chartRequired };
  }
'@ -New @'
  function templateForcesHydraulicChart(_templateCode: string) {
    return false;
  }

  function effectiveRequiresHydraulicChart(
    _templateCode = String(form.template_type || "general_pressure"),
    _manualValue = Boolean(form.requires_hydraulic_chart)
  ) {
    return false;
  }

  function getAutomaticRequirementInfo(_templateCode = String(form.template_type || "general_pressure")) {
    return { chartForced: false, chartRequired: false };
  }
'@

Replace-Literal -Path $form -Description "cambio de plantilla mantiene gráfico=false" -Old @'
      requires_hydraulic_chart: templateForcesHydraulicChart(templateCode) || (templateCode === "general_pressure" ? Boolean(form.requires_hydraulic_chart) : false),
'@ -New @'
      requires_hydraulic_chart: false,
'@

Replace-Literal -Path $form -Description "payload siempre envía gráfico=false" -Old @'
        requires_hydraulic_chart: effectiveRequiresHydraulicChart(String(form.template_type || "general_pressure"), Boolean(form.requires_hydraulic_chart)),
'@ -New @'
        requires_hydraulic_chart: false,
'@

$formContent = Get-Content -Raw -Encoding UTF8 $form

# Quitar el campo visual completo "Gráfico / carta hidráulica".
$patternField = '(?s)\s*<Field label="Gráfico / carta hidráulica">.*?</Field>'
$newFormContent = [regex]::Replace($formContent, $patternField, "", 1)
if ($newFormContent -eq $formContent) {
    Write-Host "   [omitido] Campo visual gráfico (ya quitado o cambió el bloque)" -ForegroundColor DarkYellow
} else {
    Set-Content -Path $form -Value $newFormContent -Encoding UTF8
    Write-Host "   [OK] Campo visual gráfico eliminado" -ForegroundColor Green
}

Write-Step "Frontend detalle: ocultando sección y carga de gráfico"

$detailContent = Get-Content -Raw -Encoding UTF8 $detail

# Nunca mostrarlo como requerido aunque haya datos históricos.
$detailContent2 = $detailContent.Replace(
'  const requiresHydraulicChart = Boolean((c as any).requires_hydraulic_chart || HYDRAULIC_REQUIRED_TEMPLATES.has(templateType));',
'  const requiresHydraulicChart = false;'
)
if ($detailContent2 -ne $detailContent) {
    Write-Host "   [OK] Requisito visual desactivado" -ForegroundColor Green
} else {
    Write-Host "   [omitido] Requisito visual (ya aplicado o bloque distinto)" -ForegroundColor DarkYellow
}
$detailContent = $detailContent2

# Quitar toda la tarjeta "Adjuntos técnicos" para que la app no vuelva a pedir subir gráficos.
$adjPattern = '(?s)\s*<section className="rounded-2xl border border-slate-200 p-5">\s*<h4 className="font-bold text-slate-950">Adjuntos técnicos</h4>.*?</section>'
$detailContent2 = [regex]::Replace($detailContent, $adjPattern, "", 1)
if ($detailContent2 -ne $detailContent) {
    Write-Host "   [OK] Sección Adjuntos técnicos eliminada" -ForegroundColor Green
} else {
    Write-Host "   [omitido] Sección Adjuntos técnicos (ya quitada o cambió el bloque)" -ForegroundColor DarkYellow
}
$detailContent = $detailContent2

# Quitar bloque de requisitos técnicos si sólo estaba por plantilla/gráfico.
$reqPattern = '(?s)\s*\{\(mdRequired \|\| requiresHydraulicChart \|\| templateType !== "general_pressure"\) \? \(.*?\) : null\}'
# No lo quitamos completo porque también puede mostrar requisitos MD. Con requiresHydraulicChart=false ya no exige el gráfico.

Set-Content -Path $detail -Value $detailContent -Encoding UTF8

Write-Step "Chequeos rápidos"
$checks = @(
    @{ Path=$back; Bad='requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar'; Label='bloqueo backend' },
    @{ Path=$form; Bad='Field label="Gráfico / carta hidráulica"'; Label='campo formulario' },
    @{ Path=$detail; Bad='<h4 className="font-bold text-slate-950">Adjuntos técnicos</h4>'; Label='sección de carga' }
)

$failed = $false
foreach ($check in $checks) {
    $txt = Get-Content -Raw -Encoding UTF8 $check.Path
    if ($txt.Contains($check.Bad)) {
        Write-Host "   [FALTA] $($check.Label)" -ForegroundColor Red
        $failed = $true
    } else {
        Write-Host "   [OK] $($check.Label)" -ForegroundColor Green
    }
}

Write-Host ""
if ($failed) {
    Write-Host "El parche se aplicó parcialmente. Revisá los mensajes anteriores. Backup disponible en:" -ForegroundColor Yellow
    Write-Host $backupRoot -ForegroundColor Yellow
    exit 2
}

Write-Host "FIX APLICADO CORRECTAMENTE." -ForegroundColor Green
Write-Host "Desde ahora ningún certificado debe pedir gráfico/carta hidráulica para crear, editar, aprobar o generar PDF." -ForegroundColor Green
Write-Host "Backup: $backupRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Siguiente paso recomendado:" -ForegroundColor Cyan
Write-Host "  1) git diff" -ForegroundColor White
Write-Host "  2) probar front/back localmente" -ForegroundColor White
Write-Host "  3) git add . && git commit -m 'fix: graficos hidraulicos opcionales' && git push" -ForegroundColor White
