import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import client from '../api/client';

export default function ChatPage() {
  const { requestId } = useParams();
  const { token, user } = useAuth();
  const { messages, dispatch } = useChat();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  // Load history + connect socket
  useEffect(() => {
    // Fetch history
    client.get(`/api/chat/${requestId}/messages`)
      .then(({ data }) => dispatch({ type: 'SET_MESSAGES', payload: data }))
      .catch(() => navigate(-1));

    // Connect Socket.io
    const socket = io(window.location.origin, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_chat', { requestId });
    });

    socket.on('receive_message', (msg) => {
      dispatch({ type: 'APPEND_MESSAGE', payload: msg });
    });

    socket.on('error', ({ message: msg }) => {
      setError(msg);
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
      dispatch({ type: 'SET_MESSAGES', payload: [] });
    };
  }, [requestId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !connected) return;
    if (text.length > 2000) {
      setError('Message too long (max 2000 characters)');
      return;
    }
    setError('');
    socketRef.current?.emit('send_message', { requestId, text });
    setText('');
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-200">←</button>
        <div>
          <h1 className="text-sm font-bold text-gray-100">Chat</h1>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Connecting…'}</span>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.senderId === user?.id || msg.senderId?.toString() === user?.id;
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                  isMe
                    ? 'bg-primary-600 text-white rounded-br-none'
                    : 'bg-gray-800 text-gray-100 rounded-bl-none'
                }`}
              >
                <p className="leading-relaxed">{msg.text}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-primary-200' : 'text-gray-500'}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="sticky bottom-0 px-4 py-3 bg-gray-950 border-t border-gray-800">
        {error && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-red-900/30 border border-red-800 text-red-400 text-xs">
            {error}
          </div>
        )}
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            id="chat-input"
            type="text"
            placeholder="Type a message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="input flex-1"
            maxLength={2000}
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!text.trim() || !connected}
            className="btn-primary px-5"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
