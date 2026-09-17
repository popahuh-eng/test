"""PostgreSQL connection pool and query helpers."""
from __future__ import annotations

import contextlib
from typing import Any, Generator, List, Optional, Tuple

import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor

from src.config import settings
from src.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Module-level connection pool (initialised lazily)
# ---------------------------------------------------------------------------
_pool: Optional[pg_pool.ThreadedConnectionPool] = None


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        logger.info("Initialising PostgreSQL connection pool")
        _pool = pg_pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=settings.DATABASE_URL,
        )
    return _pool


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

@contextlib.contextmanager
def get_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    """Context manager that yields a connection from the pool.

    The connection is returned to the pool when the block exits.  Any
    exception causes an automatic rollback before the connection is returned.
    """
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def execute_query(sql: str, params: Optional[Tuple | List] = None) -> None:
    """Execute a DML statement (INSERT / UPDATE / DELETE / DDL) and commit."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)


def fetch_many(
    sql: str,
    params: Optional[Tuple | List] = None,
    as_dict: bool = True,
) -> List[Any]:
    """Return all rows for a SELECT query.

    Parameters
    ----------
    sql:
        SQL query string (may contain ``%s`` placeholders).
    params:
        Positional parameters to bind.
    as_dict:
        When *True* (default) each row is a ``RealDictRow``.
        When *False* rows are plain tuples.
    """
    with get_connection() as conn:
        cursor_factory = RealDictCursor if as_dict else None
        with conn.cursor(cursor_factory=cursor_factory) as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def fetch_one(
    sql: str,
    params: Optional[Tuple | List] = None,
    as_dict: bool = True,
) -> Optional[Any]:
    """Return the first row of a SELECT query, or *None* if no rows match."""
    with get_connection() as conn:
        cursor_factory = RealDictCursor if as_dict else None
        with conn.cursor(cursor_factory=cursor_factory) as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def test_connection() -> bool:
    """Return *True* if the database is reachable, *False* otherwise."""
    try:
        row = fetch_one("SELECT 1 AS ok")
        return row is not None and row["ok"] == 1
    except Exception as exc:
        logger.warning("Database connectivity check failed", extra={"error": str(exc)})
        return False


def close_pool() -> None:
    """Close all connections in the pool (call during application shutdown)."""
    global _pool
    if _pool and not _pool.closed:
        _pool.closeall()
        logger.info("PostgreSQL connection pool closed")
    _pool = None
