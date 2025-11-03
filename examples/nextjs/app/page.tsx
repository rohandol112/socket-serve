'use client';

import { useEffect, useState } from 'react';
import { connect } from 'socket-serve/client';

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const s = connect('/api/socket');

    s.on('welcome', (data: any) => {
      setMessages(prev => [...prev, `System: ${data.text}`]);
    });

    s.on('chat', (data: any) => {
      setMessages(prev => [...prev, `User: ${data.text}`]);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (socket && input.trim()) {
      socket.emit('chat', { text: input });
      setInput('');
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">socket-serve Demo</h1>
      
      <div className="border rounded p-4 mb-4 h-96 overflow-y-auto bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className="mb-2">{msg}</div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 border rounded px-4 py-2"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </main>
  );
}
