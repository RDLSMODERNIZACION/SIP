SIP - FIX SIN GRÁFICOS V1
=============================

Objetivo
--------
Eliminar el requisito del gráfico/carta hidráulica EN TODOS LOS CASOS.

Qué modifica
------------
1. Backend:
   - Ya no fuerza gráfico para relief_valve_set.
   - Ya no fuerza gráfico para hydrostatic_line.
   - Ignora requisitos históricos de gráfico configurados por cliente.
   - Ya no bloquea la aprobación si falta el gráfico.

2. Frontend:
   - El formulario ya no muestra "Gráfico / carta hidráulica".
   - Siempre envía requires_hydraulic_chart=false.
   - Ya no muestra la sección para subir/reemplazar/eliminar el gráfico.

3. PDF:
   - No genera ANEXO A por gráfico.
   - Certificados históricos que tuvieran requires_hydraulic_chart=true también se generan sin anexo.

Uso
---
Opción A (recomendada):
1. Descomprimir este ZIP dentro de la carpeta raíz del proyecto SIP.
2. Abrir PowerShell en esa carpeta.
3. Ejecutar:

   Set-ExecutionPolicy -Scope Process Bypass
   .\APLICAR_FIX_SIN_GRAFICOS.ps1

Opción B:
   .\APLICAR_FIX_SIN_GRAFICOS.ps1 -ProjectRoot "C:\ruta\a\SIP"

El script crea un backup automático antes de modificar archivos.

Después:
   git diff
   git add .
   git commit -m "fix: graficos hidraulicos opcionales"
   git push
