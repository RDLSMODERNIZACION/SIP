param([string]$ProjectRoot = "")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Resolve-Root([string]$Requested) {
    $candidates = @()
    if ($Requested) { $candidates += $Requested }
    $candidates += (Get-Location).Path
    $candidates += (Split-Path -Parent $PSScriptRoot)

    foreach ($x in $candidates) {
        if (-not $x) { continue }
        $p = [IO.Path]::GetFullPath($x)

        if (Test-Path "$p\back\app\services\pdf_service.py") { return $p }

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
$firma = Join-Path $assetsDir "logo_firma.png"
$sello = Join-Path $assetsDir "logo_sello_sip.png"

Write-Host "`n==> Proyecto detectado: $root" -ForegroundColor Cyan

if (-not (Test-Path $firma)) {
    throw "No encontré la firma actual en: $firma"
}

if (-not (Test-Path $sello)) {
    throw "No encontré el sello actual en: $sello"
}

Write-Host "   [OK] Firma actual encontrada" -ForegroundColor Green
Write-Host "   [OK] Sello actual encontrado" -ForegroundColor Green
Write-Host "   IMPORTANTE: V25 NO copia ni reemplaza estas imágenes." -ForegroundColor Yellow

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$pdfService.backup_v25_$stamp"
Copy-Item $pdfService $backup -Force
Write-Host "   [OK] Backup: $backup" -ForegroundColor Green

Write-Host "`n==> Aplicando parche V25" -ForegroundColor Cyan
& python (Join-Path $PSScriptRoot "patch_v25.py") $pdfService
if ($LASTEXITCODE -ne 0) { throw "Falló patch_v25.py" }

Write-Host "`n==> Verificando sintaxis" -ForegroundColor Cyan
& python -m py_compile $pdfService
if ($LASTEXITCODE -ne 0) { throw "pdf_service.py tiene error de sintaxis" }

Write-Host "   [OK] pdf_service.py compila" -ForegroundColor Green

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " V25 APLICADA - USA LAS IMAGENES ACTUALES" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "No se reemplazó ninguna imagen." -ForegroundColor Cyan
Write-Host "Regenerá el PDF y debería usar tus PNG nuevos sin fondo." -ForegroundColor Cyan
