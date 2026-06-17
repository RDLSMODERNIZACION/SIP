# SIP Certificados Frontend

Frontend refactorizado y conectado al backend FastAPI publicado en Render.

## Incluye

- Diseño más sobrio y profesional.
- Login real contra `/auth/login`.
- Token JWT guardado en `localStorage`.
- Panel general conectado a `/certificates`.
- Certificados conectados a la API.
- Alta de certificados en borrador.
- Envío a aprobación.
- Aprobación/rechazo.
- Generación de QR y PDF.
- Validación pública por QR en `/validar/[hash]`.
- Clientes, equipos, patrones y usuarios conectados al backend.
- `.gitignore` para no subir `node_modules`, `.next`, `.env.local`, logs ni archivos temporales.

## Configuración

Crear `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_API_BASE_URL=https://sip-fhu8.onrender.com
```

## Iniciar localmente

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Usuarios de prueba

```text
admin@sip.com / admin123
trabajador@sip.com / trabajador123
aprobador@sip.com / aprobador123
cliente@tanckoating.com / cliente123
```

## Estructura principal

```text
app/
  login/page.tsx
  page.tsx
  certificados/page.tsx
  clientes/page.tsx
  equipos/page.tsx
  patrones/page.tsx
  usuarios/page.tsx
  validar/[hash]/page.tsx

src/
  context/AuthContext.tsx
  lib/api.ts
  lib/auth.ts
  lib/certificatesApi.ts
  lib/resourcesApi.ts
  components/layout/*
  components/ui/*
  components/certificates/*
```
