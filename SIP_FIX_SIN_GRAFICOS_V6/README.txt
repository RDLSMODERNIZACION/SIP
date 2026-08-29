SIP FIX SIN GRAFICOS V6

Corrige el error de compilación introducido por V5:

requires_hydraulic_chart: false, Boolean(form.requires_hydraulic_chart)),

Debe quedar:

requires_hydraulic_chart: false,

USO:

Set-ExecutionPolicy -Scope Process Bypass
.\SIP_FIX_SIN_GRAFICOS_V6\APLICAR_FIX_SIN_GRAFICOS_V6.ps1

Luego:
cd front
npm run dev
