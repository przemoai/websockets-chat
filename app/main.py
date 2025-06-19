import asyncio
import signal

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logger import logger
from app.middleware.prometheus import PrometheusMiddleware, metrics_endpoint
from app.routers import auth_router, websocket_router
from app.routers.websocket import initialize_manager, shutdown_manager
from app.services.redis_client import redis_client


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    try:
        await redis_client.connect()

        await initialize_manager()

        logger.info("Application startup completed")

        yield

    finally:
        logger.info("Shutting down application...")

        await shutdown_manager()

        await redis_client.disconnect()

        logger.info("Application shutdown completed")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins="*",  # settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)

# TODO: Add Prometheus middleware
app.add_middleware(PrometheusMiddleware)

app.include_router(auth_router)
app.include_router(websocket_router)


app.get("/metrics")(metrics_endpoint)


@app.get("")
async def root():
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        await redis_client.redis.ping()
        redis_status = "healthy"
    except Exception:
        redis_status = "unhealthy"

    return {
        "status": "healthy",
        "redis": redis_status,
        "timestamp": asyncio.get_event_loop().time(),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Graceful shutdown handling
def signal_handler(sig, frame):
    """Handle shutdown signals."""
    logger.info(f"Received signal {sig}, shutting down gracefully...")


if __name__ == "__main__":
    import uvicorn

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
