param(
    [string]$ProjectRoot = "",
    [string]$SourceFirmaPath = "",
    [string]$SourceSelloPath = ""
)

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

function Resolve-SourceImage([string]$ExplicitPath, [string]$DefaultName) {
    if ($ExplicitPath -and (Test-Path $ExplicitPath)) {
        return [IO.Path]::GetFullPath($ExplicitPath)
    }
    $candidate = Join-Path $PSScriptRoot $DefaultName
    if (Test-Path $candidate) {
        return $candidate
    }
    throw "No encontré la imagen de entrada '$DefaultName'. Copiala dentro de la carpeta del fix, o pasá la ruta por parámetro."
}

$root = Resolve-Root $ProjectRoot
$pdfService = Join-Path $root "back\app\services\pdf_service.py"
$assetsDir = Join-Path $root "back\app\static\certificate_assets"
$firmaDst = Join-Path $assetsDir "logo_firma.png"
$selloDst = Join-Path $assetsDir "logo_sello_sip.png"

Write-Host "`n==> Proyecto detectado: $root" -ForegroundColor Cyan

$firmaSrc = Resolve-SourceImage $SourceFirmaPath "logo_firma.png"
$selloSrc = Resolve-SourceImage $SourceSelloPath "logo_sello_sip.png"

Write-Host "   Fuente firma: $firmaSrc" -ForegroundColor White
Write-Host "   Fuente sello: $selloSrc" -ForegroundColor White

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$pdfBackup = "$pdfService.backup_v26_$stamp"
Copy-Item $pdfService $pdfBackup -Force
Write-Host "   [OK] Backup PDF: $pdfBackup" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

if (Test-Path $firmaDst) {
    Copy-Item $firmaDst "$firmaDst.antes_v26_$stamp" -Force
}
if (Test-Path $selloDst) {
    Copy-Item $selloDst "$selloDst.antes_v26_$stamp" -Force
}

Copy-Item $firmaSrc $firmaDst -Force
Copy-Item $selloSrc $selloDst -Force
Write-Host "   [OK] Imágenes reemplazadas en certificate_assets" -ForegroundColor Green

Write-Host "`n==> Verificando imágenes de destino" -ForegroundColor Cyan
& python (Join-Path $PSScriptRoot "verificar_pngs.py") $firmaDst $selloDst
if ($LASTEXITCODE -ne 0) {
    throw "Falló verificar_pngs.py"
}

Write-Host "`n==> Aplicando parche al PDF" -ForegroundColor Cyan
& python (Join-Path $PSScriptRoot "patch_v26.py") $pdfService
if ($LASTEXITCODE -ne 0) {
    throw "Falló patch_v26.py"
}

Write-Host "`n==> Verificando sintaxis" -ForegroundColor Cyan
& python -m py_compile $pdfService
if ($LASTEXITCODE -ne 0) {
    throw "pdf_service.py tiene error de sintaxis"
}
Write-Host "   [OK] pdf_service.py compila" -ForegroundColor Green

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " V26 APLICADA - REEMPLAZA SI O SI LAS IMAGENES" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "Poné dentro de esta carpeta los archivos:" -ForegroundColor White
Write-Host " - logo_firma.png" -ForegroundColor White
Write-Host " - logo_sello_sip.png" -ForegroundColor White
Write-Host "con las versiones NUEVAS sin fondo." -ForegroundColor White
Write-Host ""
Write-Host "Después regenerá el PDF." -ForegroundColor Cyan
