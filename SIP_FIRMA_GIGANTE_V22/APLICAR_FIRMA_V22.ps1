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

Write-Host "`n==> Proyecto detectado: $root" -ForegroundColor Cyan

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$pdfService.backup_v22_$stamp"
Copy-Item $pdfService $backup -Force
Write-Host "   [OK] Backup: $backup" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "logo_firma.png") (Join-Path $assetsDir "logo_firma.png") -Force
Write-Host "   [OK] Firma copiada" -ForegroundColor Green

& python (Join-Path $PSScriptRoot "patch_v22.py") $pdfService
if ($LASTEXITCODE -ne 0) { throw "Falló patch_v22.py" }

& python -m py_compile $pdfService
if ($LASTEXITCODE -ne 0) { throw "pdf_service.py tiene error de sintaxis" }

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " FIRMA V22 GIGANTE APLICADA" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "Firma mucho más grande y más arriba en ambos recuadros." -ForegroundColor Cyan
