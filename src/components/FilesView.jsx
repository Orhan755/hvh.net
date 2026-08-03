import React, { useState, useRef } from 'react';
import { FileCode, FileImage, FileArchive, Download, Share2 } from 'lucide-react';

const INITIAL_FILES = [
  { id: 1, name: 'legit_v2.cfg', type: 'config', size: '12 KB', author: 'admin' },
  { id: 2, name: 'rage_hvh.cfg', type: 'config', size: '24 KB', author: 'username' },
  { id: 3, name: 'custom_script.lua', type: 'script', size: '4 KB', author: 'dev1' },
  { id: 4, name: 'hit_sound.wav', type: 'media', size: '156 KB', author: 'soundguy' },
  { id: 5, name: 'menu_theme.json', type: 'theme', size: '2 KB', author: 'designer' },
  { id: 6, name: 'dump.zip', type: 'archive', size: '1.2 MB', author: 'hax0r' },
];

const getIcon = (type) => {
  switch(type) {
    case 'config':
    case 'theme':
      return <FileCode size={32} className="file-icon" />;
    case 'script':
      return <FileCode size={32} className="file-icon" style={{ color: '#00e5ff' }} />;
    case 'media':
      return <FileImage size={32} className="file-icon" style={{ color: '#b500ff' }} />;
    case 'archive':
      return <FileArchive size={32} className="file-icon" style={{ color: '#ff003c' }} />;
    default:
      return <FileCode size={32} className="file-icon" />;
  }
};

const FilesView = () => {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState(INITIAL_FILES);

  const logAttempt = (type, message) => {
    const logs = JSON.parse(localStorage.getItem('hvh_logs') || '[]');
    logs.unshift({
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour12: false }),
      date: new Date().toLocaleDateString(),
      type: type,
      message: message,
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAttempt: 'Active User'
    });
    localStorage.setItem('hvh_logs', JSON.stringify(logs.slice(0, 50)));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check for webshells or malicious files
    const badExtensions = ['.php', '.sh', '.bash', '.exe', '.bat', '.cmd', '.py', '.pl'];
    const fileName = file.name.toLowerCase();
    
    const isMalicious = badExtensions.some(ext => fileName.endsWith(ext));

    if (isMalicious) {
      alert(`CRITICAL THREAT: Upload of ${fileName} blocked! Webshell/Malware signatures detected. Incident logged.`);
      logAttempt('CRITICAL', `Malicious File Upload Blocked: ${fileName}`);
    } else {
      alert(`${file.name} uploaded successfully!`);
      setFiles([{
        id: Date.now(),
        name: file.name,
        type: 'config', // defaulting new uploads to config for visual
        size: (file.size / 1024).toFixed(1) + ' KB',
        author: 'You'
      }, ...files]);
    }
    
    // reset input
    e.target.value = null;
  };

  return (
    <div className="view-container" style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="view-title" style={{ marginBottom: 0 }}>
          Files & Scripts
        </h2>
        {/* Hidden file input for handling the upload */}
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
        />
        <button className="btn-primary" onClick={() => fileInputRef.current.click()}>Upload File</button>
      </div>

      <div className="files-grid">
        {files.map(file => (
          <div key={file.id} className="file-card">
            {getIcon(file.type)}
            <div className="file-name" title={file.name}>{file.name}</div>
            <div className="file-meta">
              <div>{file.size}</div>
              <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>by {file.author}</div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', width: '100%' }}>
              <button onClick={(e) => { e.stopPropagation(); alert(`Downloading ${file.name}...`); }} style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-dark)', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                <Download size={16} className="text-primary" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); alert(`Sharing link for ${file.name} copied to clipboard!`); }} style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-dark)', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                <Share2 size={16} className="text-primary" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilesView;
