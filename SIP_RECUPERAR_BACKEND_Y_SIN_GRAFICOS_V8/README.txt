SIP V8 - RECUPERAR BACKEND + SIN GRAFICOS

El error de Render es:
ImportError: cannot import name 'certificate_detail'

La V8:
1. Busca un backup sano de certificate_service.py.
2. Prioriza el backup V4 ya creado anteriormente.
3. Verifica que el backup tenga certificate_detail.
4. Restaura el archivo.
5. Aplica SOLO el cambio mínimo para que el gráfico no sea obligatorio.
6. Ejecuta py_compile.
7. Prueba el import real:
   from app.services.certificate_service import certificate_detail

USO:

Set-ExecutionPolicy -Scope Process Bypass
.\SIP_RECUPERAR_BACKEND_Y_SIN_GRAFICOS_V8\APLICAR_RECUPERACION_V8.ps1

Luego:
git diff -- back/app/services/certificate_service.py
git add .
git commit -m "fix: recuperar backend y eliminar requisito de grafico"
git push
