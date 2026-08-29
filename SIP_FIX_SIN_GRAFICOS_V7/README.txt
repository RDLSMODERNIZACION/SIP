SIP FIX SIN GRAFICOS V7

Este fix apunta al mensaje exacto:

"Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar."

Busca el texto en TODO el backend Python y elimina la validación que lo genera.

EJECUTAR:

Set-ExecutionPolicy -Scope Process Bypass
.\SIP_FIX_SIN_GRAFICOS_V7\APLICAR_FIX_SIN_GRAFICOS_V7.ps1

Después, si el backend está en Render:

git diff
git add .
git commit -m "fix: eliminar requisito de grafico hidraulico"
git push

Si probás localmente, reiniciá el backend después de aplicar el fix.
