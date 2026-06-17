from contextlib import contextmanager
from typing import Any, Iterable, Optional
import psycopg
from psycopg.rows import dict_row
from .config import settings


@contextmanager
def get_conn():
    conn = psycopg.connect(settings.DATABASE_URL, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_one(query: str, params: Optional[Iterable[Any]] = None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or [])
            return cur.fetchone()


def fetch_all(query: str, params: Optional[Iterable[Any]] = None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or [])
            return cur.fetchall()


def execute(query: str, params: Optional[Iterable[Any]] = None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or [])
            try:
                return cur.fetchone()
            except psycopg.ProgrammingError:
                return None
