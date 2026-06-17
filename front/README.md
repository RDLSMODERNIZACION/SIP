# SIP Certificados Digitales - Frontend hardcodeado

Frontend inicial en Next.js + TypeScript + Tailwind CSS para validar el flujo de certificados digitales antes de conectar backend y base de datos.

## Qué incluye

- Cambio de modo/rol: Administrador, Trabajador/Certificador, Aprobador y Cliente.
- Dashboard operativo.
- Listado de certificados con estados.
- Alta hardcodeada de certificados.
- Bandeja de aprobación.
- Portal cliente.
- Legajo digital de equipos.
- Control de patrones/instrumentos propios.
- Vista de validación pública por QR en `/validar/[hash]`.
- Vista imprimible del certificado en dos páginas.

## Cómo iniciar

```bash
npm install
npm run dev
```

Abrir:

```bash
http://localhost:3000
```

Ejemplo de validación pública:

```bash
http://localhost:3000/validar/sip-26-032-valido
```

## Próxima etapa

Después de aprobar las pantallas, se puede conectar con:

- Backend FastAPI.
- Base de datos Supabase/PostgreSQL.
- Auth real por usuario.
- Generación real de PDF.
- QR real.
- Storage para PDFs y adjuntos.
- Auditoría real de cambios.
