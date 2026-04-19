const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { sign, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = sign(user);
  res.json({
    token,
    user: {
      id: user.id, username: user.username, display_name: user.display_name,
      role: user.role, level: user.level, exp: user.exp, points: user.points,
    },
  });
});

router.get('/me', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, display_name, role, level, exp, points, avatar_url FROM users WHERE id=$1',
    [req.user.sub]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.post('/logout', authRequired, (_req, res) => {
  // JWT 無狀態，前端刪掉 token 即可
  res.json({ ok: true });
});

module.exports = router;
