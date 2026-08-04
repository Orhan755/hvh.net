const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const ADMIN_KEY = process.env.ADMIN_KEY || 'hvh_master_2026';

const adminAuth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === ADMIN_KEY) {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized Admin Access' });
  }
};

// Database setup
const dbPath = path.resolve(__dirname, 'hvh.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, is_vip INTEGER DEFAULT 0, profile_pic TEXT, status_text TEXT, join_date TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS uids (token TEXT PRIMARY KEY, used INTEGER DEFAULT 0, usedBy TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, date TEXT, type TEXT, message TEXT, ip TEXT, userAttempt TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT, sender TEXT, text TEXT, time TEXT, type TEXT, deleted INTEGER DEFAULT 0, edited INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS private_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, receiver TEXT, text TEXT, time TEXT, type TEXT, deleted INTEGER DEFAULT 0, edited INTEGER DEFAULT 0)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS channels (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, password TEXT, admin_id TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS pinned_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT, message_id INTEGER)`);
  
  // Safely add columns to existing tables if they don't exist
  db.run("ALTER TABLE users ADD COLUMN profile_pic TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN status_text TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN join_date TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN last_seen TEXT", () => {});
  db.run("ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0", () => {});
  db.run("ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0", () => {});
  db.run("ALTER TABLE private_messages ADD COLUMN is_read INTEGER DEFAULT 0", () => {});

  // Insert initial messages if empty
  db.get("SELECT COUNT(*) as count FROM messages", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO messages (channel, sender, text, time, type) VALUES ('general', 'system', 'Welcome to the HVH underground.', '12:00', 'text')`);
    }
  });

  db.get("SELECT COUNT(*) as count FROM channels", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO channels (name, password, admin_id) VALUES ('general', '', 'system')`);
      db.run(`INSERT INTO channels (name, password, admin_id) VALUES ('config-sharing', '', 'system')`);
      db.run(`INSERT INTO channels (name, password, admin_id) VALUES ('media', '', 'system')`);
    }
  });
});

// REST API for Auth and Admin

app.post('/api/auth/register', (req, res) => {
  const { username, password, uid } = req.body;
  const joinDate = new Date().toLocaleDateString();
  
  db.get("SELECT * FROM uids WHERE token = ?", [uid], (err, row) => {
    if (!row) return res.status(400).json({ error: 'Invalid UID. Token does not exist.' });
    if (row.used === 1) return res.status(400).json({ error: 'This UID has already been used and is burned.' });
    
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, userRow) => {
      if (userRow) return res.status(400).json({ error: 'Username already taken.' });
      
      db.run("INSERT INTO users (username, password, join_date) VALUES (?, ?, ?)", [username, password, joinDate], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        db.run("UPDATE uids SET used = 1, usedBy = ? WHERE token = ?", [username, uid], () => {
          res.json({ success: true, message: 'Account created successfully.' });
        });
      });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (!row) return res.status(401).json({ error: 'Invalid credentials.' });
    res.json({ success: true, username: row.username, isVip: row.is_vip });
  });
});

app.post('/api/auth/sudo', (req, res) => {
  const { key } = req.body;
  if (key === ADMIN_KEY) {
    res.json({ success: true, token: ADMIN_KEY });
  } else {
    res.status(403).json({ error: 'CRITICAL: Unauthorized sudo attempt locked out.' });
  }
});

// Profiles & DMs
app.get('/api/users/:username/profile', (req, res) => {
  db.get("SELECT username, is_vip, profile_pic, status_text, join_date, last_seen FROM users WHERE username = ?", [req.params.username], (err, row) => {
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });
});

app.put('/api/users/:username/profile', (req, res) => {
  const { profile_pic, status_text } = req.body;
  db.run("UPDATE users SET profile_pic = ?, status_text = ? WHERE username = ?", [profile_pic, status_text, req.params.username], () => {
    res.json({ success: true });
  });
});

app.get('/api/dms/:user1/:user2', (req, res) => {
  const { user1, user2 } = req.params;
  db.all("SELECT * FROM private_messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY id ASC", 
    [user1, user2, user2, user1], (err, rows) => {
    res.json(rows || []);
  });
});

