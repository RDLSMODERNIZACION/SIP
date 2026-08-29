SIP FIX SIN GRAFICOS V2

Esta versión reemplaza la V1.

La V1 buscaba bloques textuales exactos y podía fallar si tu copia local ya tenía
cambios anteriores. La V2 busca funciones y secciones por estructura/regex y tolera
más variantes del proyecto.

USO

Desde:
C:\Users\victo\OneDrive\Escritorio\SIP

ejecutar:

Set-ExecutionPolicy -Scope Process Bypass
.\SIP_FIX_SIN_GRAFICOS_V2\APLICAR_FIX_SIN_GRAFICOS_V2.ps1

Luego:
git diff

Si todo está bien:
git add .
git commit -m "fix: eliminar requisito de graficos"
git push

IMPORTANTE
El script crea un backup automático antes de modificar.
