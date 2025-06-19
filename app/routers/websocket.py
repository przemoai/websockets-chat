import json
import time
from typing import Dict, Any

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
    status,
)

from app.core.logger import logger
from app.core.security import validate_websocket_token
from app.models.websocket import MessageType, WebSocketMessage
from app.services.redis_client import get_redis, RedisClient
from app.services.websocket_manager import ConnectionManager

router = APIRouter(prefix="/ws", tags=["websocket"])

# Global WebSocket connection manager
connection_manager = None


async def initialize_manager():
    global connection_manager
    redis_client = await get_redis()
    connection_manager = ConnectionManager(redis_client)
    await connection_manager.start()
    return connection_manager


async def shutdown_manager():
    if connection_manager:
        await connection_manager.stop()


async def get_connection_manager():
    if connection_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WebSocket service not available",
        )
    return connection_manager


@router.websocket("")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    manager: ConnectionManager = Depends(get_connection_manager),
    redis: RedisClient = Depends(get_redis),
):
    try:
        payload = await validate_websocket_token(token)
        user_id = payload.get("sub")
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    connection_id = None
    try:
        connection_id = await manager.connect(websocket, user_id)

        welcome_message = WebSocketMessage(
            type=MessageType.CONNECT,
            data={"connection_id": connection_id, "user_id": user_id},
            timestamp=time.time(),
        )
        await manager.send_message(connection_id, welcome_message)

        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message_type = message_data.get("type")

                await manager.update_heartbeat(connection_id)

                if message_type == MessageType.HEARTBEAT:
                    # Wyślij odpowiedź heartbeat
                    heartbeat_response = WebSocketMessage(
                        type=MessageType.HEARTBEAT, data=None, timestamp=time.time()
                    )
                    await manager.send_message(connection_id, heartbeat_response)

                elif message_type == MessageType.JOIN_CHANNEL:
                    channel = message_data.get("channel")
                    if channel:
                        try:
                            await manager.join_channel(connection_id, channel)

                            # DODAJ: Wyślij potwierdzenie dołączenia do kanału
                            join_response = WebSocketMessage(
                                type=MessageType.JOIN_CHANNEL,
                                data={
                                    "success": True,
                                    "message": f"Successfully joined channel '{channel}'",
                                },
                                channel=channel,
                                timestamp=time.time(),
                            )
                            await manager.send_message(connection_id, join_response)
                            logger.info(f"User {user_id} joined channel {channel}")

                        except Exception as e:
                            # DODAJ: Wyślij błąd przy niepowodzeniu
                            error_response = WebSocketMessage(
                                type=MessageType.JOIN_CHANNEL,
                                data={"success": False, "error": str(e)},
                                channel=channel,
                                timestamp=time.time(),
                            )
                            await manager.send_message(connection_id, error_response)
                            logger.error(f"Failed to join channel {channel}: {e}")

                elif message_type == MessageType.LEAVE_CHANNEL:
                    channel = message_data.get("channel")
                    if channel:
                        try:
                            await manager.leave_channel(connection_id, channel)

                            # DODAJ: Wyślij potwierdzenie opuszczenia kanału
                            leave_response = WebSocketMessage(
                                type=MessageType.LEAVE_CHANNEL,
                                data={
                                    "success": True,
                                    "message": f"Successfully left channel '{channel}'",
                                },
                                channel=channel,
                                timestamp=time.time(),
                            )
                            await manager.send_message(connection_id, leave_response)
                            logger.info(f"User {user_id} left channel {channel}")

                        except Exception as e:
                            # DODAJ: Wyślij błąd przy niepowodzeniu
                            error_response = WebSocketMessage(
                                type=MessageType.LEAVE_CHANNEL,
                                data={"success": False, "error": str(e)},
                                channel=channel,
                                timestamp=time.time(),
                            )
                            await manager.send_message(connection_id, error_response)
                            logger.error(f"Failed to leave channel {channel}: {e}")

                elif message_type == MessageType.BROADCAST:
                    channel = message_data.get("channel")
                    content = message_data.get("message")  # ZMIEŃ z "data" na "message"

                    if channel and content:
                        broadcast_message = WebSocketMessage(
                            type=MessageType.MESSAGE,
                            data={
                                "message": content,
                                "user": user_id,
                            },  # Dodaj dane użytkownika
                            channel=channel,
                            sender=user_id,
                            timestamp=time.time(),
                        )
                        await manager.broadcast_to_channel(channel, broadcast_message)

                else:
                    logger.warning(f"Unknown message type: {message_type}")

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from client: {data}")
                error_message = WebSocketMessage(
                    type=MessageType.ERROR,
                    data={"message": "Invalid JSON format"},
                    timestamp=time.time(),
                )
                await manager.send_message(connection_id, error_message)

            except Exception as e:
                logger.error(f"Error handling message: {e}")
                error_message = WebSocketMessage(
                    type=MessageType.ERROR,
                    data={"message": "Internal server error"},
                    timestamp=time.time(),
                )
                await manager.send_message(connection_id, error_message)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if connection_id:
            await manager.disconnect(connection_id)


@router.post("/broadcast", status_code=status.HTTP_200_OK)
async def broadcast_message(
    channel: str,
    message: Dict[str, Any],
    manager: ConnectionManager = Depends(get_connection_manager),
):
    """REST API endpoint to broadcast a message to a channel."""
    broadcast_message = WebSocketMessage(
        type=MessageType.MESSAGE,
        data=message,
        channel=channel,
        sender="system",
        timestamp=time.time(),
    )

    await manager.broadcast_to_channel(channel, broadcast_message)
    return {"status": "success", "message": "Broadcast sent"}


@router.get("/status", status_code=status.HTTP_200_OK)
async def get_status(
    manager: ConnectionManager = Depends(get_connection_manager),
):
    """Get WebSocket service status."""
    return {
        "active_connections": manager.get_connection_count(),
        "server_id": manager.server_id,
    }