app.get('/api/channels', (req, res) => {
  db.all("SELECT id, name, admin_id, CASE WHEN password != '' THEN 1 ELSE 0 END as is_locked FROM channels", (err, rows) => {
    res.json(rows || []);
  });
});

app.post('/api/channels', (req, res) => {
  const { name, password, admin_id } = req.body;
  if (!name) return res.status(400).json({error: 'Channel name required'});
  db.run("INSERT INTO channels (name, password, admin_id) VALUES (?, ?, ?)", [name, password || '', admin_id], function(err) {
    if (err) return res.status(400).json({error: 'Channel already exists'});
    io.emit('new_channel', { id: this.lastID, name, admin_id, is_locked: !!password });
    res.json({ success: true, id: this.lastID, name, is_locked: !!password });
  });
});

app.post('/api/channels/verify', (req, res) => {
  const { name, password } = req.body;
  db.get("SELECT * FROM channels WHERE name = ?", [name], (err, row) => {
    if (!row) return res.status(404).json({error: 'Channel not found'});
    if (!row.password || row.password === password) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Invalid password' });
    }
  });
});

app.get('/api/pins/:channel', (req, res) => {
  db.all(`SELECT p.id as pin_id, m.* FROM pinned_messages p JOIN messages m ON p.message_id = m.id WHERE p.channel = ?`, [req.params.channel], (err, rows) => {
    res.json(rows || []);
  });
});


// Admin endpoints
app.post('/api/admin/uids', adminAuth, (req, res) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const block = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const newUid = `HVH-${block()}-${block()}`;
  db.run("INSERT INTO uids (token, used) VALUES (?, 0)", [newUid], (err) => {
    res.json({ token: newUid, used: false, usedBy: null });
  });
});

app.get('/api/admin/uids', adminAuth, (req, res) => {
  db.all("SELECT * FROM uids", (err, rows) => {
    const uidMap = {};
    if(rows) {
        rows.forEach(r => { uidMap[r.token] = { used: r.used === 1, usedBy: r.usedBy }; });
    }
    res.json(uidMap);
  });
});

app.delete('/api/admin/uids/:token', adminAuth, (req, res) => {
  db.run("DELETE FROM uids WHERE token = ?", [req.params.token], () => res.json({ success: true }));
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  db.all("SELECT * FROM users", (err, rows) => {
    const userMap = {};
    const vipMap = {};
    if(rows) {
        rows.forEach(r => {
        userMap[r.username] = r.password;
        if (r.is_vip === 1) vipMap[r.username] = true;
        });
    }
    res.json({ users: userMap, vips: vipMap });
  });
});

app.put('/api/admin/users/:username/password', adminAuth, (req, res) => {
  db.run("UPDATE users SET password = ? WHERE username = ?", [req.body.password, req.params.username], () => {
    res.json({ success: true });
  });
});

app.delete('/api/admin/users/:username', adminAuth, (req, res) => {
  db.run("DELETE FROM users WHERE username = ?", [req.params.username], () => res.json({ success: true }));
});

app.put('/api/admin/users/:username/vip', adminAuth, (req, res) => {
  db.get("SELECT is_vip FROM users WHERE username = ?", [req.params.username], (err, row) => {
    if(row) {
      const newVip = row.is_vip === 1 ? 0 : 1;
      db.run("UPDATE users SET is_vip = ? WHERE username = ?", [newVip, req.params.username], () => {
        io.emit('vip_update', { username: req.params.username, is_vip: newVip });
        res.json({ success: true, is_vip: newVip });
      });
    } else {
      res.status(404).json({error: 'User not found'});
    }
  });
});

app.get('/api/admin/logs', adminAuth, (req, res) => {
  db.all("SELECT * FROM logs ORDER BY id DESC LIMIT 50", (err, rows) => res.json(rows || []));
});

// This stays public for client reporting
app.post('/api/admin/logs', (req, res) => {
  const { type, message, ip, userAttempt } = req.body;
  const date = new Date().toLocaleDateString();
  const time = new Date().toLocaleTimeString([], { hour12: false });
  db.run("INSERT INTO logs (time, date, type, message, ip, userAttempt) VALUES (?, ?, ?, ?, ?, ?)", 
    [time, date, type, message, ip, userAttempt], () => res.json({ success: true }));
});

