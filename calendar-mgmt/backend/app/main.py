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
from app.models.base import Base
from app.api.v1.router import api_router
from app.core.middleware import SecurityHeadersMiddleware
from app.core.exceptions import NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError, ConflictError, ValidationError
from app.core.limiter import limiter

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE meeting_schedules DROP COLUMN IF EXISTS end_time"))
        try:
            await conn.execute(text("ALTER TABLE schedules DROP CONSTRAINT IF EXISTS uq_employee_date"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE schedules DROP CONSTRAINT IF EXISTS uq_employee_date_shift"))
            await conn.execute(text("ALTER TABLE schedules ADD CONSTRAINT uq_employee_date_shift UNIQUE (employee_id, date, shift_template_id)"))
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
