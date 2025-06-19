'use client';

import Image from 'next/image';
import LoginForm from '../components/auth/LoginForm';
import ConnectionManager from '../components/websocket/ConnectionManager';
import ChannelManager from '../components/websocket/ChannelManager';
import MessageLog from '../components/websocket/MessageLog';
import { WebSocketProvider } from '../contexts/WebSocketContext';

export default function Home() {
  return (
    <WebSocketProvider>
      <div className="container">
        <header className="header">
          <h1>FastAPI WebSocket Test Client</h1>
          <div className="architecture-image">
            <Image
              src="/fastapi_websocket_architecture.png"
              alt="FastAPI WebSocket Architecture"
              width={800}
              height={400}
              priority
            />
          </div>
        </header>

        <main className="main-content">
          <LoginForm />
          <ConnectionManager />
          <ChannelManager />
          <MessageLog />
        </main>
      </div>
    </WebSocketProvider>
  );
}
