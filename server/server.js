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
app.use(express.json());

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
  db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, is_vip INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS uids (token TEXT PRIMARY KEY, used INTEGER DEFAULT 0, usedBy TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT, date TEXT, type TEXT, message TEXT, ip TEXT, userAttempt TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT, sender TEXT, text TEXT, time TEXT, type TEXT)`);
  
  // Insert initial messages if empty
  db.get("SELECT COUNT(*) as count FROM messages", (err, row) => {
    if (row && row.count === 0) {
      db.run(`INSERT INTO messages (channel, sender, text, time, type) VALUES ('general', 'system', 'Welcome to the HVH underground.', '12:00', 'text')`);
    }
  });
});

// REST API for Auth and Admin

app.post('/api/auth/register', (req, res) => {
  const { username, password, uid } = req.body;
  
  db.get("SELECT * FROM uids WHERE token = ?", [uid], (err, row) => {
    if (!row) return res.status(400).json({ error: 'Invalid UID. Token does not exist.' });
    if (row.used === 1) return res.status(400).json({ error: 'This UID has already been used and is burned.' });
    
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, userRow) => {
      if (userRow) return res.status(400).json({ error: 'Username already taken.' });
      
      db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], (err) => {
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
    const channels = { 'general': [], 'config-sharing': [], 'media': [] };
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
  
  socket.on('disconnect', () => {
    io.emit('online_count', io.engine.clientsCount);
  });

  socket.on('send_message', (msg) => {
    // msg = { channel, sender, text, time, type }
    db.run("INSERT INTO messages (channel, sender, text, time, type) VALUES (?, ?, ?, ?, ?)", 
      [msg.channel, msg.sender, msg.text, msg.time, msg.type], function(err) {
      
      const savedMsg = { ...msg, id: this.lastID };
      io.emit('new_message', savedMsg);
    });
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
