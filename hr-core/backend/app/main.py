import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.database import engine
from app.models.base import Base
from app.api.v1.router import api_router
from app.core.middleware import AuditLogMiddleware, SecurityHeadersMiddleware
from app.core.exceptions import NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError, ConflictError, ValidationError
from app.core.limiter import limiter

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        try:
            await conn.execute(text("ALTER TABLE job_positions ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES workplaces(id);"))
        except Exception as e:
            logger.warning(f"Auto-migration workplace_id warning: {e}")

    # Seed initial data (Admin user, departments, workplaces, positions) if empty
    try:
        from app.seed import seed
        await seed()
        logger.info("Auto-seed check completed successfully.")
    except Exception as e:
        logger.warning(f"Auto-seed warning: {e}")

    # Seed shift_rate_configs default values if empty
    from app.database import async_session_factory
    from app.models.shift_rate_config import ShiftRateConfig
    from sqlalchemy import select
    from decimal import Decimal

    async with async_session_factory() as session:
        result = await session.execute(select(ShiftRateConfig))
        if not result.scalars().all():
            defaults = [
                ShiftRateConfig(code="NORMAL", name="Ca ngày thường", multiplier=Decimal("1.0"), allowance_amount=Decimal("0.0"), description="Ca làm việc tiêu chuẩn 8h theo quy định"),
                ShiftRateConfig(code="NIGHT", name="Ca đêm (22h-6h)", multiplier=Decimal("1.3"), allowance_amount=Decimal("50000.00"), description="Ca đêm hưởng thêm 30% tiền lương + Phụ cấp ăn đêm (NĐ 145/2020 & QĐ 73/2011)"),
                ShiftRateConfig(code="WEEKEND", name="Trực cuối tuần (T7/CN)", multiplier=Decimal("2.0"), allowance_amount=Decimal("80000.00"), description="Lịch trực ngày nghỉ hàng tuần"),
                ShiftRateConfig(code="HOLIDAY", name="Trực ngày Lễ/Tết", multiplier=Decimal("3.0"), allowance_amount=Decimal("150000.00"), description="Lịch trực ngày Lễ, Tết theo quy định Nhà nước"),
            ]
            session.add_all(defaults)
            await session.commit()
            logger.info("Seeded default public sector shift rate configs.")

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
app.add_middleware(AuditLogMiddleware)


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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if settings.ENVIRONMENT == "development" else "Lỗi hệ thống, vui lòng thử lại sau"},
    )


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

uploads_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/health")

async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}
