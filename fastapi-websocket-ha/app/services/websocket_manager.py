import asyncio
import json
import time
import uuid
from typing import Dict, List, Optional

from fastapi import WebSocket
from app.core.config import settings
from app.core.logger import logger
from app.models.websocket import (
    ConnectionInfo,
    MessageType,
    WebSocketMessage,
    ChannelMessage,
)
from app.services.redis_client import RedisClient


class ConnectionManager:
    def __init__(self, redis_client: RedisClient):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, str] = {}  # user_id -> connection_id
        self.connection_info: Dict[str, ConnectionInfo] = {}  # connection_id -> info
        self.redis_client = redis_client
        self.server_id = str(uuid.uuid4())[:8]  # Unique server identifier
        self.heartbeat_task: Optional[asyncio.Task] = None
        self.redis_listener_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the connection manager services."""
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        self.redis_listener_task = asyncio.create_task(self._redis_listener())

        logger.info(f"Connection manager started for server {self.server_id}")

    async def stop(self):
        """Stop the connection manager services."""
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        if self.redis_listener_task:
            self.redis_listener_task.cancel()

        for connection_id in list(self.active_connections.keys()):
            await self.disconnect(connection_id)

        logger.info(f"Connection manager stopped for server {self.server_id}")

    async def connect(self, websocket: WebSocket, user_id: str) -> str:
        """Accept a new WebSocket connection."""
        if len(self.active_connections) >= settings.MAX_CONNECTIONS:
            await websocket.close(code=1008, reason="Connection limit exceeded")
            raise ValueError("Connection limit exceeded")

        await websocket.accept()

        connection_id = str(uuid.uuid4())
        current_time = time.time()

        self.active_connections[connection_id] = websocket
        self.user_connections[user_id] = connection_id

        connection_info = ConnectionInfo(
            user_id=user_id,
            connection_id=connection_id,
            connected_at=current_time,
            last_heartbeat=current_time,
        )
        self.connection_info[connection_id] = connection_info

        await self.redis_client.set_with_expiry(
            f"{settings.WS_CHANNEL_PREFIX}connection:{connection_id}",
            {
                "user_id": user_id,
                "server_id": self.server_id,
                "connected_at": current_time,
            },
            expiry=7200,  # 2 hours
        )

        await self.redis_client.add_to_set(
            f"{settings.WS_CHANNEL_PREFIX}server:{self.server_id}:connections",
            connection_id,
        )

        logger.info(f"User {user_id} connected with connection {connection_id}")

        await self._subscribe_to_redis_channels()

        return connection_id

    async def disconnect(self, connection_id: str):
        """Disconnect a WebSocket connection."""
        if connection_id not in self.active_connections:
            return

        connection_info = self.connection_info.get(connection_id)
        if connection_info:
            user_id = connection_info.user_id

            for channel in connection_info.channels:
                await self._leave_channel_internal(connection_id, channel)

            del self.active_connections[connection_id]
            del self.connection_info[connection_id]
            if user_id in self.user_connections:
                del self.user_connections[user_id]

            await self.redis_client.delete(
                f"{settings.WS_CHANNEL_PREFIX}connection:{connection_id}"
            )
            await self.redis_client.remove_from_set(
                f"{settings.WS_CHANNEL_PREFIX}server:{self.server_id}:connections",
                connection_id,
            )

            logger.info(f"User {user_id} disconnected (connection {connection_id})")

    async def send_message(self, connection_id: str, message: WebSocketMessage):
        """Send a message to a specific connection."""
        websocket = self.active_connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_json(message.dict())
            except Exception as e:
                logger.error(f"Failed to send message to {connection_id}: {e}")
                await self.disconnect(connection_id)

    async def broadcast_to_channel(
        self,
        channel: str,
        message: WebSocketMessage,
        exclude_users: Optional[List[str]] = None,
    ):
        """Broadcast a message to all connections in a channel."""
        exclude_users = exclude_users or []

        local_sent = 0
        for connection_id, info in self.connection_info.items():
            if channel in info.channels and info.user_id not in exclude_users:
                await self.send_message(connection_id, message)
                local_sent += 1

        channel_message = ChannelMessage(
            channel=channel, message=message, exclude_users=exclude_users
        )

        await self.redis_client.publish(
            f"{settings.WS_CHANNEL_PREFIX}channel:{channel}",
            {
                "type": "channel_message",
                "data": channel_message.dict(),
                "server_id": self.server_id,
            },
        )

        logger.debug(
            f"Broadcasted to channel '{channel}': {local_sent} local connections"
        )

    async def join_channel(self, connection_id: str, channel: str):
        """Add a connection to a channel."""
        if connection_id not in self.connection_info:
            return

        connection_info = self.connection_info[connection_id]
        if channel not in connection_info.channels:
            connection_info.channels.append(channel)

            await self.redis_client.add_to_set(
                f"{settings.WS_CHANNEL_PREFIX}channel:{channel}:members", connection_id
            )

            logger.info(f"Connection {connection_id} joined channel '{channel}'")

    async def leave_channel(self, connection_id: str, channel: str):
        """Remove a connection from a channel."""
        await self._leave_channel_internal(connection_id, channel)

    async def _leave_channel_internal(self, connection_id: str, channel: str):
        """Internal method to leave a channel."""
        if connection_id not in self.connection_info:
            return

        connection_info = self.connection_info[connection_id]
        if channel in connection_info.channels:
            connection_info.channels.remove(channel)

            await self.redis_client.remove_from_set(
                f"{settings.WS_CHANNEL_PREFIX}channel:{channel}:members", connection_id
            )

            logger.info(f"Connection {connection_id} left channel '{channel}'")

    async def update_heartbeat(self, connection_id: str):
        """Update the heartbeat timestamp for a connection."""
        if connection_id in self.connection_info:
            self.connection_info[connection_id].last_heartbeat = time.time()

    async def _heartbeat_loop(self):
        """Send periodic heartbeats to all connections."""
        while True:
            try:
                await asyncio.sleep(settings.WS_HEARTBEAT_INTERVAL)

                current_time = time.time()
                disconnected_connections = []

                for connection_id, info in self.connection_info.items():
                    if info.last_heartbeat and (current_time - info.last_heartbeat) > (
                        settings.WS_HEARTBEAT_INTERVAL * 2
                    ):
                        disconnected_connections.append(connection_id)
                        continue

                    heartbeat_message = WebSocketMessage(
                        type=MessageType.HEARTBEAT, timestamp=current_time
                    )
                    await self.send_message(connection_id, heartbeat_message)

                for connection_id in disconnected_connections:
                    logger.warning(f"Disconnecting stale connection: {connection_id}")
                    await self.disconnect(connection_id)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")

    async def _subscribe_to_redis_channels(self):
        """Subscribe to Redis channels for cross-server communication."""
        try:
            pubsub = await self.redis_client.subscribe(
                f"{settings.WS_CHANNEL_PREFIX}broadcast",
                f"{settings.WS_CHANNEL_PREFIX}server:{self.server_id}",
            )

        except Exception as e:
            logger.error(f"Failed to subscribe to Redis channels: {e}")

    async def _redis_listener(self):
        """Listen for Redis pub/sub messages."""
        try:
            pubsub = await self.redis_client.subscribe(
                f"{settings.WS_CHANNEL_PREFIX}broadcast",
                f"{settings.WS_CHANNEL_PREFIX}server:{self.server_id}",
            )

            async for message in pubsub.listen():
                if message["type"] == "message":
                    await self._handle_redis_message(message)

        except asyncio.CancelledError:
            logger.info("Redis listener cancelled")
        except Exception as e:
            logger.error(f"Error in Redis listener: {e}")

    async def _handle_redis_message(self, message):
        """Handle incoming Redis pub/sub messages."""
        try:
            data = json.loads(message["data"])
            message_type = data.get("type")
            sender_server_id = data.get("server_id")

            if sender_server_id == self.server_id:
                return

            if message_type == "channel_message":
                channel_message = ChannelMessage(**data["data"])

                for connection_id, info in self.connection_info.items():
                    if (
                        channel_message.channel in info.channels
                        and info.user_id not in (channel_message.exclude_users or [])
                    ):
                        await self.send_message(connection_id, channel_message.message)

        except Exception as e:
            logger.error(f"Error handling Redis message: {e}")

    def get_connection_count(self) -> int:
        """Get the number of active connections on this server."""
        return len(self.active_connections)

    def get_connections_info(self) -> Dict[str, ConnectionInfo]:
        """Get information about all connections."""
        return self.connection_info.copy()
