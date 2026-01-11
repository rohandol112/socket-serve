'use client';

import { useEffect, useState, useRef } from 'react';
import { connect } from 'socket-serve/client';
import type { ClientSocket } from 'socket-serve';

interface Message {
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

export default function ChatApp() {
  const [socket, setSocket] = useState<ClientSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [isUsernameSet, setIsUsernameSet] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<ClientSocket | null>(null);

  useEffect(() => {
    // Prevent double connection in React Strict Mode
    if (socketRef.current) return;

    const newSocket = connect('/api/socket');
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected');
      setConnected(false);
    });

    newSocket.on('message', (data: Message) => {
      // Prevent duplicate messages by checking ID
      setMessages((prev) => {
        if (prev.some(m => m.id === data.id)) {
          return prev; // Already have this message
        }
        return [...prev, data];
      });
    });

    newSocket.on('typing', (data: { username: string }) => {
      setTypingUser(data.username);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUser(null);
      }, 2000);
    });

    newSocket.on('user_joined', (data: { username: string }) => {
      const joinId = `join-${data.username}-${Date.now()}`;
      setMessages((prev) => {
        // Prevent duplicate join messages
        const recentJoin = prev.find(m => 
          m.username === 'System' && 
          m.text === `${data.username} joined the chat` &&
          Date.now() - m.timestamp < 2000
        );
        if (recentJoin) return prev;
        
        return [
          ...prev,
          {
            id: joinId,
            username: 'System',
            text: `${data.username} joined the chat`,
            timestamp: Date.now(),
          },
        ];
      });
    });

    setSocket(newSocket);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Disconnect socket on cleanup
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSetUsername = () => {
    if (!username.trim() || !socket) return;
    
    socket.emit('set_username', { username: username.trim() });
    setIsUsernameSet(true);
  };

  const handleSendMessage = () => {
    if (!message.trim() || !socket || !isUsernameSet) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      username,
      text: message.trim(),
      timestamp: Date.now(),
    };

    socket.emit('message', newMessage);
    setMessages((prev) => [...prev, newMessage]);
    setMessage('');
  };

  // Throttle typing indicator - only send once every 2 seconds
  const lastTypingRef = useRef<number>(0);
  const handleTyping = () => {
    if (!socket || !isUsernameSet) return;
    
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
      lastTypingRef.current = now;
      socket.emit('typing', { username });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: 'username' | 'message') => {
    if (e.key === 'Enter') {
      if (action === 'username') {
        handleSetUsername();
      } else {
        handleSendMessage();
      }
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>💬 Socket-Serve Chat</h1>
        <div className="status">
          <div className={`status-dot ${connected ? '' : 'disconnected'}`}></div>
          <span>{connected ? 'Connected' : 'Connecting...'}</span>
          {isUsernameSet && <span>• {username}</span>}
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>👋 Welcome to the chat!</h3>
            <p>Be the first to send a message</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.username === username ? 'own' : ''} ${
                msg.username === 'System' ? 'system' : ''
              }`}
            >
              <div className="message-bubble">{msg.text}</div>
              <div className="message-info">
                <span>{msg.username}</span>
                <span>•</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
        {typingUser && typingUser !== username && (
          <div className="typing-indicator">{typingUser} is typing...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        {!isUsernameSet ? (
          <div className="username-input">
            <input
              type="text"
              placeholder="Enter your username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, 'username')}
              disabled={!connected}
            />
            <button onClick={handleSetUsername} disabled={!connected || !username.trim()}>
              Join Chat
            </button>
          </div>
        ) : (
          <div className="message-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={(e) => handleKeyPress(e, 'message')}
              disabled={!connected}
            />
            <button onClick={handleSendMessage} disabled={!connected || !message.trim()}>
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
