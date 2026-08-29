SIP RECUPERACION DEFINITIVA V9

PROBLEMA DETECTADO
El certificate_service.py actual de main quedó truncado y Render falla con:
ImportError: cannot import name 'certificate_detail'

La V9 NO USA LOS BACKUPS.
Restaura el archivo completo directamente desde el commit sano:
fda17a44fd71ab51b973abf553a16a8f724c79d5

Luego modifica sólo:
- template_requires_hydraulic_chart -> False
- apply_client_requirements -> requires_hydraulic_chart=False
- elimina únicamente la validación del gráfico antes de aprobar

Y verifica:
- py_compile
- import certificate_detail
- import pdf_service
- que el archivo tenga más de 400 líneas

USO

Desde C:\Users\victo\OneDrive\Escritorio\SIP:

Set-ExecutionPolicy -Scope Process Bypass
.\SIP_RECUPERACION_DEFINITIVA_V9\APLICAR_RECUPERACION_V9.ps1

Si dice que no encuentra el commit:
git fetch origin

y volver a ejecutar.

AL FINAL, subir solamente certificate_service.py:

git add back/app/services/certificate_service.py
git commit -m "fix: restaurar certificate service y quitar grafico obligatorio"
git push
