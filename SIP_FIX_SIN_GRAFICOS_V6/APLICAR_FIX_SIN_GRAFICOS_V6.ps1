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
        if (Test-Path "$p\front\src\components\certificates\CertificateFormModal.tsx") {
            return $p
        }
        $parent = Split-Path -Parent $p
        if ($parent -and (Test-Path "$parent\front\src\components\certificates\CertificateFormModal.tsx")) {
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

$root = Resolve-Root $ProjectRoot
Write-Host "`n==> Proyecto: $root" -ForegroundColor Cyan

$form = "$root\front\src\components\certificates\CertificateFormModal.tsx"

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "$form.backup_v6_$stamp"
Copy-Item $form $backup -Force
Write-Host "   [OK] Backup: $backup" -ForegroundColor Green

$t = ReadText $form
$before = $t

# Corrige exactamente el residuo producido por V5.
$t = $t.Replace(
    'requires_hydraulic_chart: false, Boolean(form.requires_hydraulic_chart)),',
    'requires_hydraulic_chart: false,'
)

# Variantes posibles del mismo residuo.
$t = [regex]::Replace(
    $t,
    'requires_hydraulic_chart:\s*false\s*,\s*Boolean\(form\.requires_hydraulic_chart\)\s*\)\s*,',
    'requires_hydraulic_chart: false,'
)

$t = [regex]::Replace(
    $t,
    'requires_hydraulic_chart:\s*false\s*,\s*Boolean\(form\.requires_hydraulic_chart\)\s*\)',
    'requires_hydraulic_chart: false'
)

if ($t -eq $before) {
    Write-Host "   [AVISO] No encontré el residuo exacto. Verifico igualmente el archivo." -ForegroundColor Yellow
} else {
    WriteText $form $t
    Write-Host "   [OK] Línea requires_hydraulic_chart corregida" -ForegroundColor Green
}

# Verificaciones
$final = ReadText $form
$errors = @()

if ($final -match 'requires_hydraulic_chart:\s*false\s*,\s*Boolean\(form\.requires_hydraulic_chart\)') {
    $errors += "Todavía quedó un fragmento Boolean(form.requires_hydraulic_chart) después de false."
}

if ($final -match 'requires_hydraulic_chart:\s*false,\s*Boolean') {
    $errors += "Todavía quedó sintaxis inválida en requires_hydraulic_chart."
}

if ($errors.Count -gt 0) {
    Write-Host "`nFIX INCOMPLETO:" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host " - $e" -ForegroundColor Red }
    Write-Host "Backup: $backup" -ForegroundColor Yellow
    exit 2
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host " SIP FIX V6 APLICADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora probá:" -ForegroundColor Cyan
Write-Host "  cd front" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
