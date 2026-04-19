import { useEffect, useState, useCallback } from 'react';
import { quests } from '../api';
import { getSocket } from '../socket';
import { useModal } from '../components/Modal';

export default function Review() {
  const modal = useModal();
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    quests.pending().then(setList).catch((e) => setMsg(e.message));
  }, []);

  useEffect(() => {
    load();
    const s = getSocket();
    if (!s) return;
    const h = () => load();
    s.on('submission:new', h);
    return () => s.off('submission:new', h);
  }, [load]);

  const act = async (id, action) => {
    let note = '';
    if (action === 'reject') {
      const r = await modal.prompt('退回原因', '請補充內容', { label: '原因' });
      if (r === null) return;
      note = r;
    }
    try {
      await quests.review(id, action, note);
      setMsg(action === 'approve' ? '✅ 已核准並發獎勵' : '已退回');
      load();
    } catch (e) { setMsg('❌ ' + e.message); }
  };

  return (
    <>
      <h2>🛡 老師審核台</h2>
      {msg && <div className="panel" style={{ padding: 10 }}>{msg}</div>}
      <div className="panel">
        {list.length === 0 ? <div className="muted">目前沒有待審核的提交 🎉</div> : (
          <table>
            <thead><tr><th>時間</th><th>學生</th><th>任務</th><th>說明</th><th>獎勵</th><th>動作</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.submitted_at).toLocaleString('zh-TW')}</td>
                  <td>{s.student_name} ({s.student_username})</td>
                  <td>{s.quest_title}</td>
                  <td>{s.content || '—'}</td>
                  <td>⭐{s.reward_exp} 💰{s.reward_points}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => act(s.id, 'approve')}>通過</button>{' '}
                    <button className="danger" onClick={() => act(s.id, 'reject')}>退回</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
