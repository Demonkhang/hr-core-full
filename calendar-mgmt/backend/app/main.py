import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.database import engine
from app.models import Base
from app.api.v1.router import api_router
from app.core.middleware import SecurityHeadersMiddleware
from app.core.exceptions import NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError, ConflictError, ValidationError
from app.core.limiter import limiter

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)


async def _ensure_calendar_db_exists() -> None:
    """Tự động kiểm tra và khởi tạo database mbs_calendar nếu chạy PostgreSQL local chưa có DB này"""
    import asyncpg
    from urllib.parse import urlparse

    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        return
    except Exception as exc:
        err_msg = str(exc).lower()
        if "does not exist" not in err_msg and "invalidcatalogname" not in err_msg:
            logger.warning(f"DB initial check warning: {exc}")
            return

    try:
        parsed = urlparse(settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
        db_name = (parsed.path or "/mbs_calendar").lstrip("/") or "mbs_calendar"
        admin_conn = await asyncpg.connect(
            host=parsed.hostname or "127.0.0.1",
            port=parsed.port or 5432,
            user=parsed.username or "postgres",
            password=parsed.password or "postgres",
            database="postgres",
        )
        try:
            exists = await admin_conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if not exists:
                await admin_conn.execute(f'CREATE DATABASE "{db_name}"')
                logger.info(f"Auto-created PostgreSQL database: {db_name}")
        finally:
            await admin_conn.close()
    except Exception as create_exc:
        logger.warning(f"Could not auto-create database: {create_exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION}")
    await _ensure_calendar_db_exists()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    for sql_stmt in [
        "ALTER TABLE meeting_schedules DROP COLUMN IF EXISTS end_time",
        "ALTER TABLE schedules DROP CONSTRAINT IF EXISTS uq_employee_date",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql_stmt))
        except Exception:
            pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE schedules DROP CONSTRAINT IF EXISTS uq_employee_date_shift"))
            await conn.execute(
                text("ALTER TABLE schedules ADD CONSTRAINT uq_employee_date_shift UNIQUE (employee_id, date, shift_template_id)")
            )
    except Exception:
        pass
    
    try:
        from app.seed import seed
        await seed()
        logger.info("Auto-seed check completed successfully.")
    except Exception as e:
        logger.warning(f"Auto-seed warning: {e}")

    yield
    await engine.dispose()
    logger.info("Application shutdown")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        *(
            ["http://localhost:5173", "http://localhost:5174"]
            if settings.ENVIRONMENT == "development"
            else []
        ),
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
)
app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(BadRequestError)
async def bad_request_handler(request: Request, exc: BadRequestError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(UnauthorizedError)
async def unauthorized_handler(request: Request, exc: UnauthorizedError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request: Request, exc: ForbiddenError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def request_validation_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": " -> ".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "Dữ liệu đầu vào không hợp lệ", "errors": errors},
    )


app.include_router(api_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}
