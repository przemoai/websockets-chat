class WebSocketTestClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.joinedChannels = new Set();
        this.heartbeatInterval = null;
        this.lastHeartbeat = null;
        this.isAuthenticated = false;
        
        this.config = {
            apiUrl: 'http://localhost:8000',
            websocketUrl: 'ws://localhost:8000/ws',
            defaultUsername: 'demo',
            defaultPassword: 'password'
        };
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateUI();
        this.showInitialGuidance();
    }
    
    initializeElements() {
        // Authentication elements
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginBtn = document.getElementById('loginBtn');
        this.authStatus = document.getElementById('authStatus');
        
        // Connection elements
        this.wsUrlInput = document.getElementById('wsUrl');
        this.jwtTokenInput = document.getElementById('jwtToken');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.messagesSentSpan = document.getElementById('messagesSent');
        this.messagesReceivedSpan = document.getElementById('messagesReceived');
        this.lastHeartbeatSpan = document.getElementById('lastHeartbeat');
        
        // Channel elements
        this.channelInput = document.getElementById('channelInput');
        this.joinChannelBtn = document.getElementById('joinChannelBtn');
        this.leaveChannelBtn = document.getElementById('leaveChannelBtn');
        this.channelsList = document.getElementById('channelsList');
        
        // Message elements
        this.messageChannelSelect = document.getElementById('messageChannel');
        this.messageTextArea = document.getElementById('messageText');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        
        // Log elements
        this.messageLog = document.getElementById('messageLog');
        this.clearLogBtn = document.getElementById('clearLogBtn');
    }
    
    attachEventListeners() {
        this.loginBtn.addEventListener('click', () => this.login());
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.joinChannelBtn.addEventListener('click', () => this.joinChannel());
        this.leaveChannelBtn.addEventListener('click', () => this.leaveChannel());
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.clearLogBtn.addEventListener('click', () => this.clearLog());
        
        // Enter key handlers
        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        this.channelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChannel();
        });
        
        this.messageTextArea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }
    
    showInitialGuidance() {
        this.showAuthStatus('Please login first to get a JWT token, then connect to WebSocket', 'info');
        this.logMessage('Welcome to FastAPI WebSocket Test Client', 'system');
        this.logMessage('Step 1: Enter credentials and click Login to authenticate', 'system');
        this.logMessage('Step 2: After getting JWT token, click Connect to establish WebSocket connection', 'system');
        this.logMessage('Step 3: Join channels to start sending/receiving messages', 'system');
        this.logMessage('Note: Make sure your FastAPI server is running on localhost:8000', 'system');
    }
    
    async login() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();
        
        if (!username || !password) {
            this.showAuthStatus('Please enter username and password', 'error');
            return;
        }
        
        this.loginBtn.textContent = 'Logging in...';
        this.loginBtn.disabled = true;
        this.loginBtn.classList.add('loading');
        
        try {
            // Add timeout to prevent infinite loading state
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`${this.config.apiUrl}/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.jwtTokenInput.value = data.access_token;
                this.isAuthenticated = true;
                this.showAuthStatus(`✓ Authenticated as ${username}. Now you can connect to WebSocket.`, 'success');
                this.logMessage(`Authentication successful for user: ${username}`, 'system');
                this.logMessage('You can now click Connect to establish WebSocket connection', 'system');
            } else {
                const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
                this.showAuthStatus(`Login failed: ${errorData.detail}`, 'error');
                this.logMessage(`Authentication failed: ${errorData.detail}`, 'error');
                this.isAuthenticated = false;
            }
        } catch (error) {
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = 'Login request timed out. Please check if the server is running.';
            } else if (error.message.includes('fetch')) {
                errorMessage = 'Cannot connect to server. Please ensure FastAPI server is running on localhost:8000';
            }
            
            this.showAuthStatus(`Login error: ${errorMessage}`, 'error');
            this.logMessage(`Authentication error: ${errorMessage}`, 'error');
            this.logMessage('Tip: Start your FastAPI server with: uvicorn main:app --reload', 'system');
            this.isAuthenticated = false;
        } finally {
            this.loginBtn.textContent = 'Login';
            this.loginBtn.disabled = false;
            this.loginBtn.classList.remove('loading');
            this.updateUI();
        }
    }
    
    connect() {
        const wsUrl = this.wsUrlInput.value.trim();
        const token = this.jwtTokenInput.value.trim();
        
        if (!wsUrl) {
            this.logMessage('WebSocket URL is required', 'error');
            return;
        }
        
        if (!token) {
            this.logMessage('JWT token is required. Please login first to get a token.', 'error');
            this.showAuthStatus('Please login first to get JWT token', 'error');
            return;
        }
        
        if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
            this.disconnect();
        }
        
        this.updateConnectionStatus('connecting');
        this.logMessage(`Attempting to connect to ${wsUrl}...`, 'system');
        this.connectBtn.disabled = true;
        this.connectBtn.textContent = 'Connecting...';
        
        try {
            // Add token as query parameter
            const wsUrlWithToken = `${wsUrl}?token=${encodeURIComponent(token)}`;
            this.ws = new WebSocket(wsUrlWithToken);
            
            // Set connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.ws.readyState === WebSocket.CONNECTING) {
                    this.ws.close();
                    this.logMessage('Connection timeout. Please check if the WebSocket server is running.', 'error');
                    this.updateConnectionStatus('disconnected');
                    this.connectBtn.disabled = false;
                    this.connectBtn.textContent = 'Connect';
                }
            }, 10000);
            
            this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                this.logMessage('✓ WebSocket connection established successfully', 'system');
                this.logMessage('You can now join channels and send messages', 'system');
                this.startHeartbeat();
                this.connectBtn.textContent = 'Connect';
                this.updateUI();
            };
            
            this.ws.onmessage = (event) => {
                this.messagesReceived++;
                this.updateStats();
                
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    this.logMessage(`Received invalid JSON: ${event.data}`, 'error');
                }
            };
            
            this.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.stopHeartbeat();
                
                let reason = 'Unknown';
                if (event.code === 1000) reason = 'Normal closure';
                else if (event.code === 1001) reason = 'Going away';
                else if (event.code === 1002) reason = 'Protocol error';
                else if (event.code === 1003) reason = 'Unsupported data';
                else if (event.code === 1006) reason = 'Abnormal closure';
                else if (event.code === 1011) reason = 'Server error';
                else if (event.code === 4001) reason = 'Authentication failed';
                
                this.logMessage(`WebSocket connection closed (Code: ${event.code}, Reason: ${reason})`, 'system');
                this.connectBtn.textContent = 'Connect';
                this.updateUI();
            };
            
            this.ws.onerror = (error) => {
                clearTimeout(connectionTimeout);
                this.logMessage('WebSocket connection error. Please check server status.', 'error');
                this.connectBtn.disabled = false;
                this.connectBtn.textContent = 'Connect';
                this.updateConnectionStatus('disconnected');
            };
            
        } catch (error) {
            this.logMessage(`Connection error: ${error.message}`, 'error');
            this.connectBtn.disabled = false;
            this.connectBtn.textContent = 'Connect';
            this.updateConnectionStatus('disconnected');
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        this.isConnected = false;
        this.stopHeartbeat();
        this.updateConnectionStatus('disconnected');
        this.logMessage('Disconnected from WebSocket server', 'system');
        this.updateUI();
    }
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                const heartbeatMsg = {
                    type: 'heartbeat',
                    timestamp: new Date().toISOString()
                };
                this.sendWebSocketMessage(heartbeatMsg);
            }
        }, 30000); // Send heartbeat every 30 seconds
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    joinChannel() {
        const channelName = this.channelInput.value.trim();
        if (!channelName) {
            this.logMessage('Channel name is required', 'error');
            return;
        }
        
        if (!this.isConnected) {
            this.logMessage('Not connected to WebSocket. Please connect first.', 'error');
            return;
        }
        
        if (this.joinedChannels.has(channelName)) {
            this.logMessage(`Already joined channel: ${channelName}`, 'error');
            return;
        }
        
        const message = {
            type: 'join_channel',
            channel: channelName,
            timestamp: new Date().toISOString()
        };
        
        this.sendWebSocketMessage(message);
        this.channelInput.value = '';
    }
    
    leaveChannel() {
        const channelName = this.channelInput.value.trim();
        if (!channelName) {
            this.logMessage('Channel name is required', 'error');
            return;
        }
        
        if (!this.isConnected) {
            this.logMessage('Not connected to WebSocket. Please connect first.', 'error');
            return;
        }
        
        if (!this.joinedChannels.has(channelName)) {
            this.logMessage(`Not joined to channel: ${channelName}`, 'error');
            return;
        }
        
        const message = {
            type: 'leave_channel',
            channel: channelName,
            timestamp: new Date().toISOString()
        };
        
        this.sendWebSocketMessage(message);
        this.channelInput.value = '';
    }
    
    sendMessage() {
        const channel = this.messageChannelSelect.value;
        const text = this.messageTextArea.value.trim();
        
        if (!text) {
            this.logMessage('Message text is required', 'error');
            return;
        }
        
        if (!channel) {
            this.logMessage('Please select a channel to send message to', 'error');
            return;
        }
        
        if (!this.isConnected) {
            this.logMessage('Not connected to WebSocket. Please connect first.', 'error');
            return;
        }
        
        const message = {
            type: 'broadcast',
            channel: channel,
            message: text,
            timestamp: new Date().toISOString()
        };
        
        this.sendWebSocketMessage(message);
        this.messageTextArea.value = '';
        this.logMessage(`Message sent to channel '${channel}': ${text}`, 'system');
    }
    
    sendWebSocketMessage(message) {
        if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            this.messagesSent++;
            this.updateStats();
            
            if (message.type !== 'heartbeat') {
                this.logMessage(`Sent: ${messageStr}`, 'message');
            }
        } else {
            this.logMessage('Cannot send message: WebSocket is not connected', 'error');
        }
    }
    
    handleMessage(data) {
    switch (data.type) {
        case 'heartbeat':
            this.lastHeartbeat = new Date();
            this.updateStats();
            this.logMessage(`Heartbeat acknowledged`, 'heartbeat');
            break;

        case 'join_channel':
            // POPRAW: Sprawdź strukturę odpowiedzi
            if (data.data && data.data.success !== false) {
                this.joinedChannels.add(data.channel);
                this.updateChannelsList();
                this.logMessage(`✓ Successfully joined channel: ${data.channel}`, 'system');
            } else {
                const error = data.data ? data.data.error : 'Unknown error';
                this.logMessage(`✗ Failed to join channel: ${data.channel} - ${error}`, 'error');
            }
            break;

        case 'leave_channel':
            // POPRAW: Sprawdź strukturę odpowiedzi
            if (data.data && data.data.success !== false) {
                this.joinedChannels.delete(data.channel);
                this.updateChannelsList();
                this.logMessage(`✓ Successfully left channel: ${data.channel}`, 'system');
            } else {
                const error = data.data ? data.data.error : 'Unknown error';
                this.logMessage(`✗ Failed to leave channel: ${data.channel} - ${error}`, 'error');
            }
            break;

        case 'broadcast':
        case 'message':
            // POPRAW: Lepsze formatowanie wiadomości
            const user = data.data && data.data.user ? data.data.user : (data.sender || 'Unknown');
            const message = data.data && data.data.message ? data.data.message : data.data;
            this.logMessage(`📨 [${data.channel}] ${user}: ${message}`, 'message');
            break;

        case 'error':
            this.logMessage(`Server error: ${data.data?.message || JSON.stringify(data)}`, 'error');
            break;

        default:
            this.logMessage(`Received: ${JSON.stringify(data)}`, 'message');
    }
}

    
    updateConnectionStatus(status) {
        const statusIndicator = this.connectionStatus.querySelector('.status-indicator');
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('span:last-child');
        
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    updateStats() {
        this.messagesSentSpan.textContent = this.messagesSent;
        this.messagesReceivedSpan.textContent = this.messagesReceived;
        this.lastHeartbeatSpan.textContent = this.lastHeartbeat 
            ? this.lastHeartbeat.toLocaleTimeString() 
            : 'Never';
    }
    
    updateChannelsList() {
        this.channelsList.innerHTML = '';
        
        if (this.joinedChannels.size === 0) {
            this.channelsList.innerHTML = '<span style="color: var(--color-text-secondary); font-style: italic;">No channels joined</span>';
        } else {
            this.joinedChannels.forEach(channel => {
                const channelTag = document.createElement('div');
                channelTag.className = 'channel-tag';
                channelTag.innerHTML = `
                    <span>${channel}</span>
                    <button class="remove-btn" data-channel="${channel}" title="Leave channel">×</button>
                `;
                
                channelTag.querySelector('.remove-btn').addEventListener('click', () => {
                    this.channelInput.value = channel;
                    this.leaveChannel();
                });
                
                this.channelsList.appendChild(channelTag);
            });
        }
        
        // Update message channel selector
        this.updateMessageChannelSelector();
    }
    
    updateMessageChannelSelector() {
        const currentValue = this.messageChannelSelect.value;
        this.messageChannelSelect.innerHTML = '<option value="">Select channel...</option>';
        
        this.joinedChannels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel;
            option.textContent = channel;
            this.messageChannelSelect.appendChild(option);
        });
        
        // Restore selection if still valid
        if (this.joinedChannels.has(currentValue)) {
            this.messageChannelSelect.value = currentValue;
        }
    }
    
    updateUI() {
        // Connection buttons
        this.connectBtn.disabled = this.isConnected || !this.isAuthenticated;
        this.disconnectBtn.disabled = !this.isConnected;
        
        // Channel management
        this.joinChannelBtn.disabled = !this.isConnected;
        this.leaveChannelBtn.disabled = !this.isConnected;
        
        // Message sending
        this.sendMessageBtn.disabled = !this.isConnected || this.joinedChannels.size === 0;
        
        // Update connect button text based on authentication status
        if (!this.isAuthenticated && !this.isConnected) {
            this.connectBtn.title = "Please login first to get JWT token";
        } else if (this.isAuthenticated && !this.isConnected) {
            this.connectBtn.title = "Click to connect to WebSocket server";
        }
    }
    
    showAuthStatus(message, type) {
        this.authStatus.textContent = message;
        this.authStatus.className = `auth-status ${type}`;
        
        // Add info type styling if not defined
        if (type === 'info') {
            this.authStatus.style.backgroundColor = 'rgba(var(--color-info-rgb), 0.1)';
            this.authStatus.style.color = 'var(--color-info)';
            this.authStatus.style.border = '1px solid rgba(var(--color-info-rgb), 0.2)';
        }
    }
    
    logMessage(message, type = 'message') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'log-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        const content = document.createElement('div');
        content.className = 'log-content';
        content.textContent = message;
        
        // Try to format JSON if it's a message type
        if ((type === 'message' && message.startsWith('Received:')) || message.startsWith('Sent:')) {
            try {
                const jsonStr = message.substring(message.indexOf('{'));
                const jsonObj = JSON.parse(jsonStr);
                const jsonDiv = document.createElement('div');
                jsonDiv.className = 'log-json';
                jsonDiv.textContent = JSON.stringify(jsonObj, null, 2);
                content.appendChild(jsonDiv);
            } catch (e) {
                // Not JSON or malformed, keep as is
            }
        }
        
        logEntry.appendChild(timestamp);
        logEntry.appendChild(content);
        
        this.messageLog.appendChild(logEntry);
        this.messageLog.scrollTop = this.messageLog.scrollHeight;
        
        // Limit log entries to prevent memory issues
        if (this.messageLog.children.length > 500) {
            this.messageLog.removeChild(this.messageLog.firstChild);
        }
    }
    
    clearLog() {
        this.messageLog.innerHTML = '';
        this.logMessage('Message log cleared', 'system');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.wsClient = new WebSocketTestClient();
});

// Add some sample channels to the channel input for convenience
document.addEventListener('DOMContentLoaded', () => {
    const channelInput = document.getElementById('channelInput');
    const sampleChannels = ['general', 'test-channel', 'chat', 'notifications'];
    
    channelInput.addEventListener('focus', () => {
        if (!channelInput.value) {
            channelInput.placeholder = `Try: ${sampleChannels.join(', ')}`;
        }
    });
    
    channelInput.addEventListener('blur', () => {
        channelInput.placeholder = 'Enter channel name';
    });
});