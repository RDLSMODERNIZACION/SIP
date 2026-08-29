V26 reemplaza SI O SI las imágenes del proyecto antes de tocar el PDF.

USO SIMPLE:
1) Descomprimí este ZIP.
2) Copiá dentro de la carpeta:
   - logo_firma.png
   - logo_sello_sip.png
   con las versiones nuevas sin fondo.
3) Ejecutá:
   Set-ExecutionPolicy -Scope Process Bypass
   .\SIP_REEMPLAZAR_IMAGENES_Y_PDF_V26\APLICAR_REEMPLAZAR_IMAGENES_Y_PDF_V26.ps1

OPCIONAL:
Podés pasar rutas explícitas:
.\SIP_REEMPLAZAR_IMAGENES_Y_PDF_V26\APLICAR_REEMPLAZAR_IMAGENES_Y_PDF_V26.ps1 `
  -SourceFirmaPath "C:\ruta\logo_firma.png" `
  -SourceSelloPath "C:\ruta\logo_sello_sip.png"

Esta versión:
- hace backup del PDF
- hace backup de las imágenes anteriores
- copia las nuevas imágenes
- muestra hash, tamaño y si tienen alpha
- deja 2 recuadros:
  * Firma y sello del responsable
  * Sello de laboratorio