app.delete('/api/admin/logs', adminAuth, (req, res) => {
  db.run("DELETE FROM logs", () => res.json({ success: true }));
});

// Stats
app.get('/api/stats', (req, res) => {
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    res.json({ totalUsers: row ? row.count : 0, onlineUsers: io.engine.clientsCount });
  });
});

// Initial Messages
app.get('/api/messages', (req, res) => {
  db.all("SELECT * FROM messages ORDER BY id ASC", (err, rows) => {
    const channels = {};
    if(rows) {
        rows.forEach(msg => {
        if (!channels[msg.channel]) channels[msg.channel] = [];
        channels[msg.channel].push(msg);
        });
    }
    res.json(channels);
  });
});

app.get('/api/vips', (req, res) => {
    db.all("SELECT username FROM users WHERE is_vip = 1", (err, rows) => {
        const vipMap = {};
        if(rows) {
            rows.forEach(r => { vipMap[r.username] = true; });
        }
        res.json(vipMap);
    });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  io.emit('online_count', io.engine.clientsCount);
  
  socket.on('set_active', (username) => {
    socket.username = username;
    db.run("UPDATE users SET last_seen = 'Online' WHERE username = ?", [username]);
    io.emit('user_status', { username, status: 'Online' });
  });

  socket.on('disconnect', () => {
    io.emit('online_count', io.engine.clientsCount);
    if (socket.username) {
      const time = new Date().toLocaleString();
      db.run("UPDATE users SET last_seen = ? WHERE username = ?", [time, socket.username]);
      io.emit('user_status', { username: socket.username, status: time });
    }
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('user_typing', data); // { channel, username }
  });
  
  socket.on('stop_typing', (data) => {
    socket.broadcast.emit('user_stop_typing', data);
  });

  socket.on('delete_message', (data) => {
    // data: { id, isDm }
    const table = data.isDm ? 'private_messages' : 'messages';
    db.run(`UPDATE ${table} SET deleted = 1, text = '🚫 This message was deleted' WHERE id = ?`, [data.id], () => {
      io.emit('message_deleted', data);
    });
  });

  socket.on('edit_message', (data) => {
    // data: { id, isDm, newText }
    const table = data.isDm ? 'private_messages' : 'messages';
    db.run(`UPDATE ${table} SET edited = 1, text = ? WHERE id = ?`, [data.newText, data.id], () => {
      io.emit('message_edited', data);
    });
  });

  socket.on('send_dm', (msg) => {
    db.run("INSERT INTO private_messages (sender, receiver, text, time, type) VALUES (?, ?, ?, ?, ?)", 
      [msg.sender, msg.receiver, msg.text, msg.time, msg.type], function(err) {
      const savedMsg = { ...msg, id: this.lastID };
      io.emit('new_dm', savedMsg);
    });
  });

  socket.on('send_message', (msg) => {
    db.run("INSERT INTO messages (channel, sender, text, time, type) VALUES (?, ?, ?, ?, ?)", 
      [msg.channel, msg.sender, msg.text, msg.time, msg.type], function(err) {
      const savedMsg = { ...msg, id: this.lastID };
      io.emit('new_message', savedMsg);
    });
  });

  // Next-Gen Feature Sockets
  socket.on('mark_read', (data) => {
    db.run("UPDATE private_messages SET is_read = 1 WHERE sender = ? AND receiver = ?", [data.sender, data.receiver], () => {
      io.emit('messages_read', data);
    });
  });

  socket.on('pin_message', (data) => {
    db.run("INSERT INTO pinned_messages (channel, message_id) VALUES (?, ?)", [data.channel, data.message_id], function(err) {
       io.emit('message_pinned', { pin_id: this.lastID, channel: data.channel, message_id: data.message_id });
    });
  });
  
  socket.on('unpin_message', (data) => {
    db.run("DELETE FROM pinned_messages WHERE id = ?", [data.pin_id], () => {
       io.emit('message_unpinned', data);
    });
  });

  // WebRTC Signaling
  socket.on('call_user', (data) => {
    socket.broadcast.emit('incoming_call', data);
  });

  socket.on('answer_call', (data) => {
    socket.broadcast.emit('call_accepted', data);
  });
  
  socket.on('end_call', (data) => {
    socket.broadcast.emit('call_ended', data);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
