import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { requestJson, buildApiUrl } from '../lib/incidentApi';

const LiveChat = ({ incidentId, session, socket }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!incidentId) {
      setLoading(false);
      return;
    }

    try {
      const data = await requestJson(buildApiUrl(`/webhook/incident/messages?incident_id=${incidentId}`));
      if (data && data.messages) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchMessages();
    
    if (socket) {
      const handleNewMessage = (msg) => {
        if (msg.incident_id === incidentId) {
          setMessages(prev => [...prev, msg]);
        }
      };
      socket.on('new-message', handleNewMessage);
      return () => {
        socket.off('new-message', handleNewMessage);
      };
    }
  }, [fetchMessages, incidentId, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const payload = {
      incident_id: incidentId,
      sender_role: session.role,
      sender_name: session.displayName,
      content: inputText.trim()
    };

    setInputText('');

    try {
      await requestJson(buildApiUrl('/webhook/incident/message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-2xl border border-[var(--glass-border)] shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-[var(--glass-border)] bg-black/20">
        <MessageSquare className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-white">Live Comm Link</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[400px]">
        {loading ? (
          <div className="text-center text-slate-500 text-sm">Connecting...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-500 text-sm mt-10">No messages yet. Send a message to coordinate.</div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_role === session.role && msg.sender_name === session.displayName;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-500 mb-1 ml-1">{msg.sender_name} ({msg.sender_role})</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}`}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-[var(--glass-border)] bg-black/20 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
        />
        <button 
          type="submit" 
          disabled={!inputText.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
};

export default LiveChat;
