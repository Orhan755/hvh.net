import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Hash, Users, Activity, Image as ImageIcon, Smile, Settings, Edit2, Trash2, MessageSquare, X, User } from 'lucide-react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
let socket;

const EMOJIS = ['💀', '🔥', '👑', '👽', '💻', '🚀', '💣', '⚡', '👀', '🎯'];

// Simple Web Audio Beep
const playBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    // Ignore audio errors
  }
};

const ChatView = () => {
  const [activeChannel, setActiveChannel] = useState('general');
  const [channelsData, setChannelsData] = useState({ 'general': [], 'config-sharing': [], 'media': [] });
  const [dmData, setDmData] = useState({});
  const [dmUsers, setDmUsers] = useState([]);
  
  const [inputValue, setInputValue] = useState('');
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [vips, setVips] = useState({});
  const [showEmojis, setShowEmojis] = useState(false);
  
  const [currentUser, setCurrentUser] = useState('user');
  
  // Phase 2 & 3 State
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  
  const [editingMsg, setEditingMsg] = useState(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('hvh_theme') || 'purple');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('hvh_sound') !== 'false');
  
  // Phase 4 State
  const [profileModal, setProfileModal] = useState({ show: false, data: null, isEdit: false });
  const [profileForm, setProfileForm] = useState({ profile_pic: '', status_text: '' });
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const isAdmin = !!localStorage.getItem('hvh_admin_token');

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hvh_theme', theme);
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('hvh_sound', soundEnabled);
  }, [soundEnabled]);

  const processAndSendImage = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Lütfen sadece resim dosyası yükleyin.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        handleSend(null, { text: dataUrl, type: 'image' });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processAndSendImage(file);
    e.target.value = null;
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processAndSendImage(file);
  };

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('hvh_session') || '{}');
    if (session.user) setCurrentUser(session.user);
    
    const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:3002';
    socket = io(SOCKET_URL);
    
    socket.on('online_count', (count) => setOnlineUsers(count));
    
    socket.on('new_message', (msg) => {
      setChannelsData(prev => ({ ...prev, [msg.channel]: [...(prev[msg.channel] || []), msg] }));
      if (msg.sender !== currentUser && soundEnabled) playBeep();
    });
    
    socket.on('new_dm', (msg) => {
      const partner = msg.sender === currentUser ? msg.receiver : msg.sender;
      setDmData(prev => ({ ...prev, [partner]: [...(prev[partner] || []), msg] }));
      setDmUsers(prev => prev.includes(partner) ? prev : [...prev, partner]);
      if (msg.sender !== currentUser && soundEnabled) playBeep();
    });
    
    socket.on('vip_update', (data) => {
      setVips(prev => {
        const updated = { ...prev };
        if(data.is_vip === 1) updated[data.username] = true;
        else delete updated[data.username];
        return updated;
      });
    });
    
    socket.on('user_typing', (data) => {
      setTypingUsers(prev => ({ ...prev, [`${data.channel}-${data.username}`]: true }));
    });
    socket.on('user_stop_typing', (data) => {
      setTypingUsers(prev => {
        const next = {...prev};
        delete next[`${data.channel}-${data.username}`];
        return next;
      });
    });
    
    socket.on('message_deleted', (data) => {
      const updater = (prev) => {
        const next = {...prev};
        const key = data.isDm ? data.channel : data.channel; // channel name or partner name
        if (next[key]) {
          next[key] = next[key].map(m => m.id === data.id ? {...m, deleted: 1, text: '🚫 This message was deleted'} : m);
        }
        return next;
      };
      if (data.isDm) setDmData(updater);
      else setChannelsData(updater);
    });
    
    socket.on('message_edited', (data) => {
      const updater = (prev) => {
        const next = {...prev};
        const key = data.isDm ? data.channel : data.channel;
        if (next[key]) {
          next[key] = next[key].map(m => m.id === data.id ? {...m, edited: 1, text: data.newText} : m);
        }
        return next;
      };
      if (data.isDm) setDmData(updater);
      else setChannelsData(updater);
    });

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
    
    return () => { if(socket) socket.disconnect(); };
  }, [currentUser, soundEnabled]);
  
  // Fetch DMs when opening a DM channel
  useEffect(() => {
    if (activeChannel.startsWith('@')) {
      const partner = activeChannel.substring(1);
      if (!dmData[partner]) {
        fetch(`${API_URL}/dms/${currentUser}/${partner}`)
          .then(r => r.json())
          .then(data => {
             setDmData(prev => ({...prev, [partner]: data}));
             setDmUsers(prev => prev.includes(partner) ? prev : [...prev, partner]);
          })
          .catch(e => console.error("Error fetching DMs", e));
      }
    }
  }, [activeChannel, currentUser, dmData]);

  const isDm = activeChannel.startsWith('@');
  const currentMessages = isDm ? (dmData[activeChannel.substring(1)] || []) : (channelsData[activeChannel] || []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, activeChannel]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    
    if (socket) {
      socket.emit('typing', { channel: activeChannel, username: currentUser });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { channel: activeChannel, username: currentUser });
      }, 2000);
    }
  };

  const handleSend = async (e, customMessage = null) => {
    if (e) e.preventDefault();
    
    if (editingMsg) {
      if (!inputValue.trim()) return;
      socket.emit('edit_message', { id: editingMsg.id, isDm: editingMsg.isDm, newText: inputValue, channel: activeChannel.startsWith('@') ? activeChannel.substring(1) : activeChannel });
      setEditingMsg(null);
      setInputValue('');
      return;
    }
    
    const textToSend = customMessage ? customMessage.text : inputValue;
    const msgType = customMessage ? customMessage.type : 'text';
    
    if (!textToSend.trim()) return;

    const hasXSS = /(<script|javascript:|onerror=|onload=|onmouseover=|eval\(|document\.cookie|<iframe)/i;
    if (hasXSS.test(textToSend)) {
      alert('CRITICAL THREAT: XSS (Cross-Site Scripting) payload detected and blocked!');
      setInputValue('');
      return;
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isDm) {
      const receiver = activeChannel.substring(1);
      socket.emit('send_dm', { sender: currentUser, receiver, text: textToSend, time, type: msgType });
    } else {
      socket.emit('send_message', { channel: activeChannel, sender: currentUser, text: textToSend, time, type: msgType });
    }
    
    if (!customMessage) setInputValue('');
    setShowEmojis(false);
    
    if (socket) socket.emit('stop_typing', { channel: activeChannel, username: currentUser });
  };
  
  const handleDeleteMsg = (id, isDmMsg) => {
    if(window.confirm('Emin misiniz?')) {
       socket.emit('delete_message', { id, isDm: isDmMsg, channel: activeChannel.startsWith('@') ? activeChannel.substring(1) : activeChannel });
    }
  };
  
  const handleEditMsg = (msg) => {
    setEditingMsg({ id: msg.id, isDm: activeChannel.startsWith('@') });
    setInputValue(msg.text);
  };
  
  const openProfile = async (username) => {
    try {
      const res = await fetch(`${API_URL}/users/${username}/profile`);
      if (res.ok) {
        const data = await res.json();
        setProfileModal({ show: true, data, isEdit: false });
        setProfileForm({ profile_pic: data.profile_pic || '', status_text: data.status_text || '' });
      }
    } catch(e) {
      console.error(e);
    }
  };
  
  const saveProfile = async () => {
    try {
      await fetch(`${API_URL}/users/${currentUser}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm)
      });
      setProfileModal(prev => ({ ...prev, show: false }));
    } catch(e) {
      console.error(e);
    }
  };

  const startDm = (username) => {
    if (username === currentUser) return;
    setProfileModal({ show: false, data: null, isEdit: false });
    setActiveChannel(`@${username}`);
  };

  // Check if anyone is typing in current channel
  const typingString = Object.keys(typingUsers)
    .filter(k => k.startsWith(`${activeChannel}-`) && !k.endsWith(`-${currentUser}`))
    .map(k => k.split('-')[1])
    .join(', ');

  const insertEmoji = (emoji) => {
    setInputValue(prev => prev + emoji);
    setShowEmojis(false);
  };
  
  const handleImageSend = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="chat-container">
      {/* Profile Modal */}
      {profileModal.show && profileModal.data && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--accent)', width: '400px', maxWidth: '90%', position: 'relative' }}>
            <button onClick={() => setProfileModal({show:false, data:null, isEdit:false})} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X /></button>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--bg-darker)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--accent)' }}>
                {profileModal.data.profile_pic ? (
                  <img src={profileModal.data.profile_pic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={50} className="text-accent" />
                )}
              </div>
              <h2 className="text-accent" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {profileModal.data.username}
                {profileModal.data.is_vip === 1 && <span style={{ fontSize: '0.8rem', border: '1px solid #ffb400', borderRadius: '4px', padding: '2px 4px', color: '#ffb400' }}>VIP</span>}
              </h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Joined: {profileModal.data.join_date}
              </div>
              
              {profileModal.isEdit ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <input type="text" placeholder="Profile Picture URL" value={profileForm.profile_pic} onChange={e => setProfileForm({...profileForm, profile_pic: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-darker)', color: 'var(--text-primary)' }} />
                  <input type="text" placeholder="Status Message" value={profileForm.status_text} onChange={e => setProfileForm({...profileForm, status_text: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-darker)', color: 'var(--text-primary)' }} />
                  <button onClick={saveProfile} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}>Save Changes</button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginTop: '1rem', width: '100%' }}>
                  <p style={{ fontStyle: 'italic', marginBottom: '2rem' }}>"{profileModal.data.status_text || 'No status set.'}"</p>
                  
                  {profileModal.data.username === currentUser ? (
                    <button onClick={() => setProfileModal(prev => ({...prev, isEdit: true}))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--accent)', backgroundColor: 'transparent', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Edit2 size={16} /> Edit Profile
                    </button>
                  ) : (
                    <button onClick={() => startDm(profileModal.data.username)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#000', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <MessageSquare size={16} /> Send Direct Message
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', width: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3>Settings</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X /></button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Color Theme</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-darker)', color: 'var(--text-primary)' }}>
                <option value="purple">Cyberpunk Purple</option>
                <option value="green">Matrix Green</option>
                <option value="cyan">Neon Cyan</option>
                <option value="red">Blood Red</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ color: 'var(--text-secondary)' }}>Sound Notifications</label>
              <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} style={{ transform: 'scale(1.5)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Chat List Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2><span className="text-accent">#</span> HVH</h2>
          <button onClick={() => setShowSettings(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Settings size={20} />
          </button>
        </div>
        
        <div className="chat-list" style={{ overflowY: 'auto', flex: 1 }}>
          <h4 style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Channels</h4>
          
          {['general', 'config-sharing', 'media'].map(chan => (
             <div key={chan} className={`chat-list-item ${activeChannel === chan ? 'active' : ''}`} onClick={() => setActiveChannel(chan)}>
              <div className="avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Hash size={20} className={activeChannel === chan ? 'text-accent' : 'text-muted'} />
              </div>
              <div className="chat-info">
                <div className="chat-name"><span>{chan}</span></div>
              </div>
            </div>
          ))}
          
          <h4 style={{ padding: '1rem', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Direct Messages</h4>
          
          {dmUsers.map(user => (
             <div key={user} className={`chat-list-item ${activeChannel === `@${user}` ? 'active' : ''}`} onClick={() => setActiveChannel(`@${user}`)}>
              <div className="avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <User size={20} className={activeChannel === `@${user}` ? 'text-accent' : 'text-muted'} />
              </div>
              <div className="chat-info">
                <div className="chat-name"><span>{user}</span></div>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => openProfile(currentUser)}>
           <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)' }}>
             <User size={16} className="text-accent" />
           </div>
           <div>
             <div style={{ fontWeight: 'bold' }}>{currentUser}</div>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click to edit profile</div>
           </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className="chat-area" 
        onDragOver={handleDragOver} 
        onDrop={handleDrop}
      >
        <div className="chat-area-header">
          <div className="chat-area-title">
            <span className="text-accent">{isDm ? '@' : '#'}</span>
            <h3>{isDm ? activeChannel.substring(1) : activeChannel}</h3>
          </div>
          <div className="flex items-center gap-2 text-muted text-sm font-mono" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)'}}>
            <span className="status-indicator" style={{ backgroundColor: 'var(--accent)', width: '8px', height: '8px', borderRadius: '50%', boxShadow: '0 0 5px var(--accent)' }}></span>
            {totalUsers} Members • {onlineUsers} Online
          </div>
        </div>

        <div className="messages-container" style={{ position: 'relative' }}>
          {currentMessages.map((msg) => {
            const isMe = msg.sender === currentUser;
            const isSystem = msg.sender === 'system';
            const isVip = vips[msg.sender];
            const isDeleted = msg.deleted === 1;
            const isEdited = msg.edited === 1;
            
            return (
              <div key={msg.id} className={`message ${isMe ? 'sent' : 'received'} group`} style={{ position: 'relative' }}>
                {!isMe && (
                  <span 
                    onClick={() => !isSystem && openProfile(msg.sender)}
                    style={{ 
                    fontSize: '0.75rem', 
                    color: isSystem ? 'var(--accent)' : (isVip ? '#ffb400' : 'var(--text-secondary)'), 
                    marginBottom: '0.25rem', 
                    fontFamily: 'var(--font-mono)',
                    fontWeight: isVip ? 'bold' : 'normal',
                    cursor: isSystem ? 'default' : 'pointer',
                    display: 'inline-block'
                  }}>
                    {msg.sender}
                    {isVip && <span style={{ fontSize: '0.6rem', border: '1px solid #ffb400', borderRadius: '4px', padding: '0.1rem 0.2rem', marginLeft: '0.4rem', color: '#ffb400' }}>VIP</span>}
                  </span>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <div className="message-bubble" style={{
                    ...(isSystem ? { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-glow)' } : {}),
                    ...(isVip && isMe ? { borderColor: '#ffb400', boxShadow: '0 0 5px rgba(255,180,0,0.2)' } : {}),
                    ...(isDeleted ? { borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'transparent', fontStyle: 'italic' } : {}),
                    padding: msg.type === 'image' && !isDeleted ? '0.5rem' : '1rem'
                  }}>
                    {msg.type === 'image' && !isDeleted ? (
                      <img src={msg.text} alt="Attachment" style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px', objectFit: 'contain' }} />
                    ) : (
                      <>
                        {msg.text}
                        {isEdited && !isDeleted && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(edited)</span>}
                      </>
                    )}
                  </div>
                  
                  {/* Edit/Delete Actions */}
                  {!isSystem && !isDeleted && (isMe || isAdmin) && (
                    <div style={{ display: 'flex', gap: '0.25rem', opacity: 1, transition: 'opacity 0.2s' }} className="msg-actions">
                       {isMe && msg.type !== 'image' && (
                         <button onClick={() => handleEditMsg(msg)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={14} /></button>
                       )}
                       <button onClick={() => handleDeleteMsg(msg.id, isDm)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                <span className="message-time">{msg.time}</span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area" style={{ position: 'relative' }}>
          
          {typingString && (
            <div style={{ position: 'absolute', top: '-25px', left: '1rem', fontSize: '0.8rem', color: 'var(--accent)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="typing-dots">...</span> {typingString} is typing
            </div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={handleFileInput} 
          />
          {showEmojis && (
            <div style={{ position: 'absolute', bottom: '100%', left: '2rem', marginBottom: '0.5rem', backgroundColor: '#111', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
              {EMOJIS.map(emoji => (
                <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem' }}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
          
          {editingMsg && (
            <div style={{ position: 'absolute', top: '-40px', left: 0, right: 0, backgroundColor: 'var(--bg-card)', padding: '0.5rem 1rem', borderTop: '1px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <span className="text-accent">Editing message...</span>
              <button onClick={() => { setEditingMsg(null); setInputValue(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16}/></button>
            </div>
          )}
          
          <form onSubmit={handleSend} className="chat-input-wrapper" style={{ border: editingMsg ? '1px solid var(--accent)' : '1px solid var(--border-color)' }}>
            <button type="button" onClick={() => setShowEmojis(!showEmojis)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem' }}>
              <Smile size={20} />
            </button>
            <button type="button" onClick={handleImageSend} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem' }}>
              <ImageIcon size={20} />
            </button>
            
            <input 
              type="text" 
              value={inputValue}
              onChange={handleInputChange}
              placeholder={editingMsg ? "Edit your message..." : `Send a message to ${isDm ? '@' : '#'}${isDm ? activeChannel.substring(1) : activeChannel}...`} 
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
