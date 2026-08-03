import React, { useState, useEffect } from 'react';
import { ShieldAlert, Terminal, AlertOctagon, Info } from 'lucide-react';

const SecurityLogsView = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Load logs from local storage
    const savedLogs = JSON.parse(localStorage.getItem('hvh_logs') || '[]');
    setLogs(savedLogs);
    
    // Simulate real-time polling
    const interval = setInterval(() => {
      const currentLogs = JSON.parse(localStorage.getItem('hvh_logs') || '[]');
      setLogs(currentLogs);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const clearLogs = () => {
    localStorage.removeItem('hvh_logs');
    setLogs([]);
  };

  return (
    <div className="view-container" style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="view-title" style={{ marginBottom: 0, color: '#ff003c', textShadow: '0 0 15px rgba(255, 0, 60, 0.5)' }}>
          <ShieldAlert size={32} />
          Intrusion Detection System
        </h2>
        <button onClick={clearLogs} className="btn-primary" style={{ backgroundColor: 'transparent', border: '1px solid #ff003c', color: '#ff003c' }}>
          Clear Logs
        </button>
      </div>

      <div style={{ backgroundColor: '#050505', border: '1px solid #ff003c', borderRadius: '8px', padding: '1rem', height: '600px', overflowY: 'auto', fontFamily: 'var(--font-mono)' }}>
        {logs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <Terminal size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>System secure. No recent intrusion attempts.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logs.map(log => (
              <div key={log.id} style={{ 
                borderLeft: `4px solid ${log.type === 'CRITICAL' ? '#ff003c' : '#ffb700'}`, 
                padding: '1rem', 
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <span>{log.date} {log.time}</span>
                  <span>IP: {log.ip}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: log.type === 'CRITICAL' ? '#ff003c' : '#ffb700' }}>
                  {log.type === 'CRITICAL' ? <AlertOctagon size={16} /> : <Info size={16} />}
                  <strong style={{ letterSpacing: '1px' }}>[{log.type}]</strong> {log.message}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Attempted Username: <span style={{ color: 'var(--text-primary)' }}>{log.userAttempt}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityLogsView;
