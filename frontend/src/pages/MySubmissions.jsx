import { useEffect, useState } from 'react';
import { quests } from '../api';

const STATUS_LABEL = { pending: '⏳ 審核中', approved: '✅ 通過', rejected: '❌ 退回' };

export default function MySubmissions() {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { quests.mine().then(setList).catch((e) => setMsg(e.message)); }, []);
  return (
    <>
      <h2>📦 我的任務提交</h2>
      {msg && <div className="panel">{msg}</div>}
      <div className="panel">
        {list.length === 0 ? <div className="muted">還沒有提交任務，快去任務板挑戰！</div> : (
          <table>
            <thead><tr><th>時間</th><th>任務</th><th>狀態</th><th>老師備註</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.submitted_at).toLocaleString('zh-TW')}</td>
                  <td>{s.quest_title}</td>
                  <td>{STATUS_LABEL[s.status]}</td>
                  <td>{s.review_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
