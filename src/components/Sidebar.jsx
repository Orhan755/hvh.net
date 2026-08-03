import React, { useState, useEffect } from 'react';
import { MessageSquare, Settings, FolderKanban, ShieldAlert, LogOut } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isAdmin, currentUser, profileUpdated }) => {
  const [avatarUrl, setAvatarUrl] = useState(`https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser || 'hvh'}`);

  useEffect(() => {
    const saved = localStorage.getItem(`hvh_profile_${currentUser}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.avatarUrl) {
          setAvatarUrl(data.avatarUrl);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentUser, profileUpdated]);

  const handleLogout = () => {
    localStorage.removeItem('hvh_session');
    window.location.reload();
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">hvh</div>
      
      <div className="sidebar-nav">
        <div 
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
          title="Chat"
        >
          <MessageSquare size={24} />
        </div>
        
        <div 
          className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
          title="Files & Scripts"
        >
          <FolderKanban size={24} />
        </div>

        {isAdmin && (
          <div 
            className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            title="Admin Dashboard"
            style={{ marginTop: 'auto', color: activeTab === 'security' ? '#ff003c' : 'inherit' }}
          >
            <ShieldAlert size={24} />
          </div>
        )}
        
        <div 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
          title="Profile Settings"
          style={!isAdmin ? { marginTop: 'auto' } : {}}
        >
          <Settings size={24} />
        </div>

        <div 
          className="nav-item"
          onClick={handleLogout}
          title="Logout"
          style={{ marginTop: isAdmin ? '0' : '0' }}
        >
          <LogOut size={24} />
        </div>
      </div>

      <div className="sidebar-profile">
        <img 
          src={avatarUrl} 
          alt="Avatar" 
          className="avatar"
          onClick={() => setActiveTab('profile')}
          title="My Profile"
          style={{ objectFit: 'cover' }}
        />
      </div>
    </div>
  );
};

export default Sidebar;
