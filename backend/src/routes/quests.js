const express = require('express');
const pool = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

module.exports = (io) => {
  const router = express.Router();

  // 任務列表（所有登入者）
  router.get('/', authRequired, async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT q.*, u.display_name AS creator_name
       FROM quests q LEFT JOIN users u ON u.id = q.created_by
       WHERE q.is_active = TRUE
       ORDER BY q.created_at DESC`
    );
    res.json(rows);
  });

  // 老師建立任務
  router.post('/', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
    const { title, description, reward_exp = 0, reward_points = 0, difficulty = 'normal' } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    const { rows } = await pool.query(
      `INSERT INTO quests (title, description, reward_exp, reward_points, difficulty, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, description, reward_exp, reward_points, difficulty, req.user.sub]
    );
    res.status(201).json(rows[0]);
  });

  // 老師/管理員編輯任務
  router.patch('/:id', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
    const { title, description, reward_exp, reward_points, difficulty, is_active } = req.body || {};
    const fields = []; const params = []; let i = 1;
    if (title !== undefined)         { fields.push(`title=$${i++}`); params.push(title); }
    if (description !== undefined)   { fields.push(`description=$${i++}`); params.push(description); }
    if (reward_exp !== undefined)    { fields.push(`reward_exp=$${i++}`); params.push(parseInt(reward_exp, 10)); }
    if (reward_points !== undefined) { fields.push(`reward_points=$${i++}`); params.push(parseInt(reward_points, 10)); }
    if (difficulty !== undefined)    { fields.push(`difficulty=$${i++}`); params.push(difficulty); }
    if (is_active !== undefined)     { fields.push(`is_active=$${i++}`); params.push(!!is_active); }
    if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' });
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE quests SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, params
    );
    if (!rows[0]) return res.status(404).json({ error: 'quest not found' });
    res.json(rows[0]);
  });

  // 老師/管理員刪除任務（實際刪除；相關 submissions 因 ON DELETE CASCADE 會被清除）
  router.delete('/:id', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
    const r = await pool.query('DELETE FROM quests WHERE id=$1', [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'quest not found' });
    res.json({ ok: true });
  });

  // 學生提交任務
  router.post('/:id/submit', authRequired, requireRole('student'), async (req, res) => {
    const { content, attachment_url } = req.body || {};
    const questId = req.params.id;

    const q = await pool.query('SELECT * FROM quests WHERE id=$1 AND is_active=TRUE', [questId]);
    if (!q.rows[0]) return res.status(404).json({ error: 'quest not found' });

    // 檢查是否已提交過（同一個學生對同一個任務只能交一次）
    const dup = await pool.query(
      'SELECT 1 FROM submissions WHERE quest_id=$1 AND student_id=$2 LIMIT 1',
      [questId, req.user.sub]
    );
    if (dup.rows[0]) return res.status(409).json({ error: '你已經提交過這個任務了' });

    const { rows } = await pool.query(
      `INSERT INTO submissions (quest_id, student_id, content, attachment_url)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [questId, req.user.sub, content || null, attachment_url || null]
    );

    const s = rows[0];
    // 即時通知老師
    io.to('teachers').emit('submission:new', {
      submission_id: s.id,
      quest_title: q.rows[0].title,
      student: req.user.username,
      submitted_at: s.submitted_at,
    });

    res.status(201).json(s);
  });

  // 老師查看待審核
  router.get('/submissions/pending', authRequired, requireRole('teacher', 'admin'), async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT s.*, q.title AS quest_title, q.reward_exp, q.reward_points,
              u.display_name AS student_name, u.username AS student_username
       FROM submissions s
       JOIN quests q ON q.id = s.quest_id
       JOIN users u  ON u.id = s.student_id
       WHERE s.status='pending'
       ORDER BY s.submitted_at ASC`
    );
    res.json(rows);
  });

  // 學生查看自己的提交
  router.get('/submissions/mine', authRequired, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.*, q.title AS quest_title
       FROM submissions s JOIN quests q ON q.id = s.quest_id
       WHERE s.student_id=$1 ORDER BY s.submitted_at DESC`,
      [req.user.sub]
    );
    res.json(rows);
  });

  // 老師審核
  router.post('/submissions/:id/review', authRequired, requireRole('teacher', 'admin'), async (req, res) => {
    const { action, review_note } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sub = await client.query(
        `SELECT s.*, q.reward_exp, q.reward_points
         FROM submissions s JOIN quests q ON q.id=s.quest_id
         WHERE s.id=$1 FOR UPDATE`,
        [req.params.id]
      );
      if (!sub.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'submission not found' });
      }
      if (sub.rows[0].status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'already reviewed' });
      }

      const status = action === 'approve' ? 'approved' : 'rejected';
      const updated = await client.query(
        `UPDATE submissions SET status=$1, reviewed_by=$2, review_note=$3, reviewed_at=now()
         WHERE id=$4 RETURNING *`,
        [status, req.user.sub, review_note || null, req.params.id]
      );

      if (status === 'approved') {
        const newExp = await client.query(
          `UPDATE users
             SET exp = exp + $1,
                 points = points + $2,
                 level = GREATEST(1, 1 + ((exp + $1) / 100))
           WHERE id = $3
           RETURNING level, exp, points`,
          [sub.rows[0].reward_exp, sub.rows[0].reward_points, sub.rows[0].student_id]
        );
        await client.query('COMMIT');

        io.to(`user:${sub.rows[0].student_id}`).emit('submission:reviewed', {
          submission_id: sub.rows[0].id, status, review_note, stats: newExp.rows[0],
        });
        return res.json(updated.rows[0]);
      }

      await client.query('COMMIT');
      io.to(`user:${sub.rows[0].student_id}`).emit('submission:reviewed', {
        submission_id: sub.rows[0].id, status, review_note,
      });
      res.json(updated.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  return router;
};
