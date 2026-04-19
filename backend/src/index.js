const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const questRoutes = require('./routes/quests');
const shopRoutes = require('./routes/shop');
const userRoutes = require('./routes/users');
const { verifyToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
  path: '/socket.io',
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/quests', questRoutes(io));
app.use('/shop', shopRoutes(io));
app.use('/users', userRoutes);

// 錯誤處理
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

// Socket.IO 認證
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const user = token && verifyToken(token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  const u = socket.data.user;
  socket.join(`user:${u.sub}`);
  if (u.role === 'teacher' || u.role === 'admin') socket.join('teachers');
  console.log(`[ws] ${u.username} (${u.role}) connected`);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`ClassQuest backend listening on :${PORT}`));
