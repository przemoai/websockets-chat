'use client';

import { useState } from 'react';
import { useWebSocketContext } from '../../contexts/WebSocketContext';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ message: '', type: 'info' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const { setToken } = useWebSocketContext();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!username || !password) {
      setStatus({ message: 'Please enter username and password', type: 'error' });
      return;
    }

    setIsLoggingIn(true);

    try {
      const response = await fetch('http://localhost:8000/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        setStatus({
          message: `✓ Authenticated as ${username}. Now you can connect to WebSocket.`,
          type: 'success'
        });
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
        setStatus({ message: `Login failed: ${errorData.detail}`, type: 'error' });
      }
    } catch (error) {
      setStatus({
        message: 'Cannot connect to server. Please ensure FastAPI server is running.',
        type: 'error'
      });
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2>Authentication</h2>
      </div>
      <div className="card__body">
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username" className="form-label">Username</label>
            <input
              id="username"
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin(e)}
            />
          </div>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {status.message && (
          <div className={`auth-status ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
