'use client';

import { useState } from 'react';
import { useWebSocketContext } from '../../contexts/WebSocketContext';

export default function ChannelManager() {
  const [channelInput, setChannelInput] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');

  const {
    isConnected,
    joinedChannels,
    joinChannel,
    leaveChannel,
    sendBroadcastMessage
  } = useWebSocketContext();

  function handleJoinChannel() {
    if (channelInput.trim()) {
      joinChannel(channelInput.trim());
      setChannelInput('');
    }
  }

  function handleLeaveChannel() {
    if (channelInput.trim()) {
      leaveChannel(channelInput.trim());
      setChannelInput('');
    }
  }

  function handleSendMessage() {
    if (messageText.trim() && selectedChannel) {
      sendBroadcastMessage(selectedChannel, messageText.trim());
      setMessageText('');
    }
  }

  return (
    <div className="card">
      <div className="card__header">
        <h2>Channel Management</h2>
      </div>
      <div className="card__body">
        <div className="form-group">
          <label htmlFor="channelInput" className="form-label">Channel Name</label>
          <input
            id="channelInput"
            type="text"
            className="form-control"
            placeholder="Enter channel name"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinChannel()}
          />
        </div>
        <div className="channel-buttons">
          <button
            className="btn btn--primary"
            onClick={handleJoinChannel}
            disabled={!isConnected}
          >
            Join Channel
          </button>
          <button
            className="btn btn--secondary"
            onClick={handleLeaveChannel}
            disabled={!isConnected}
          >
            Leave Channel
          </button>
        </div>

        <div className="joined-channels">
          <h3>Joined Channels</h3>
          <div className="channels-list">
            {joinedChannels.length === 0 ? (
              <span>No channels joined</span>
            ) : (
              joinedChannels.map(channel => (
                <div key={channel} className="channel-tag">
                  {channel}
                  <button
                    className="remove-btn"
                    onClick={() => leaveChannel(channel)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="form-group">
          <h3>Send Message</h3>
          <div className="form-group">
            <label htmlFor="messageChannel" className="form-label">Target Channel</label>
            <select
              id="messageChannel"
              className="form-control"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              disabled={joinedChannels.length === 0}
            >
              <option value="">Select channel...</option>
              {joinedChannels.map(channel => (
                <option key={channel} value={channel}>{channel}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="messageText" className="form-label">Message</label>
            <textarea
              id="messageText"
              className="form-control"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={!selectedChannel}
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleSendMessage}
            disabled={!isConnected || !selectedChannel}
          >
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
}
