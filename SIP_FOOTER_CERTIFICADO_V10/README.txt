SIP FOOTER CERTIFICADO V10

Objetivo:
Agregar las dos imágenes enviadas por el usuario en la parte inferior del PDF del certificado.

Qué hace:
- copia las imágenes a back/app/static/certificate_assets/
- modifica back/app/services/pdf_service.py
- dibuja:
  * logo_firma.png en la parte inferior izquierda
  * logo_sello_sip.png en la parte inferior derecha

Uso:
1) Descomprimir este ZIP dentro de la carpeta raíz de SIP.
2) Ejecutar PowerShell:

   Set-ExecutionPolicy -Scope Process Bypass
   .\SIP_FOOTER_CERTIFICADO_V10\APLICAR_FOOTER_CERTIFICADO_V10.ps1

Después:
- regenerar un certificado PDF
- si te gusta:
   git add back/app/services/pdf_service.py back/app/static/certificate_assets/
   git commit -m "feat: agregar imágenes en pie del certificado"
   git push
