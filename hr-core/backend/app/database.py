import logging
import re
import socket
from urllib.parse import urlparse
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import log as sa_log
from app.config import settings


def _resolve_reachable_db_url(raw_url: str, fallback_ports: list[int]) -> str:
    try:
        parsed = urlparse(raw_url)
        host = parsed.hostname
        port = parsed.port or 5432
        if host in ("localhost", "127.0.0.1"):
            candidates = [port] + [p for p in fallback_ports if p != port]
            for cand_port in candidates:
                try:
                    with socket.create_connection(("127.0.0.1", cand_port), timeout=0.3):
                        if cand_port != port:
                            return re.sub(rf"@{re.escape(host)}:{port}/", f"@{host}:{cand_port}/", raw_url)
                        return raw_url
                except OSError:
                    continue
    except Exception:
        pass
    return raw_url


class _ParamMaskingSQLLogger(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        if isinstance(msg, str):
            msg = re.sub(
                r"(\$\d+|%\([^)]+\)s|%\w+)",
                "?",
                msg,
            )
        return msg, kwargs


def _configure_sql_logger() -> None:
    if not settings.ENVIRONMENT == "development":
        return
    sa_logger = logging.getLogger("sqlalchemy.engine")
    if any(
        getattr(h, "_is_mbs_sql_handler", False)
        for h in sa_logger.handlers
    ):
        return
    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter("[SQL] %(message)s"))
    handler._is_mbs_sql_handler = True
    masked = _ParamMaskingSQLLogger(sa_logger, {})
    sa_logger.addHandler(handler)
    sa_logger.setLevel(logging.INFO)


engine = create_async_engine(
    _resolve_reachable_db_url(settings.DATABASE_URL, [5432, 5433]),
    echo=False,
    echo_pool=False,
)

_configure_sql_logger()

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


class SessionContext:
    def __init__(self):
        self.session: AsyncSession | None = None

    async def __aenter__(self) -> AsyncSession:
        self.session = async_session_factory()
        return self.session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            try:
                if exc_type:
                    await self.session.rollback()
                else:
                    await self.session.commit()
            finally:
                await self.session.close()
