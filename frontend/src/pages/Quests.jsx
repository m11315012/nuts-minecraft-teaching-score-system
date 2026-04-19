import { useEffect, useState } from 'react';
import { quests as qapi } from '../api';
import { useAuth } from '../AuthContext';
import { useModal } from '../components/Modal';

export default function Quests() {
  const { user } = useAuth();
  const modal = useModal();
  const [list, setList] = useState([]);
  const [mine, setMine] = useState([]);
  const [msg, setMsg] = useState('');
  const isTeacher = user.role === 'teacher' || user.role === 'admin';

  const submittedIds = new Set(mine.map((s) => s.quest_id));

  const load = async () => {
    try {
      const quests = await qapi.list();
      setList(quests);
      if (user.role === 'student') {
        const mySubs = await qapi.mine();
        setMine(mySubs);
      }
    } catch (e) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (questId) => {
    const content = await modal.prompt('提交任務', '已完成', { label: '提交說明' });
    if (content === null) return;
    try { await qapi.submit(questId, { content }); setMsg('✅ 已提交，等待老師審核'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const create = async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = {
      title: f.title.value,
      description: f.description.value,
      reward_exp: Number(f.reward_exp.value || 0),
      reward_points: Number(f.reward_points.value || 0),
      difficulty: f.difficulty.value,
    };
    try { await qapi.create(data); f.reset(); setMsg('✅ 任務已建立'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const edit = async (q) => {
    const result = await modal.form('編輯任務', [
      { name: 'title', label: '任務名稱', defaultValue: q.title, required: true },
      { name: 'description', label: '任務描述', type: 'textarea', defaultValue: q.description || '', required: false },
      { name: 'reward_exp', label: 'EXP 獎勵', type: 'number', defaultValue: q.reward_exp },
      { name: 'reward_points', label: '點數獎勵', type: 'number', defaultValue: q.reward_points },
      { name: 'difficulty', label: '難度', type: 'select', defaultValue: q.difficulty, options: [
        { value: 'easy', label: 'easy' }, { value: 'normal', label: 'normal' },
        { value: 'hard', label: 'hard' }, { value: 'boss', label: 'boss' },
      ]},
    ]);
    if (!result) return;
    try { await qapi.update(q.id, result); setMsg('✅ 已更新'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const toggleActive = async (q) => {
    try { await qapi.update(q.id, { is_active: !q.is_active }); setMsg(`✅ 已${q.is_active ? '停用' : '啟用'}`); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const del = async (q) => {
    const ok = await modal.confirm(`確定刪除任務「${q.title}」？\n所有相關提交都會一併刪除。`, { danger: true, okText: '刪除' });
    if (!ok) return;
    try { await qapi.remove(q.id); setMsg('🗑 已刪除'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  return (
    <>
      <h2>📜 任務公告板</h2>
      {msg && <div className="panel" style={{ padding: 10 }}>{msg}</div>}

      {isTeacher && (
        <div className="panel">
          <h3>➕ 建立新任務</h3>
          <form onSubmit={create} style={{ display: 'grid', gap: 8 }}>
            <input name="title" placeholder="任務名稱" required />
            <textarea name="description" placeholder="任務描述" rows={2} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input name="reward_exp" type="number" placeholder="EXP 獎勵" defaultValue={50} />
              <input name="reward_points" type="number" placeholder="點數獎勵" defaultValue={20} />
              <select name="difficulty" defaultValue="normal" style={{ padding: 8, background: '#1a1a1a', color: '#fff', border: '3px solid #555' }}>
                <option value="easy">easy</option>
                <option value="normal">normal</option>
                <option value="hard">hard</option>
                <option value="boss">boss</option>
              </select>
            </div>
            <button type="submit">建立任務</button>
          </form>
        </div>
      )}

      <div className="grid">
        {list.map((q) => (
          <div className="card" key={q.id}>
            <h3>{q.title}</h3>
            <span className={`tag ${q.difficulty}`}>{q.difficulty}</span>
            <p>{q.description}</p>
            <div className="muted">獎勵：⭐ {q.reward_exp} EXP · 💰 {q.reward_points} 點</div>
            <div className="muted">發布者：{q.creator_name || '—'}</div>
            {user.role === 'student' && (
              <div style={{ marginTop: 10 }}>
                {submittedIds.has(q.id) ? (
                  <button disabled>已提交 ✓</button>
                ) : (
                  <button onClick={() => submit(q.id)}>提交任務</button>
                )}
              </div>
            )}
            {isTeacher && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="secondary" onClick={() => edit(q)}>編輯</button>
                <button className="secondary" onClick={() => toggleActive(q)}>{q.is_active ? '停用' : '啟用'}</button>
                <button className="secondary" onClick={() => del(q)}>🗑 刪除</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
