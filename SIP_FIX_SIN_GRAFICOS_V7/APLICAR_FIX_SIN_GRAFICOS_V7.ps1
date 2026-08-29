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
        if (Test-Path "$p\back") { return $p }

        $parent = Split-Path -Parent $p
        if ($parent -and (Test-Path "$parent\back")) { return $parent }
    }

    throw "No encontré la raíz de SIP."
}

function ReadText([string]$Path) {
    return [IO.File]::ReadAllText($Path)
}

function WriteText([string]$Path,[string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

$root = Resolve-Root $ProjectRoot
$backRoot = Join-Path $root "back"

Write-Host "`n==> Proyecto: $root" -ForegroundColor Cyan

$targetMessage = "Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar."

$files = Get-ChildItem $backRoot -Recurse -File -Include *.py
$matches = @()

foreach ($file in $files) {
    $txt = ReadText $file.FullName
    if ($txt.Contains($targetMessage)) {
        $matches += $file.FullName
    }
}

if ($matches.Count -eq 0) {
    Write-Host "   [AVISO] No encontré el mensaje exacto en back/*.py." -ForegroundColor Yellow
    Write-Host "   Esto suele significar que el backend que estás usando está desplegado con una versión anterior." -ForegroundColor Yellow
} else {
    Write-Host "   Encontré el bloqueo en:" -ForegroundColor Green
    foreach ($m in $matches) { Write-Host "   - $m" -ForegroundColor White }

    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupRoot = Join-Path $root "_backup_fix_sin_graficos_v7_$stamp"
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

    foreach ($path in $matches) {
        $rel = $path.Substring($root.Length).TrimStart('\','/')
        $backup = Join-Path $backupRoot $rel
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null
        Copy-Item $path $backup -Force

        $t = ReadText $path
        $before = $t

        # Caso esperado:
        # if cert.get(...) or template_type in (...):
        #     chart = ...
        #     if not chart:
        #         raise HTTPException(...mensaje...)
        $escaped = [regex]::Escape($targetMessage)

        $patterns = @(
            '(?ms)^[ \t]+if[^\r\n]*requires_hydraulic_chart[^\r\n]*:\r?\n(?:[ \t]+[^\r\n]*\r?\n)*?[ \t]+raise HTTPException\([^\)]*detail="' + $escaped + '"[^\)]*\)\s*\r?\n',
            '(?ms)^[ \t]+if[^\r\n]*relief_valve_set[^\r\n]*hydrostatic_line[^\r\n]*:\r?\n(?:[ \t]+[^\r\n]*\r?\n)*?[ \t]+raise HTTPException\([^\)]*detail="' + $escaped + '"[^\)]*\)\s*\r?\n',
            '(?ms)^[ \t]+if not chart:\r?\n[ \t]+raise HTTPException\([^\)]*detail="' + $escaped + '"[^\)]*\)\s*\r?\n'
        )

        foreach ($pat in $patterns) {
            $rx = New-Object Text.RegularExpressions.Regex($pat)
            if ($rx.IsMatch($t)) {
                $t = $rx.Replace($t, "", 1)
            }
        }

        # Última red de seguridad: si quedó el raise exacto, convertirlo en no-op.
        $raisePattern = '(?m)^(?<indent>[ \t]*)raise HTTPException\([^\r\n]*detail="' + $escaped + '"[^\r\n]*\)\s*$'
        $rxRaise = New-Object Text.RegularExpressions.Regex($raisePattern)
        if ($rxRaise.IsMatch($t)) {
            $t = $rxRaise.Replace($t, '${indent}pass  # gráfico hidráulico no requerido', 1)
        }

        # Forzar la función helper si existe.
        $rxHelper = New-Object Text.RegularExpressions.Regex(
            '(?ms)^def template_requires_hydraulic_chart\(.*?\):\s*\r?\n(?:(?:    |\t).*\r?\n)+?(?=^def |\Z)'
        )
        if ($rxHelper.IsMatch($t)) {
            $t = $rxHelper.Replace($t, @'
def template_requires_hydraulic_chart(template_type: str | None) -> bool:
    return False


'@, 1)
        }

        WriteText $path $t

        $check = ReadText $path
        if ($check.Contains($targetMessage)) {
            throw "No pude eliminar completamente el bloqueo en $path"
        } else {
            Write-Host "   [OK] Bloqueo eliminado en $path" -ForegroundColor Green
        }
    }

    Write-Host "   Backup: $backupRoot" -ForegroundColor DarkGray
}

# Mostrar cualquier referencia restante a gráfico/requisito en backend.
Write-Host "`n==> Referencias restantes relevantes en backend" -ForegroundColor Cyan
$remaining = Select-String -Path "$backRoot\**\*.py" -Pattern "requires_hydraulic_chart|gráfico/carta|grafico/carta" -ErrorAction SilentlyContinue

if ($remaining) {
    foreach ($r in $remaining) {
        Write-Host ("   {0}:{1}: {2}" -f $r.Path, $r.LineNumber, $r.Line.Trim()) -ForegroundColor DarkYellow
    }
} else {
    Write-Host "   [OK] No quedan referencias relevantes." -ForegroundColor Green
}

# Compilar Python.
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "`n==> Verificando sintaxis Python" -ForegroundColor Cyan
    $pyFiles = Get-ChildItem $backRoot -Recurse -File -Include *.py | ForEach-Object { $_.FullName }
    foreach ($p in $pyFiles) {
        & python -m py_compile $p
        if ($LASTEXITCODE -ne 0) {
            throw "Error de sintaxis Python en $p"
        }
    }
    Write-Host "   [OK] Backend compila" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " SIP FIX SIN GRAFICOS V7 TERMINADO" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Cyan
Write-Host "Si usás backend local, reinicialo." -ForegroundColor White
Write-Host "Si usás Render, hacé git add/commit/push para desplegar este cambio." -ForegroundColor White
