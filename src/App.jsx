import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import ProfileView from './components/ProfileView';
import FilesView from './components/FilesView';
import AuthView from './components/AuthView';
import AdminPanelView from './components/AdminPanelView';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('hvh_session') !== null;
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    const session = localStorage.getItem('hvh_session');
    return session ? JSON.parse(session).admin : false;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const session = localStorage.getItem('hvh_session');
    return session ? JSON.parse(session).user : '';
  });
  const [activeTab, setActiveTab] = useState('chat');
  const [theme, setTheme] = useState('purple');
  const [profileUpdated, setProfileUpdated] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogin = (admin = false, user = 'user') => {
    localStorage.setItem('hvh_session', JSON.stringify({ admin, user }));
    setIsAdmin(admin);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <AuthView onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'chat':
        return <ChatView />;
      case 'profile':
        return <ProfileView theme={theme} setTheme={setTheme} currentUser={currentUser} onProfileUpdate={() => setProfileUpdated(prev => prev + 1)} />;
      case 'files':
        return <FilesView />;
      case 'security':
        return isAdmin ? <AdminPanelView /> : <ChatView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} currentUser={currentUser} profileUpdated={profileUpdated} />
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
