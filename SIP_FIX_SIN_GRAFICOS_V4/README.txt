SIP FIX SIN GRAFICOS V4

Esta versión NO depende de encontrar apply_client_requirements.

Fue creada porque la copia local del proyecto tiene diferencias respecto del GitHub.
Busca y neutraliza directamente referencias a requires_hydraulic_chart y bloqueos de aprobación.

EJECUTAR DESDE LA RAÍZ DE SIP:

Set-ExecutionPolicy -Scope Process Bypass
.\SIP_FIX_SIN_GRAFICOS_V4\APLICAR_FIX_SIN_GRAFICOS_V4.ps1

Después:

git diff

IMPORTANTE:
La V3 alcanzó a modificar template_requires_hydraulic_chart antes de fallar.
La V4 está preparada para ejecutarse encima de ese estado parcial.
También crea un backup nuevo antes de modificar.
