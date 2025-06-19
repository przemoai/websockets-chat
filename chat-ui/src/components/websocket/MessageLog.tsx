'use client';

import { useRef, useEffect } from 'react';
import { useWebSocketContext } from '../../contexts/WebSocketContext';

export default function MessageLog() {
  const { messages, clearLog } = useWebSocketContext();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  function formatTimestamp(isoString: string) {
    return new Date(isoString).toLocaleTimeString();
  }

  function getEntryClass(type: string) {
    switch (type) {
      case 'message': return 'message';
      case 'system': return 'system';
      case 'error': return 'error';
      case 'heartbeat': return 'heartbeat';
      default: return '';
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2>Message Log</h2>
        <button
          className="btn btn--secondary btn--sm"
          onClick={clearLog}
        >
          Clear Log
        </button>
      </div>
      <div className="message-log" ref={logRef}>
        {messages.map((entry, index) => (
          <div key={index} className={`log-entry ${getEntryClass(entry.type)}`}>
            <div className="log-timestamp">
              {formatTimestamp(entry.timestamp)}
            </div>
            <div className="log-content">
              {entry.message}

              {/* Render JSON if message contains JSON */}
              {entry.message && (entry.message.startsWith('Received:') || entry.message.startsWith('Sent:')) && (
                (() => {
                  try {
                    const jsonStr = entry.message.substring(entry.message.indexOf('{'));
                    const jsonObj = JSON.parse(jsonStr);
                    return (
                      <div className="log-json">
                        {JSON.stringify(jsonObj, null, 2)}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
