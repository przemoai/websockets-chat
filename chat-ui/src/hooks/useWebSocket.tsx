import { useState, useCallback, useRef } from 'react';

export interface WebSocketMessage {
  type: string;
  channel?: string;
  message?: string;
  timestamp: string;
}

export function useWebSocket(url: string, token?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [joinedChannels, setJoinedChannels] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    messagesSent: 0,
    messagesReceived: 0,
    lastHeartbeat: null as Date | null,
  });
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!token) return;

    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      addLogMessage('WebSocket connection established', 'system');
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      addLogMessage(`WebSocket connection closed (Code: ${event.code})`, 'system');
    };

    ws.onmessage = (event) => {
      setStats(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1
      }));

      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        addLogMessage(`Received invalid JSON: ${event.data}`, 'error');
      }
    };

    wsRef.current = ws;

    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        sendMessage({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        });
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      ws.close();
    };
  }, [token, url]);

  const handleMessage = useCallback((data: any) => {
    switch(data.type) {
      case 'heartbeat':
        setStats(prev => ({
          ...prev,
          lastHeartbeat: new Date()
        }));
        addLogMessage('Heartbeat acknowledged', 'heartbeat');
        break;
      case 'join_channel':
        if (data.data?.success !== false) {
          setJoinedChannels(prev => {
            const updated = new Set(prev);
            updated.add(data.channel);
            return updated;
          });
          addLogMessage(`Successfully joined channel: ${data.channel}`, 'system');
        } else {
          addLogMessage(`Failed to join channel: ${data.channel}`, 'error');
        }
        break;
      case 'leave_channel':
        if (data.data?.success !== false) {
          setJoinedChannels(prev => {
            const updated = new Set(prev);
            updated.delete(data.channel);
            return updated;
          });
          addLogMessage(`Successfully left channel: ${data.channel}`, 'system');
        } else {
          addLogMessage(`Failed to leave channel: ${data.channel}`, 'error');
        }
        break;
      case 'broadcast':
      case 'message':
        const user = data.data?.user || data.sender || 'Unknown';
        const message = data.data?.message || data.data;
        addLogMessage(`[${data.channel}] ${user}: ${message}`, 'message');
        break;
      default:
        addLogMessage(`Received: ${JSON.stringify(data)}`, 'message');
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      setStats(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1
      }));

      if (message.type !== 'heartbeat') {
        addLogMessage(`Sent: ${JSON.stringify(message)}`, 'message');
      }
    } else {
      addLogMessage('Cannot send message: WebSocket is not connected', 'error');
    }
  }, []);

  const joinChannel = useCallback((channelName: string) => {
    if (!isConnected) {
      addLogMessage('Not connected to WebSocket', 'error');
      return;
    }

    if (joinedChannels.has(channelName)) {
      addLogMessage(`Already joined channel: ${channelName}`, 'error');
      return;
    }

    sendMessage({
      type: 'join_channel',
      channel: channelName,
      timestamp: new Date().toISOString()
    });
  }, [isConnected, joinedChannels, sendMessage]);

  const leaveChannel = useCallback((channelName: string) => {
    if (!isConnected) {
      addLogMessage('Not connected to WebSocket', 'error');
      return;
    }

    if (!joinedChannels.has(channelName)) {
      addLogMessage(`Not joined to channel: ${channelName}`, 'error');
      return;
    }

    sendMessage({
      type: 'leave_channel',
      channel: channelName,
      timestamp: new Date().toISOString()
    });
  }, [isConnected, joinedChannels, sendMessage]);

  const sendBroadcastMessage = useCallback((channel: string, text: string) => {
    if (!isConnected) {
      addLogMessage('Not connected to WebSocket', 'error');
      return;
    }

    if (!joinedChannels.has(channel)) {
      addLogMessage(`Not joined to channel: ${channel}`, 'error');
      return;
    }

    sendMessage({
      type: 'broadcast',
      channel,
      message: text,
      timestamp: new Date().toISOString()
    });
  }, [isConnected, joinedChannels, sendMessage]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
      setIsConnected(false);
      addLogMessage('Disconnected from WebSocket server', 'system');
    }
  }, []);

  const addLogMessage = useCallback((message: string, type: 'message' | 'system' | 'error' | 'heartbeat') => {
    setMessages(prev => [...prev, {
      type,
      message,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  const clearLog = useCallback(() => {
    setMessages([]);
    addLogMessage('Message log cleared', 'system');
  }, [addLogMessage]);

  return {
    isConnected,
    messages,
    joinedChannels: Array.from(joinedChannels),
    stats,
    connect,
    disconnect,
    joinChannel,
    leaveChannel,
    sendBroadcastMessage,
    clearLog
  };
}
