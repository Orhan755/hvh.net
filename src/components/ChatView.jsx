import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Hash, Users, Activity, Image as ImageIcon, Smile } from 'lucide-react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
let socket;

const EMOJIS = ['💀', '🔥', '👑', '👽', '💻', '🚀', '💣', '⚡', '👀', '🎯'];

const ChatView = () => {
  const [activeChannel, setActiveChannel] = useState('general');
  const [channelsData, setChannelsData] = useState({ 'general': [], 'config-sharing': [], 'media': [] });
  const [inputValue, setInputValue] = useState('');
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [vips, setVips] = useState({});
  const [showEmojis, setShowEmojis] = useState(false);
  
  const [currentUser, setCurrentUser] = useState('user');
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Session setup
    const session = JSON.parse(localStorage.getItem('hvh_session') || '{}');
    if (session.user) {
      setCurrentUser(session.user);
    }
    
    // Connect to Socket.io
    const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:3002';
    socket = io(SOCKET_URL);
    
    socket.on('online_count', (count) => {
      setOnlineUsers(count);
    });
    
    socket.on('new_message', (msg) => {
      setChannelsData(prev => ({
        ...prev,
        [msg.channel]: [...(prev[msg.channel] || []), msg]
      }));
    });
    
    socket.on('vip_update', (data) => {
      setVips(prev => {
        const updated = { ...prev };
        if(data.is_vip === 1) updated[data.username] = true;
        else delete updated[data.username];
        return updated;
      });
    });

    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        const [statsRes, msgsRes, vipsRes] = await Promise.all([
          fetch(`${API_URL}/stats`),
          fetch(`${API_URL}/messages`),
          fetch(`${API_URL}/vips`)
        ]);
        
        const statsData = await statsRes.json();
        setTotalUsers(statsData.totalUsers);
        setOnlineUsers(statsData.onlineUsers);
        
        const msgsData = await msgsRes.json();
        setChannelsData(msgsData);
        
        const vipsData = await vipsRes.json();
        setVips(vipsData);
      } catch (e) {
        console.error('Failed to load initial chat data', e);
      }
    };
    
    fetchInitialData();
    
    return () => {
      if(socket) socket.disconnect();
    };
  }, []);

  const currentMessages = channelsData[activeChannel] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, activeChannel]);

  const handleSend = async (e, customMessage = null) => {
    if (e) e.preventDefault();
    
    const textToSend = customMessage ? customMessage.text : inputValue;
    const msgType = customMessage ? customMessage.type : 'text';
    
    if (!textToSend.trim()) return;

    // XSS Protection Filter
    const hasXSS = /(<script|javascript:|onerror=|onload=|onmouseover=|eval\(|document\.cookie|<iframe)/i;
    if (hasXSS.test(textToSend)) {
      alert('CRITICAL THREAT: XSS (Cross-Site Scripting) payload detected and blocked! Incident logged.');
      
      await fetch(`${API_URL}/admin/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'CRITICAL', message: 'XSS Payload Blocked in Chat Input', ip: `192.168.1.${Math.floor(Math.random() * 255)}`, userAttempt: currentUser })
      });
      
      setInputValue('');
      return;
    }

    const newMessage = {
      channel: activeChannel,
      sender: currentUser,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: msgType
    };

    socket.emit('send_message', newMessage);
    
    if (!customMessage) setInputValue('');
    setShowEmojis(false);
  };

  const handleImageSend = () => {
    const url = prompt('Enter Image URL (e.g., from Imgur or Discord):');
    if (url) {
      handleSend(null, { text: url, type: 'image' });
    }
  };

  const insertEmoji = (emoji) => {
    setInputValue(prev => prev + emoji);
    setShowEmojis(false);
  };

  return (
    <div className="chat-container">
      {/* Chat List Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-header">
          <h2><span className="text-accent">#</span> Active Channels</h2>
          <div className="search-bar">
            <Search size={18} className="text-muted" />
            <input type="text" placeholder="Search channels..." />
          </div>
        </div>
        
        <div className="chat-list">
          <div className={`chat-list-item ${activeChannel === 'general' ? 'active' : ''}`} onClick={() => setActiveChannel('general')}>
            <div className="avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Hash size={20} className={activeChannel === 'general' ? 'text-accent' : 'text-muted'} />
            </div>
            <div className="chat-info">
              <div className="chat-name">
                <span>general</span>
              </div>
            </div>
          </div>

          <div className={`chat-list-item ${activeChannel === 'config-sharing' ? 'active' : ''}`} onClick={() => setActiveChannel('config-sharing')}>
            <div className="avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Users size={20} className={activeChannel === 'config-sharing' ? 'text-accent' : 'text-muted'} />
            </div>
            <div className="chat-info">
              <div className="chat-name">
                <span>config-sharing</span>
              </div>
            </div>
          </div>

          <div className={`chat-list-item ${activeChannel === 'media' ? 'active' : ''}`} onClick={() => setActiveChannel('media')}>
            <div className="avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Activity size={20} className={activeChannel === 'media' ? 'text-accent' : 'text-muted'} />
            </div>
            <div className="chat-info">
              <div className="chat-name">
                <span>media</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-area">
        <div className="chat-area-header">
          <div className="chat-area-title">
            <span className="text-accent">#</span>
            <h3>{activeChannel}</h3>
          </div>
          <div className="flex items-center gap-2 text-muted text-sm font-mono" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)'}}>
            <span className="status-indicator" style={{ backgroundColor: '#b0ff00', width: '8px', height: '8px', borderRadius: '50%' }}></span>
            {totalUsers} Members • {onlineUsers} Online
          </div>
        </div>

        <div className="messages-container">
          {currentMessages.map((msg) => {
            const isMe = msg.sender === currentUser;
            const isSystem = msg.sender === 'system';
            const isVip = vips[msg.sender];
            
            return (
              <div key={msg.id} className={`message ${isMe ? 'sent' : 'received'}`}>
                {!isMe && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: isSystem ? 'var(--accent)' : (isVip ? '#ffb400' : 'var(--text-secondary)'), 
                    marginBottom: '0.25rem', 
                    fontFamily: 'var(--font-mono)',
                    fontWeight: isVip ? 'bold' : 'normal'
                  }}>
                    {msg.sender}
                    {isVip && <span style={{ fontSize: '0.6rem', border: '1px solid #ffb400', borderRadius: '4px', padding: '0.1rem 0.2rem', marginLeft: '0.4rem', color: '#ffb400' }}>VIP</span>}
                  </span>
                )}
                
                <div className="message-bubble" style={{
                  ...(isSystem ? { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'rgba(176,255,0,0.05)' } : {}),
                  ...(isVip && isMe ? { borderColor: '#ffb400', boxShadow: '0 0 5px rgba(255,180,0,0.2)' } : {}),
                  padding: msg.type === 'image' ? '0.5rem' : '1rem'
                }}>
                  {msg.type === 'image' ? (
                    <img src={msg.text} alt="Attachment" style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px', objectFit: 'contain' }} />
                  ) : (
                    msg.text
                  )}
                </div>
                <span className="message-time">{msg.time}</span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{ position: 'relative' }}>
          {showEmojis && (
            <div style={{ position: 'absolute', bottom: '100%', left: '2rem', marginBottom: '0.5rem', backgroundColor: '#111', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
              {EMOJIS.map(emoji => (
                <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem' }}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
          
          <form onSubmit={handleSend} className="chat-input-wrapper">
            <button type="button" onClick={() => setShowEmojis(!showEmojis)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem' }}>
              <Smile size={20} />
            </button>
            <button type="button" onClick={handleImageSend} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem' }}>
              <ImageIcon size={20} />
            </button>
            
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Send a message to #${activeChannel}...`} 
              style={{ paddingLeft: '0.5rem' }}
            />
            <button type="submit" className="send-button" disabled={!inputValue.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
