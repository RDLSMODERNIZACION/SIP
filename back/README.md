# Backend SIP Certificados Digitales

Backend FastAPI para certificados digitales con roles, clientes, equipos, patrones, aprobación, auditoría, QR y PDF.

## 1. Crear base de datos
Ejecutá primero el SQL completo que ya armamos en Supabase.

## 2. Configurar entorno
Copiá `.env.example` a `.env` y completá `DATABASE_URL`.

```bash
cp .env.example .env
```

## 3. Instalar e iniciar

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Abrir:

```txt
http://localhost:8000/docs
```

## Usuarios de prueba

```txt
admin@sip.com / admin123
trabajador@sip.com / trabajador123
aprobador@sip.com / aprobador123
cliente@tanckoating.com / cliente123
```

## Endpoints principales

- `POST /auth/login`
- `GET /auth/me`
- `GET /users`
- `GET /roles`
- `GET /clients`
- `GET /equipment`
- `GET /patterns`
- `GET /certificates`
- `POST /certificates`
- `GET /certificates/{id}`
- `PATCH /certificates/{id}`
- `POST /certificates/{id}/submit`
- `POST /certificates/{id}/approve`
- `POST /certificates/{id}/reject`
- `POST /certificates/{id}/annul`
- `POST /certificates/{id}/generate-qr`
- `POST /certificates/{id}/generate-pdf`
- `GET /public/validate/{hash}`

## Nota
En esta primera versión, los PDF y QR se guardan localmente en `app/static`. En producción conviene migrarlo a Supabase Storage.
