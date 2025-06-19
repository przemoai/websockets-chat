import time
from typing import Callable

from fastapi import Request, Response
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.middleware.base import BaseHTTPMiddleware

# Prometheus metrics
REQUEST_COUNT = Counter(
    "fastapi_requests_total", "Total requests", ["method", "endpoint", "status_code"]
)

REQUEST_DURATION = Histogram(
    "fastapi_request_duration_seconds",
    "Request duration in seconds",
    ["method", "endpoint"],
)

WEBSOCKET_CONNECTIONS = Counter(
    "websocket_connections_total", "Total WebSocket connections", ["user_id"]
)

WEBSOCKET_MESSAGES = Counter(
    "websocket_messages_total", "Total WebSocket messages", ["message_type", "channel"]
)

ACTIVE_CONNECTIONS = Counter(
    "websocket_active_connections", "Currently active WebSocket connections"
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        # Get endpoint
        endpoint = request.url.path
        method = request.method

        # Call the next middleware/handler
        response = await call_next(request)

        # Record metrics
        process_time = time.time() - start_time
        REQUEST_DURATION.labels(method=method, endpoint=endpoint).observe(process_time)
        REQUEST_COUNT.labels(
            method=method, endpoint=endpoint, status_code=response.status_code
        ).inc()

        return response


async def metrics_endpoint():
    """Endpoint to expose Prometheus metrics."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
