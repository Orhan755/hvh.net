import React, { useState, useEffect } from 'react';
import { Shield, Key, User, Terminal, AlertTriangle, CheckCircle, Fingerprint } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const AuthView = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isSudoMode, setIsSudoMode] = useState(false);
  const [sudoKey, setSudoKey] = useState('');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [uid, setUid] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let keyBuffer = '';
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      keyBuffer += e.key.toLowerCase();
      if (keyBuffer.length > 6) {
        keyBuffer = keyBuffer.slice(-6);
      }
      
      if (keyBuffer === 'qwerty') {
        setIsSudoMode(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const validateInput = (input) => {
    const sqlInjectionPattern = /['";\-]/;
    return !sqlInjectionPattern.test(input);
  };

  const logAttempt = async (type, message, userAttempt) => {
    await fetch(`${API_URL}/admin/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, ip: `192.168.1.${Math.floor(Math.random() * 255)}`, userAttempt })
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateInput(username) || !validateInput(password)) {
      setError('Access Denied: Malicious characters detected (SQLi attempt logged).');
      logAttempt('CRITICAL', 'SQL Injection pattern blocked during auth', username || 'UNKNOWN');
      return;
    }

    if (!isLogin) {
      if (password.length < 6) {
        setError('Security Error: Password must be at least 6 characters.');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, uid })
        });
        const data = await res.json();
        
        if (data.error) {
          setError(data.error);
          logAttempt('WARNING', 'Failed registration - ' + data.error, username);
        } else {
          setSuccess('UID Verified. Account created successfully. You can now login.');
          setIsLogin(true);
          setPassword('');
          setUid('');
        }
      } catch (err) {
        setError('Server error');
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.error) {
          setError('Invalid credentials. Access Denied.');
          logAttempt('WARNING', 'Failed login attempt', username);
        } else {
          onLogin(false, username, data.isVip);
        }
      } catch (err) {
        setError('Server error');
      }
    }
  };

  const handleSudoSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/auth/sudo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: sudoKey })
      });
      const data = await res.json();
      
      if (data.success) {
        await logAttempt('WARNING', 'Admin bypass authorized via remote terminal', 'root');
        localStorage.setItem('hvh_admin_token', data.token);
        onLogin(true, 'root', false);
      } else {
        setIsSudoMode(false);
        setSudoKey('');
        setError(data.error || 'CRITICAL: Unauthorized sudo attempt locked out.');
        logAttempt('CRITICAL', 'Failed admin bypass (Sudo) attempt', 'root');
      }
    } catch(err) {
      setError('Server Error');
    }
  };

  if (isSudoMode) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ borderColor: '#ff003c', boxShadow: '0 0 30px rgba(255,0,60,0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Terminal size={48} color="#ff003c" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ color: '#ff003c', fontFamily: 'var(--font-mono)', letterSpacing: '2px' }}>SUDO ACCESS REQUIRED</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>RESTRICTED ZONE. ENTER MASTER KEY.</p>
          </div>
          <form onSubmit={handleSudoSubmit}>
            <input 
              type="password" 
              placeholder="Enter master key..." 
              value={sudoKey} 
              onChange={(e) => setSudoKey(e.target.value)} 
              autoFocus 
              required 
              style={{ width: '100%', padding: '1rem', marginBottom: '1rem', backgroundColor: '#050505', border: '1px solid #ff003c', color: '#ff003c', fontFamily: 'var(--font-mono)', textAlign: 'center', letterSpacing: '4px' }} 
            />
            <button type="submit" className="btn-primary" style={{ backgroundColor: '#ff003c', color: 'white', width: '100%', border: 'none', padding: '1rem' }}>
              EXECUTE
            </button>
            <button type="button" onClick={() => { setIsSudoMode(false); setSudoKey(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', marginTop: '1.5rem', width: '100%', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
              ABORT
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <Terminal size={40} className="text-accent mb-4" style={{ marginBottom: '1rem' }} />
          <h1 className="font-mono text-primary" style={{ fontSize: '2rem', marginBottom: '0.5rem', textShadow: '0 0 10px var(--accent-glow)' }}>
            hvh.net
          </h1>
          <p className="text-secondary font-mono" style={{ fontSize: '0.875rem' }}>
            {isLogin ? 'AUTHENTICATE TO CONTINUE' : 'UID REGISTRATION REQUIRED'}
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(255, 0, 60, 0.1)', border: '1px solid #ff003c', color: '#ff003c', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div style={{ backgroundColor: 'rgba(176, 255, 0, 0.1)', border: '1px solid #b0ff00', color: '#b0ff00', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>
              <User size={14} style={{ display: 'inline', marginRight: '0.5rem' }} /> 
              USERNAME
            </label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username" 
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label style={{ color: '#ff003c' }}>
                <Fingerprint size={14} style={{ display: 'inline', marginRight: '0.5rem' }} /> 
                ONE-TIME UID TOKEN
              </label>
              <input 
                type="text" 
                value={uid}
                onChange={(e) => setUid(e.target.value.toUpperCase())}
                placeholder="e.g. HVH-ABCD-1234" 
                required 
                style={{ borderColor: 'rgba(255,0,60,0.3)', textTransform: 'uppercase' }}
              />
            </div>
          )}
          
          <div className="form-group">
            <label>
              <Key size={14} style={{ display: 'inline', marginRight: '0.5rem' }} /> 
              PASSWORD
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "Enter your password" : "Create password (min 6 chars)"}
              required
              minLength={isLogin ? "1" : "6"}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            {isLogin ? 'LOGIN' : 'REDEEM UID & REGISTER'}
          </button>
        </form>

        <div className="auth-footer">
          <span className="text-muted">
            {isLogin ? "Don't have a UID?" : "Already redeemed a UID?"}
          </span>
          <button 
            type="button" 
            className="text-accent" 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
            }}
            style={{ marginLeft: '0.5rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}
          >
            {isLogin ? 'Enter UID' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
