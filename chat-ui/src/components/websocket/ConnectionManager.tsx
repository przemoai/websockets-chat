'use client';

import { useWebSocketContext } from '../../contexts/WebSocketContext';

export default function ConnectionManager() {
  const {
    isConnected,
    stats,
    token,
    wsUrl,
    setWsUrl,
    connect,
    disconnect
  } = useWebSocketContext();

  return (
    <div className="card">
      <div className="card__header">
        <h2>WebSocket Connection</h2>
      </div>
      <div className="card__body">
        <div className="form-group">
          <label htmlFor="wsUrl" className="form-label">WebSocket URL</label>
          <input
            id="wsUrl"
            type="text"
            className="form-control"
            value={wsUrl}
            onChange={(e) => setWsUrl(e.target.value)}
            disabled={isConnected}
          />
        </div>
        <div className="form-group">
          <label htmlFor="jwtToken" className="form-label">JWT Token</label>
          <input
            id="jwtToken"
            type="text"
            className="form-control"
            value={token}
            readOnly
            disabled
          />
        </div>
        <div className="form-group">
          <button
            className="btn btn--primary"
            onClick={connect}
            disabled={isConnected || !token}
            title={!token ? "Please login first to get JWT token" : ""}
          >
            Connect
          </button>
          <button
            className="btn btn--secondary"
            onClick={disconnect}
            disabled={!isConnected}
          >
            Disconnect
          </button>
        </div>

        <div className="connection-status">
          <div className="status-indicator">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>

          <div className="connection-stats">
            <div>Messages Sent: <span>{stats.messagesSent}</span></div>
            <div>Messages Received: <span>{stats.messagesReceived}</span></div>
            <div>Last Heartbeat: <span>
              {stats.lastHeartbeat
                ? new Date(stats.lastHeartbeat).toLocaleTimeString()
                : 'Never'}
            </span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
