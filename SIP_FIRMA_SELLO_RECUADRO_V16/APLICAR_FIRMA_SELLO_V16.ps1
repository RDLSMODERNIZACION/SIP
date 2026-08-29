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
        if ($parent -and (Test-Path "$parent\back\app\services\pdf_service.py")) { return $parent }
    }
    throw "No encontré la raíz del proyecto SIP."
}

$root = Resolve-Root $ProjectRoot
$pdfService = Join-Path $root "back\app\services\pdf_service.py"
$assetsDir = Join-Path $root "back\app\static\certificate_assets"

Write-Host "`n==> Proyecto detectado: $root" -ForegroundColor Cyan
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$pdfService.backup_v16_$stamp"
Copy-Item $pdfService $backup -Force
Write-Host "   [OK] Backup: $backup" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "logo_firma.png") (Join-Path $assetsDir "logo_firma.png") -Force
Copy-Item (Join-Path $PSScriptRoot "logo_sello_sip.png") (Join-Path $assetsDir "logo_sello_sip.png") -Force
Write-Host "   [OK] Firma y sello copiados" -ForegroundColor Green

& python (Join-Path $PSScriptRoot "patch_v16.py") $pdfService
if ($LASTEXITCODE -ne 0) { throw "Falló patch_v16.py" }

& python -m py_compile $pdfService
if ($LASTEXITCODE -ne 0) { throw "pdf_service.py tiene error de sintaxis" }

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " FIRMA Y SELLO V16 APLICADOS EN EL RECUADRO" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "Regenerá el PDF. Ahora se dibujan directamente dentro del recuadro derecho de la página 2." -ForegroundColor Cyan
