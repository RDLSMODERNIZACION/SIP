# Compatibilidad para archivos antiguos que importan app.database.
# El backend real usa app.db.
from .db import get_conn, fetch_one, fetch_all, execute
