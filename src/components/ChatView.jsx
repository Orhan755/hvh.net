import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Hash, Users, Activity, Image as ImageIcon, Smile, Settings, Edit2, Trash2, MessageSquare, X, User, Mic, Phone, Video, Pin, Lock, CheckCheck, Plus, Reply } from 'lucide-react';
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
  const [channelsData, setChannelsData] = useState({});
  const [channelsList, setChannelsList] = useState([]);
  const [dmData, setDmData] = useState({});
  const [dmUsers, setDmUsers] = useState([]);
  const [createRoomModal, setCreateRoomModal] = useState(false);
  const [joinRoomModal, setJoinRoomModal] = useState({ show: false, room: null, password: '' });
  const [newRoomForm, setNewRoomForm] = useState({ name: '', password: '' });
  
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
  const [replyingTo, setReplyingTo] = useState(null);
  const [reactionMenuMsg, setReactionMenuMsg] = useState(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('hvh_theme') || 'purple');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('hvh_sound') !== 'false');
  
  // Phase 4 State
  const [profileModal, setProfileModal] = useState({ show: false, data: null, isEdit: false });
  const [profileForm, setProfileForm] = useState({ profile_pic: '', status_text: '' });
  
  // Phase 5: Pins & WebRTC
  const [pinnedMsgs, setPinnedMsgs] = useState([]);
  
  const [callState, setCallState] = useState(null); // null, 'incoming', 'calling', 'active'
  const [callData, setCallData] = useState(null); 
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

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

  const handleProfilePicUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 250; 
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setProfileForm(prev => ({...prev, profile_pic: canvas.toDataURL('image/jpeg', 0.8)}));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          handleSend(null, { text: reader.result, type: 'audio' });
        };
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch(err) {
      alert("Mikrofon izni reddedildi.");
    }
  };

  const stopRecording = () => {
    if(mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
    
    socket.on('reaction_updated', (data) => {
      const updater = (prev) => {
        const next = {...prev};
        const key = data.isDm ? data.channel : data.channel;
        if (next[key]) {
          next[key] = next[key].map(m => m.id === data.id ? {...m, reactions: data.reactions} : m);
        }
        return next;
      };
      if (data.isDm) setDmData(updater);
      else setChannelsData(updater);
    });
    
    socket.on('messages_read', (data) => {
      setDmData(prev => {
        const next = {...prev};
        const partner = data.receiver === currentUser ? data.sender : data.receiver;
        if(next[partner]) {
           next[partner] = next[partner].map(m => m.sender === data.sender ? {...m, is_read: 1} : m);
        }
        return next;
      });
    });

    socket.on('new_channel', (chan) => {
      setChannelsList(prev => [...prev, chan]);
    });
    
    socket.on('message_pinned', (data) => {
      if (data.channel === activeChannel) fetchPins(activeChannel);
    });
    socket.on('message_unpinned', (data) => {
      if (data.channel === activeChannel) fetchPins(activeChannel);
    });

    // WebRTC Listeners
    socket.on('incoming_call', async (data) => {
      if (data.userToCall === currentUser) {
        setCallState('incoming');
        setCallData(data);
      }
    });

    socket.on('call_accepted', async (data) => {
      if (data.to === currentUser && peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
        setCallState('active');
      }
    });
    
    socket.on('ice_candidate', async (data) => {
      if (data.to === currentUser && peerRef.current) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
    
    socket.on('call_ended', (data) => {
      if (data.to === currentUser || data.from === currentUser) {
        endCallLocal();
      }
    });

    const fetchInitialData = async () => {
      try {
        const [statsRes, msgsRes, vipsRes, chansRes] = await Promise.all([
          fetch(`${API_URL}/stats`),
          fetch(`${API_URL}/messages`),
          fetch(`${API_URL}/vips`),
          fetch(`${API_URL}/channels`)
        ]);
        
        const statsData = await statsRes.json();
        setTotalUsers(statsData.totalUsers);
        setOnlineUsers(statsData.onlineUsers);
        
        const msgsData = await msgsRes.json();
        setChannelsData(msgsData);
        
        const vipsData = await vipsRes.json();
        setVips(vipsData);
        
        const chansData = await chansRes.json();
        setChannelsList(chansData);
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
      if (socket) socket.emit('mark_read', { sender: partner, receiver: currentUser });
      
      if (!dmData[partner]) {
        fetch(`${API_URL}/dms/${currentUser}/${partner}`)
          .then(r => r.json())
          .then(data => {
             setDmData(prev => ({...prev, [partner]: data}));
             setDmUsers(prev => prev.includes(partner) ? prev : [...prev, partner]);
          })
          .catch(e => console.error("Error fetching DMs", e));
      } else {
        setDmData(prev => {
          const next = {...prev};
          next[partner] = next[partner].map(m => m.sender === partner ? {...m, is_read: 1} : m);
          return next;
        });
      }
    }
  }, [activeChannel, currentUser]);
  
  const isDm = activeChannel.startsWith('@');

  const fetchPins = (channel) => {
    fetch(`${API_URL}/pins/${channel}`)
      .then(r => r.json())
      .then(data => setPinnedMsgs(data))
      .catch(e => console.error(e));
  };

  useEffect(() => {
    if (!isDm) fetchPins(activeChannel);
    else setPinnedMsgs([]);
  }, [activeChannel, isDm]);

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
      socket.emit('send_dm', { sender: currentUser, receiver, text: textToSend, time, type: msgType, reply_to: replyingTo?.id });
    } else {
      socket.emit('send_message', { channel: activeChannel, sender: currentUser, text: textToSend, time, type: msgType, reply_to: replyingTo?.id });
    }
    
    setReplyingTo(null);
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

  const handleCreateRoom = async () => {
    if(!newRoomForm.name) return;
    try {
      const res = await fetch(`${API_URL}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomForm.name, password: newRoomForm.password, admin_id: currentUser })
      });
      if(res.ok) {
        setActiveChannel(newRoomForm.name);
        setCreateRoomModal(false);
        setNewRoomForm({name:'', password:''});
      } else {
         alert("Bu isimde bir kanal zaten var.");
      }
    } catch(e){}
  };

  const handleJoinRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/channels/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: joinRoomModal.room.name, password: joinRoomModal.password })
      });
      if(res.ok) {
        setActiveChannel(joinRoomModal.room.name);
        setJoinRoomModal({show:false, room:null, password:''});
      } else {
        alert("Yanlış Şifre!");
      }
    } catch(e){}
  };
  
  const handlePin = (msgId) => {
    socket.emit('pin_message', { channel: activeChannel, message_id: msgId });
  };
  const handleUnpin = (pinId) => {
    socket.emit('unpin_message', { pin_id: pinId, channel: activeChannel });
  };

  // WebRTC Logic
  const createPeer = (isVideo) => {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peer.onicecandidate = (e) => {
      if (e.candidate) socket.emit('ice_candidate', { candidate: e.candidate, to: isDm ? activeChannel.substring(1) : callData?.from });
    };
    peer.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    return peer;
  };

  const startCall = async (isVideo) => {
    if (!isDm) return alert("Sadece DM'lerde arama yapabilirsiniz.");
    setCallState('calling');
    const partner = activeChannel.substring(1);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      const peer = createPeer(isVideo);
      peerRef.current = peer;
      stream.getTracks().forEach(t => peer.addTrack(t, stream));
      
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      
      socket.emit('call_user', { userToCall: partner, signal: offer, from: currentUser, isVideo });
    } catch (e) {
      alert("Kamera/Mikrofon izni reddedildi.");
      setCallState(null);
    }
  };

  const answerCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: callData.isVideo, audio: true });
      streamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      const peer = createPeer(callData.isVideo);
      peerRef.current = peer;
      stream.getTracks().forEach(t => peer.addTrack(t, stream));
      
      await peer.setRemoteDescription(new RTCSessionDescription(callData.signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      
      socket.emit('answer_call', { signal: answer, to: callData.from });
      setCallState('active');
    } catch(e) {
      alert("Bağlantı kurulamadı.");
    }
  };

  const endCallLocal = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (peerRef.current) peerRef.current.close();
    setCallState(null);
    setCallData(null);
  };

  const endCall = () => {
    socket.emit('end_call', { to: callState === 'incoming' ? callData.from : activeChannel.substring(1), from: currentUser });
    endCallLocal();
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
                {profileModal.data.last_seen && <div>Last Seen: {profileModal.data.last_seen}</div>}
              </div>
              
              {profileModal.isEdit ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  <label style={{ width: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Profil Fotoğrafı Yükle:</label>
                  <input type="file" accept="image/*" onChange={handleProfilePicUpload} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-darker)', color: 'var(--text-primary)' }} />
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

      {/* Create Room Modal */}
      {createRoomModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--accent)', width: '350px' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Yeni Kanal Oluştur</h3>
            <input type="text" placeholder="Kanal Adı (boşluksuz)" value={newRoomForm.name} onChange={e => setNewRoomForm({...newRoomForm, name: e.target.value.replace(/\s+/g, '-')})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-darker)', color: 'var(--text-primary)', marginBottom: '1rem' }} />
            <input type="password" placeholder="Şifre (Opsiyonel)" value={newRoomForm.password} onChange={e => setNewRoomForm({...newRoomForm, password: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-darker)', color: 'var(--text-primary)', marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setCreateRoomModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}>İptal</button>
              <button onClick={handleCreateRoom} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#000', fontWeight: 'bold' }}>Oluştur</button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {joinRoomModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--accent)', width: '350px' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>{joinRoomModal.room.name} Şifreli</h3>
            <input type="password" placeholder="Şifre" value={joinRoomModal.password} onChange={e => setJoinRoomModal({...joinRoomModal, password: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-darker)', color: 'var(--text-primary)', marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setJoinRoomModal({show:false, room:null, password:''})} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}>İptal</button>
              <button onClick={handleJoinRoom} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--accent)', color: '#000', fontWeight: 'bold' }}>Katıl</button>
            </div>
          </div>
        </div>
      )}

      {/* Call Modal */}
      {callState && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 className="text-accent" style={{ marginBottom: '2rem' }}>
            {callState === 'incoming' ? `${callData.from} Arıyor...` : callState === 'calling' ? 'Aranıyor...' : 'Bağlanıldı'}
          </h2>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '300px', height: '200px', backgroundColor: '#000', borderRadius: '12px', border: '2px solid var(--border-color)', objectFit: 'cover' }} />
            {callState === 'active' && (
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px', height: '200px', backgroundColor: '#000', borderRadius: '12px', border: '2px solid var(--accent)', objectFit: 'cover' }} />
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '2rem' }}>
            {callState === 'incoming' && (
               <button onClick={answerCall} style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#00c853', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={24} /></button>
            )}
            <button onClick={endCall} style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#ff1744', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Phone size={24} style={{ transform: 'rotate(135deg)' }} /></button>
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
          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Channels</h4>
            <button onClick={() => setCreateRoomModal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Plus size={16} /></button>
          </div>
          
          {channelsList.map(chan => (
             <div key={chan.id} className={`chat-list-item ${activeChannel === chan.name ? 'active' : ''}`} onClick={() => {
               if (chan.is_locked && activeChannel !== chan.name) {
                 setJoinRoomModal({ show: true, room: chan, password: '' });
               } else {
                 setActiveChannel(chan.name);
               }
             }}>
              <div className="avatar" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {chan.is_locked ? <Lock size={16} className={activeChannel === chan.name ? 'text-accent' : 'text-muted'} /> : <Hash size={20} className={activeChannel === chan.name ? 'text-accent' : 'text-muted'} />}
              </div>
              <div className="chat-info">
                <div className="chat-name"><span>{chan.name}</span></div>
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
          <div className="flex items-center gap-2 text-muted text-sm font-mono" style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-mono)'}}>
            {isDm && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => startCall(false)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Phone size={18} /></button>
                <button onClick={() => startCall(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}><Video size={18} /></button>
              </div>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <span className="status-indicator" style={{ backgroundColor: 'var(--accent)', width: '8px', height: '8px', borderRadius: '50%', boxShadow: '0 0 5px var(--accent)' }}></span>
               {totalUsers} Members • {onlineUsers} Online
            </span>
          </div>
        </div>

        <div className="messages-container" style={{ position: 'relative' }}>
          
          {pinnedMsgs.length > 0 && !isDm && (
            <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'rgba(var(--bg-card-rgb), 0.95)', backdropFilter: 'blur(5px)', borderBottom: '1px solid var(--accent)', padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Pin size={12}/> SABİTLENMİŞ MESAJLAR</div>
              {pinnedMsgs.map(pin => (
                 <div key={pin.pin_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                   <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                     <strong style={{ color: 'var(--text-primary)' }}>{pin.sender}:</strong> {pin.text}
                   </div>
                   {isAdmin && <button onClick={() => handleUnpin(pin.pin_id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={12}/></button>}
                 </div>
              ))}
            </div>
          )}

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
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', position: 'relative' }}>
                    {msg.reply_to && (
                      <div style={{ 
                        fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', padding: '0.3rem', 
                        borderLeft: `2px solid var(--accent)`, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px',
                        maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        ↪ Replied: {currentMessages.find(m => m.id === msg.reply_to)?.text || 'Message deleted'}
                      </div>
                    )}
                  <div className="message-bubble" style={{
                    ...(isSystem ? { borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-glow)' } : {}),
                    ...(isVip && isMe ? { borderColor: '#ffb400', boxShadow: '0 0 5px rgba(255,180,0,0.2)' } : {}),
                    ...(isDeleted ? { borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'transparent', fontStyle: 'italic' } : {}),
                    padding: msg.type === 'image' && !isDeleted ? '0.5rem' : '1rem'
                  }}>
                    {msg.type === 'audio' && !isDeleted ? (
                      <audio controls src={msg.text} style={{ height: '35px', maxWidth: '250px' }} />
                    ) : msg.type === 'image' && !isDeleted ? (
                      <img src={msg.text} alt="Attachment" style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '4px', objectFit: 'contain' }} />
                    ) : (
                      <>
                        {msg.text}
                        {isEdited && !isDeleted && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(edited)</span>}
                      </>
                    )}
                  </div>
                    {msg.reactions && msg.reactions !== '{}' && (
                      <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        {Object.entries(JSON.parse(msg.reactions)).map(([emoji, users]) => users.length > 0 && (
                           <div key={emoji} onClick={() => socket.emit('add_reaction', { id: msg.id, isDm, emoji, user: currentUser, channel: activeChannel.startsWith('@') ? activeChannel.substring(1) : activeChannel })} style={{ fontSize: '0.75rem', padding: '0.1rem 0.3rem', backgroundColor: users.includes(currentUser) ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--bg-darker)', border: `1px solid ${users.includes(currentUser) ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: '12px', cursor: 'pointer', userSelect: 'none' }}>
                             {emoji} <span style={{opacity:0.8}}>{users.length}</span>
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Edit/Delete Actions */}
                  {!isSystem && !isDeleted && (
                    <div style={{ display: 'flex', gap: '0.25rem', opacity: 1, transition: 'opacity 0.2s', marginTop: '0.5rem' }} className="msg-actions">
                       <button onClick={() => setReactionMenuMsg(msg.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="React"><Smile size={14} /></button>
                       <button onClick={() => setReplyingTo(msg)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Reply"><Reply size={14} /></button>
                       {isAdmin && !isDm && (
                         <button onClick={() => handlePin(msg.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Pin"><Pin size={14} /></button>
                       )}
                       {isMe && msg.type !== 'image' && msg.type !== 'audio' && (
                         <button onClick={() => handleEditMsg(msg)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Edit"><Edit2 size={14} /></button>
                       )}
                       {(isMe || isAdmin) && (
                         <button onClick={() => handleDeleteMsg(msg.id, isDm)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
                       )}
                    </div>
                  )}
                  {reactionMenuMsg === msg.id && (
                     <div style={{ position: 'absolute', top: '10px', [isMe ? 'right' : 'left']: '50px', backgroundColor: '#111', border: '1px solid var(--accent)', borderRadius: '8px', padding: '0.3rem', display: 'flex', gap: '0.3rem', zIndex: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                       {EMOJIS.slice(0, 6).map(emoji => (
                         <button key={emoji} onClick={() => {
                           socket.emit('add_reaction', { id: msg.id, isDm, emoji, user: currentUser, channel: activeChannel.startsWith('@') ? activeChannel.substring(1) : activeChannel });
                           setReactionMenuMsg(null);
                         }} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer' }}>{emoji}</button>
                       ))}
                       <button onClick={() => setReactionMenuMsg(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={14}/></button>
                     </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                  <span className="message-time">{msg.time}</span>
                  {isMe && isDm && (
                     <CheckCheck size={14} color={msg.is_read === 1 ? '#00bfff' : 'var(--text-muted)'} />
                  )}
                </div>
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

          {replyingTo && (
            <div style={{ position: 'absolute', top: '-40px', left: 0, right: 0, backgroundColor: 'var(--bg-card)', padding: '0.5rem 1rem', borderTop: '1px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <div><span className="text-accent">Replying to {replyingTo.sender}:</span> <span style={{ color: 'var(--text-muted)' }}>{replyingTo.text}</span></div>
              <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16}/></button>
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
            
            <button 
              type="button" 
              onMouseDown={startRecording} 
              onMouseUp={stopRecording} 
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              style={{ background: 'none', border: 'none', color: isRecording ? '#ff4444' : 'var(--text-muted)', cursor: 'pointer', padding: '0 0.5rem', transition: 'color 0.2s' }}>
              <Mic size={20} className={isRecording ? 'pulse-anim' : ''} />
            </button>
            
            <button type="submit" className="send-button" disabled={!inputValue.trim() && !isRecording}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
