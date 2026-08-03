import React, { useState, useEffect } from 'react';
import { User, Shield, Key, Bell, Palette, Camera } from 'lucide-react';

const ProfileView = ({ theme, setTheme, currentUser, onProfileUpdate }) => {
  // Load saved profile data or use defaults
  const [profileData, setProfileData] = useState(() => {
    const saved = localStorage.getItem(`hvh_profile_${currentUser}`);
    if (saved) return JSON.parse(saved);
    return {
      displayName: currentUser,
      status: 'Injecting...',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser}`
    };
  });

  const handleSave = () => {
    localStorage.setItem(`hvh_profile_${currentUser}`, JSON.stringify(profileData));
    alert('Profile settings saved successfully!');
    if (onProfileUpdate) onProfileUpdate();
  };

  const handleAvatarChange = () => {
    const url = prompt('Enter image URL for new avatar:', profileData.avatarUrl);
    if (url) {
      setProfileData({ ...profileData, avatarUrl: url });
    }
  };

  return (
    <div className="view-container">
      <h2 className="view-title">
        <User size={32} />
        Profile Settings
      </h2>

      <div className="profile-section">
        <div className="profile-header">
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={handleAvatarChange} title="Click to change avatar">
            <img 
              src={profileData.avatarUrl} 
              alt="Large Avatar" 
              className="profile-avatar-large"
              style={{ objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--bg-dark)', padding: '0.25rem', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
              <Camera size={16} className="text-primary" />
            </div>
          </div>
          <div className="profile-info">
            <h3 className="font-mono text-primary">{currentUser}</h3>
            <div className="badge">UID: {Math.floor(Math.random() * 9000) + 1000}</div>
          </div>
        </div>

        <div className="form-group">
          <label>Display Name</label>
          <input 
            type="text" 
            value={profileData.displayName} 
            onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })} 
          />
        </div>
        <div className="form-group">
          <label>Status Message</label>
          <input 
            type="text" 
            value={profileData.status}
            onChange={(e) => setProfileData({ ...profileData, status: e.target.value })}
          />
        </div>
        <button className="btn-primary" onClick={handleSave}>Save Profile</button>
      </div>

      <div className="profile-section">
        <h3 className="font-mono text-primary mb-4" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Palette size={20} className="text-accent" />
          Appearance
        </h3>
        <div className="form-group">
          <label>Accent Color</label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <div onClick={() => setTheme('purple')} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#bd00ff', cursor: 'pointer', boxShadow: theme === 'purple' ? '0 0 10px #bd00ff' : 'none', opacity: theme === 'purple' ? 1 : 0.5 }}></div>
            <div onClick={() => setTheme('green')} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#b0ff00', cursor: 'pointer', boxShadow: theme === 'green' ? '0 0 10px #b0ff00' : 'none', opacity: theme === 'green' ? 1 : 0.5 }}></div>
            <div onClick={() => setTheme('cyan')} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#00e5ff', cursor: 'pointer', boxShadow: theme === 'cyan' ? '0 0 10px #00e5ff' : 'none', opacity: theme === 'cyan' ? 1 : 0.5 }}></div>
            <div onClick={() => setTheme('red')} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#ff003c', cursor: 'pointer', boxShadow: theme === 'red' ? '0 0 10px #ff003c' : 'none', opacity: theme === 'red' ? 1 : 0.5 }}></div>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h3 className="font-mono text-primary mb-4" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} className="text-accent" />
          Security
        </h3>
        <div className="form-group">
          <label>Email</label>
          <input type="email" defaultValue={`${currentUser}@hvh.net`} disabled style={{ opacity: 0.5 }} />
        </div>
        <button className="btn-primary" onClick={() => alert('Password change request sent to email.')} style={{ backgroundColor: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
          Change Password
        </button>
      </div>
    </div>
  );
};

export default ProfileView;
