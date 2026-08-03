import React, { useState, useEffect } from 'react';
import { ShieldAlert, Terminal, AlertOctagon, Info, Key, Users, Edit2, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const AdminPanelView = () => {
  const [activeTab, setActiveTab] = useState('uids');
  
  // States
  const [logs, setLogs] = useState([]);
  const [uids, setUids] = useState({});
  const [users, setUsers] = useState({});
  const [vips, setVips] = useState({});
  
  // Editing state for users
  const [editingUser, setEditingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const adminFetch = (endpoint, options = {}) => {
    return fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': localStorage.getItem('hvh_admin_token') || ''
      }
    });
  };

  const loadData = async () => {
    try {
      const uidsRes = await adminFetch(`/admin/uids`);
      if (uidsRes.ok) setUids(await uidsRes.json());
      
      const usersRes = await adminFetch(`/admin/users`);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users);
        setVips(usersData.vips);
      }
      
      const logsRes = await adminFetch(`/admin/logs`);
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (e) {
      console.error('Failed to load admin data', e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearLogs = async () => {
    await adminFetch(`/admin/logs`, { method: 'DELETE' });
    setLogs([]);
  };

  const generateUID = async () => {
    const res = await adminFetch(`/admin/uids`, { method: 'POST' });
    if (res.ok) {
      const newUidData = await res.json();
      setUids(prev => ({ ...prev, [newUidData.token]: { used: newUidData.used, usedBy: newUidData.usedBy } }));
    }
  };

  const deleteUID = async (uidKey) => {
    await adminFetch(`/admin/uids/${uidKey}`, { method: 'DELETE' });
    setUids(prev => {
      const updated = { ...prev };
      delete updated[uidKey];
      return updated;
    });
  };

  const startEditUser = (username) => {
    setEditingUser(username);
    setNewPassword(users[username]);
  };

  const saveUserPassword = async () => {
    await adminFetch(`/admin/users/${editingUser}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    setUsers(prev => ({ ...prev, [editingUser]: newPassword }));
    setEditingUser(null);
  };

  const deleteUser = async (username) => {
    if(window.confirm(`Are you sure you want to delete user ${username}?`)) {
      await adminFetch(`/admin/users/${username}`, { method: 'DELETE' });
      setUsers(prev => {
        const updated = { ...prev };
        delete updated[username];
        return updated;
      });
      setVips(prev => {
        const updated = { ...prev };
        delete updated[username];
        return updated;
      });
    }
  };

  const toggleVIP = async (username) => {
    const res = await adminFetch(`/admin/users/${username}/vip`, { method: 'PUT' });
    if (res.ok) {
      const data = await res.json();
      setVips(prev => {
        const updated = { ...prev };
        if (data.is_vip === 1) {
          updated[username] = true;
        } else {
          delete updated[username];
        }
        return updated;
      });
    }
  };

  const renderUIDs = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>ONE-TIME UIDs</h3>
        <button onClick={generateUID} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
          + GENERATE NEW UID
        </button>
      </div>
      
      <div style={{ backgroundColor: '#050505', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>TOKEN</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>STATUS</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>USED BY</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(uids).length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No UIDs generated yet.</td></tr>
            ) : (
              Object.entries(uids).reverse().map(([token, data]) => (
                <tr key={token} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem', color: 'var(--accent-color)', fontWeight: 'bold' }}>{token}</td>
                  <td style={{ padding: '1rem' }}>
                    {data.used ? 
                      <span style={{ color: '#ff003c', backgroundColor: 'rgba(255,0,60,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>BURNED</span> : 
                      <span style={{ color: '#b0ff00', backgroundColor: 'rgba(176,255,0,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>AVAILABLE</span>
                    }
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{data.usedBy || '-'}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button onClick={() => deleteUID(token)} style={{ background: 'none', border: 'none', color: '#ff003c', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>REGISTERED USERS ({Object.keys(users).length})</h3>
      </div>
      
      <div style={{ backgroundColor: '#050505', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>USERNAME</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>PASSWORD</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(users).length === 0 ? (
              <tr><td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No users registered.</td></tr>
            ) : (
              Object.entries(users).map(([username, pass]) => (
                <tr key={username} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem', color: vips[username] ? '#ffb400' : 'var(--text-primary)', fontWeight: vips[username] ? 'bold' : 'normal' }}>
                    {username} {vips[username] && <span style={{ fontSize: '0.65rem', border: '1px solid #ffb400', borderRadius: '4px', padding: '0.1rem 0.3rem', marginLeft: '0.5rem', verticalAlign: 'middle' }}>VIP</span>}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {editingUser === username ? (
                      <input 
                        type="text" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ padding: '0.3rem', backgroundColor: '#111', color: 'white', border: '1px solid var(--accent-color)' }}
                      />
                    ) : (
                      pass
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button onClick={() => toggleVIP(username)} style={{ background: 'none', border: 'none', color: vips[username] ? '#ffb400' : 'var(--text-muted)', cursor: 'pointer', marginRight: '1rem' }} title="Toggle VIP Status">
                      <ShieldAlert size={16} />
                    </button>
                    {editingUser === username ? (
                      <button onClick={saveUserPassword} style={{ background: 'var(--accent-color)', border: 'none', color: '#000', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}>Save</button>
                    ) : (
                      <button onClick={() => startEditUser(username)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', marginRight: '1rem' }}>
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button onClick={() => deleteUser(username)} style={{ background: 'none', border: 'none', color: '#ff003c', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>SECURITY LOGS</h3>
        {logs.length > 0 && (
          <button onClick={clearLogs} style={{ background: 'none', border: '1px solid #ff003c', color: '#ff003c', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            CLEAR LOGS
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#050505', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
          <ShieldAlert size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No intrusions detected.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {logs.map((log) => (
            <div key={log.id} style={{
              padding: '1rem',
              backgroundColor: '#050505',
              borderLeft: `4px solid ${log.type === 'CRITICAL' ? '#ff003c' : '#ffb400'}`,
              borderRadius: '0 4px 4px 0',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start'
            }}>
              {log.type === 'CRITICAL' ? <AlertOctagon color="#ff003c" size={20} style={{ flexShrink: 0, marginTop: '2px' }} /> : <Info color="#ffb400" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />}
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: log.type === 'CRITICAL' ? '#ff003c' : '#ffb400', fontWeight: 'bold', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                    [{log.type}] {log.message}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    {log.date} {log.time}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  <span><strong style={{ color: 'var(--text-primary)' }}>IP:</strong> {log.ip}</span>
                  <span><strong style={{ color: 'var(--text-primary)' }}>Attempted User:</strong> {log.userAttempt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <Terminal size={32} className="text-accent" />
        <h2 className="font-mono" style={{ margin: 0 }}>HVH ADMIN DASHBOARD</h2>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('uids')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'uids' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid var(--border-color)', color: activeTab === 'uids' ? 'var(--text-primary)' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Key size={16} /> UIDs
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'users' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid var(--border-color)', color: activeTab === 'users' ? 'var(--text-primary)' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Users size={16} /> Users
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'logs' ? 'rgba(255,0,60,0.1)' : 'transparent', border: '1px solid var(--border-color)', color: activeTab === 'logs' ? '#ff003c' : 'var(--text-muted)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ShieldAlert size={16} /> Intrusion Logs
        </button>
      </div>

      {activeTab === 'uids' && renderUIDs()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'logs' && renderLogs()}

    </div>
  );
};

export default AdminPanelView;
