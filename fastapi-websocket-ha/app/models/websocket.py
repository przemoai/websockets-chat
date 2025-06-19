from enum import Enum
from typing import Any, Dict, Optional, List
from pydantic import BaseModel


class MessageType(str, Enum):
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    MESSAGE = "message"
    BROADCAST = "broadcast"
    HEARTBEAT = "heartbeat"
    ERROR = "error"
    JOIN_CHANNEL = "join_channel"
    LEAVE_CHANNEL = "leave_channel"


class WebSocketMessage(BaseModel):
    type: MessageType
    data: Optional[Dict[str, Any]] = None
    channel: Optional[str] = None
    sender: Optional[str] = None
    timestamp: Optional[float] = None


class ConnectionInfo(BaseModel):
    user_id: str
    connection_id: str
    channels: List[str] = []
    connected_at: float
    last_heartbeat: Optional[float] = None


class ChannelMessage(BaseModel):
    channel: str
    message: WebSocketMessage
    exclude_users: Optional[List[str]] = None
