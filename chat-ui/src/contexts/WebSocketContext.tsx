import {createContext, ReactNode, useContext, useState} from 'react';
import {useWebSocket, WebSocketMessage} from '../hooks/useWebSocket';

interface WebSocketContextType {
  isConnected: boolean;
  messages: WebSocketMessage[];
  joinedChannels: string[];
  stats: {
    messagesSent: number;
    messagesReceived: number;
    lastHeartbeat: Date | null;
  };
  token: string;
  setToken: (token: string) => void;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  connect: () => void;
  disconnect: () => void;
  joinChannel: (channel: string) => void;
  leaveChannel: (channel: string) => void;
  sendBroadcastMessage: (channel: string, message: string) => void;
  clearLog: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState('');
  const [wsUrl, setWsUrl] = useState('ws://localhost:8000/ws');

  const {
    isConnected,
    messages,
    joinedChannels,
    stats,
    connect,
    disconnect,
    joinChannel,
    leaveChannel,
    sendBroadcastMessage,
    clearLog
  } = useWebSocket(wsUrl, token);

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      messages,
      joinedChannels,
      stats,
      token,
      setToken,
      wsUrl,
      setWsUrl,
      connect,
      disconnect,
      joinChannel,
      leaveChannel,
      sendBroadcastMessage,
      clearLog
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
