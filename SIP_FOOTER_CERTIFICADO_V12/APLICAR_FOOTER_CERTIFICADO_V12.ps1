param(
    [string]$ProjectRoot = ""
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

        if (Test-Path "$p\back\app\services\pdf_service.py") {
            return $p
        }

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
$backup = "$pdfService.backup_footer_v12_$stamp"
Copy-Item $pdfService $backup -Force
Write-Host "   [OK] Backup: $backup" -ForegroundColor Green

Write-Host "`n==> Copiando imágenes" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "logo_firma.png") (Join-Path $assetsDir "logo_firma.png") -Force
Copy-Item (Join-Path $PSScriptRoot "logo_sello_sip.png") (Join-Path $assetsDir "logo_sello_sip.png") -Force
Write-Host "   [OK] Imágenes copiadas" -ForegroundColor Green

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "No encontré Python en PATH."
}

Write-Host "`n==> Aplicando parche al PDF" -ForegroundColor Cyan
& python (Join-Path $PSScriptRoot "patch_footer.py") $pdfService
if ($LASTEXITCODE -ne 0) {
    throw "Falló patch_footer.py"
}
Write-Host "   [OK] Parche aplicado" -ForegroundColor Green

Write-Host "`n==> Verificando sintaxis" -ForegroundColor Cyan
& python -m py_compile $pdfService
if ($LASTEXITCODE -ne 0) {
    throw "pdf_service.py quedó con error de sintaxis."
}
Write-Host "   [OK] pdf_service.py compila" -ForegroundColor Green

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " FOOTER CERTIFICADO V12 APLICADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora regenerá un PDF de certificado y revisá el pie." -ForegroundColor Cyan
