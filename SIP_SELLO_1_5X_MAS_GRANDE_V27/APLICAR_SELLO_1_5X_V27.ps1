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
    throw "No encontré la firma en: $firma"
}
if (-not (Test-Path $sello)) {
    throw "No encontré el sello en: $sello"
}
Write-Host "   [OK] Firma encontrada" -ForegroundColor Green
Write-Host "   [OK] Sello encontrado" -ForegroundColor Green
Write-Host "   [OK] Esta versión NO reemplaza imágenes; sólo agranda el sello en el PDF." -ForegroundColor Yellow

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$pdfService.backup_v27_$stamp"
Copy-Item $pdfService $backup -Force
Write-Host "   [OK] Backup: $backup" -ForegroundColor Green

Write-Host "`n==> Aplicando parche V27" -ForegroundColor Cyan
& python (Join-Path $PSScriptRoot "patch_v27.py") $pdfService
if ($LASTEXITCODE -ne 0) { throw "Falló patch_v27.py" }

Write-Host "`n==> Verificando sintaxis" -ForegroundColor Cyan
& python -m py_compile $pdfService
if ($LASTEXITCODE -ne 0) { throw "pdf_service.py tiene error de sintaxis" }
Write-Host "   [OK] pdf_service.py compila" -ForegroundColor Green

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " V27 APLICADA - SELLO 1,5X MAS GRANDE" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "Sólo se agrandó el sello del recuadro 'Sello de laboratorio'." -ForegroundColor Cyan
