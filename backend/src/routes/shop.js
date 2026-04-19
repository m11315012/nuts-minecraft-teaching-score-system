const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = function(io) {
  const router = express.Router();

// 商品列表
router.get('/items', authRequired, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM shop_items WHERE is_active=TRUE ORDER BY price ASC`
  );
  res.json(rows);
});

// 兌換
router.post('/items/:id/redeem', authRequired, requireRole('student'), async (req, res) => {
  const quantity = Math.max(1, parseInt(req.body?.quantity || 1, 10));
  const itemId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const itemQ = await client.query('SELECT * FROM shop_items WHERE id=$1 AND is_active=TRUE FOR UPDATE', [itemId]);
    const item = itemQ.rows[0];
    if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'item not found' }); }
    if (item.stock !== -1 && item.stock < quantity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'out of stock' });
    }

    const total = item.price * quantity;
    const userQ = await client.query('SELECT points FROM users WHERE id=$1 FOR UPDATE', [req.user.sub]);
    if (userQ.rows[0].points < total) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'not enough points' });
    }

    await client.query('UPDATE users SET points = points - $1 WHERE id=$2', [total, req.user.sub]);
    if (item.stock !== -1) {
      await client.query('UPDATE shop_items SET stock = stock - $1 WHERE id=$2', [quantity, itemId]);
    }
    const log = await client.query(
      `INSERT INTO shop_logs (student_id, item_id, item_name, price_paid, quantity)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.sub, itemId, item.name, total, quantity]
    );

    await client.query('COMMIT');

    // 即時通知老師：學生兌換商品
    io.to('teachers').emit('shop:redeemed', {
      log_id: log.rows[0].id,
      student: req.user.username,
      item_name: item.name,
      quantity,
      price_paid: total,
      created_at: log.rows[0].created_at,
    });

    res.status(201).json(log.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
});

// 我的兌換紀錄
router.get('/logs/mine', authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM shop_logs WHERE student_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.sub]
  );
  res.json(rows);
});

// 老師看全部兌換紀錄
router.get('/logs', authRequired, requireRole('teacher', 'admin'), async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT l.*, u.display_name AS student_name, u.username AS student_username
     FROM shop_logs l JOIN users u ON u.id = l.student_id
     ORDER BY l.created_at DESC LIMIT 200`
  );
  res.json(rows);
});

// --- 商品管理（teacher / admin）---
router.post('/items', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
  const { name, description, price, stock = -1, icon_url } = req.body || {};
  if (!name || price === undefined) return res.status(400).json({ error: 'name and price required' });
  const { rows } = await pool.query(
    `INSERT INTO shop_items (name, description, price, stock, icon_url)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, description || null, parseInt(price, 10), parseInt(stock, 10), icon_url || null]
  );
  res.status(201).json(rows[0]);
});

router.patch('/items/:id', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
  const { name, description, price, stock, icon_url, is_active } = req.body || {};
  const fields = []; const params = []; let i = 1;
  if (name !== undefined)        { fields.push(`name=$${i++}`); params.push(name); }
  if (description !== undefined) { fields.push(`description=$${i++}`); params.push(description); }
  if (price !== undefined)       { fields.push(`price=$${i++}`); params.push(parseInt(price, 10)); }
  if (stock !== undefined)       { fields.push(`stock=$${i++}`); params.push(parseInt(stock, 10)); }
  if (icon_url !== undefined)    { fields.push(`icon_url=$${i++}`); params.push(icon_url); }
  if (is_active !== undefined)   { fields.push(`is_active=$${i++}`); params.push(!!is_active); }
  if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' });
  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE shop_items SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, params
  );
  if (!rows[0]) return res.status(404).json({ error: 'item not found' });
  res.json(rows[0]);
});

router.delete('/items/:id', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
  const r = await pool.query('DELETE FROM shop_items WHERE id=$1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'item not found' });
  res.json({ ok: true });
});

return router;
};
