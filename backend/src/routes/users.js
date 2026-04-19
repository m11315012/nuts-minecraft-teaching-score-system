const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// 列出所有使用者（teacher/admin）
router.get('/', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
  const role = req.query.role;
  const params = [];
  let where = '';
  if (role) { params.push(role); where = `WHERE role=$1`; }
  const { rows } = await pool.query(
    `SELECT id, username, display_name, role, level, exp, points, avatar_url, created_at
     FROM users ${where} ORDER BY role, display_name`,
    params
  );
  res.json(rows);
});

// 新增使用者（admin）
router.post('/', authRequired, requireRole('admin'), async (req, res) => {
  const { username, display_name, password, role = 'student', level = 1, exp = 0, points = 0 } = req.body || {};
  if (!username || !display_name || !password) {
    return res.status(400).json({ error: 'username, display_name, password required' });
  }
  if (!['student', 'teacher', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, display_name, password_hash, role, level, exp, points)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, username, display_name, role, level, exp, points`,
      [username, display_name, hash, role, level, exp, points]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'username already exists' });
    throw e;
  }
});

// 更新使用者基本資料 / 點數 / 等級（admin）
router.patch('/:id', authRequired, requireRole('admin'), async (req, res) => {
  const { display_name, role, level, exp, points, password } = req.body || {};
  const fields = [];
  const params = [];
  let i = 1;
  if (display_name !== undefined) { fields.push(`display_name=$${i++}`); params.push(display_name); }
  if (role !== undefined) {
    if (!['student', 'teacher', 'admin'].includes(role)) return res.status(400).json({ error: 'invalid role' });
    fields.push(`role=$${i++}`); params.push(role);
  }
  if (level !== undefined) { fields.push(`level=$${i++}`); params.push(Math.max(1, parseInt(level, 10))); }
  if (exp !== undefined)   { fields.push(`exp=$${i++}`);   params.push(Math.max(0, parseInt(exp, 10))); }
  if (points !== undefined){ fields.push(`points=$${i++}`);params.push(Math.max(0, parseInt(points, 10))); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    fields.push(`password_hash=$${i++}`); params.push(hash);
  }
  if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' });
  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id=$${i}
     RETURNING id, username, display_name, role, level, exp, points`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'user not found' });
  res.json(rows[0]);
});

// 點數加減（admin / teacher）— delta 可為正或負，會寫一筆 shop_logs 留紀錄
router.post('/:id/adjust-points', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
  const delta = parseInt(req.body?.delta, 10);
  const note = (req.body?.note || '').toString().slice(0, 80) || '手動調整';
  if (!Number.isFinite(delta) || delta === 0) {
    return res.status(400).json({ error: 'delta must be a non-zero integer' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query('SELECT id, points FROM users WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!u.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'user not found' }); }
    const newPoints = Math.max(0, u.rows[0].points + delta);
    const realDelta = newPoints - u.rows[0].points;
    const upd = await client.query(
      `UPDATE users SET points=$1 WHERE id=$2 RETURNING id, username, display_name, level, exp, points`,
      [newPoints, req.params.id]
    );
    await client.query(
      `INSERT INTO shop_logs (student_id, item_id, item_name, price_paid, quantity, note)
       VALUES ($1, NULL, $2, $3, 1, $4)`,
      [req.params.id, `[手動調整] ${note}`, -realDelta, `by ${req.user.username}`]
    );
    await client.query('COMMIT');
    res.json(upd.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
});

// 刪除使用者（admin）
router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
  if (req.params.id === req.user.sub) return res.status(400).json({ error: 'cannot delete yourself' });
  const r = await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'user not found' });
  res.json({ ok: true });
});

module.exports = router;
