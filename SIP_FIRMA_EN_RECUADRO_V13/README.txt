SIP FIRMA EN RECUADRO V13

Objetivo:
Mover la firma y el sello al recuadro inferior derecho del certificado
("FIRMA Y SELLO DEL RESPONSABLE"), en vez de dejarlos en el pie absoluto.

Qué hace:
- copia las imágenes al backend
- actualiza/reemplaza la función draw_certificate_footer_images(c)
- dibuja:
  * firma dentro del recuadro derecho
  * sello SIP dentro del mismo recuadro, a la derecha

Uso:
Set-ExecutionPolicy -Scope Process Bypass
.\SIP_FIRMA_EN_RECUADRO_V13\APLICAR_FIRMA_EN_RECUADRO_V13.ps1
