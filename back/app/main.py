from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import health, auth, users, roles, clients, equipment, patterns, certificates, public, catalogs

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
(STATIC_DIR / "certificates").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "qr").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "hydraulic-charts").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "branding").mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "pattern-certificates").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="SIP Certificados Digitales API",
    version="1.0.0",
    description="Backend para emisión, aprobación, trazabilidad, QR y PDF de certificados digitales.",
)

# Con credenciales habilitadas conviene declarar explícitamente los orígenes
# permitidos. Si CORS_ORIGINS sigue en "*", usamos una lista segura que cubre
# producción y desarrollo local.
DEFAULT_CORS_ORIGINS = [
    "https://sipinstrumentacion.com",
    "https://www.sipinstrumentacion.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

cors_origins = settings.cors_origins_list
if cors_origins == ["*"]:
    cors_origins = DEFAULT_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(clients.router)
app.include_router(equipment.router)
app.include_router(patterns.router)
app.include_router(certificates.router)
app.include_router(catalogs.router)
app.include_router(public.router)
