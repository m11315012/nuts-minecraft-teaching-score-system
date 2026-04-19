import { useEffect, useState } from 'react';
import { shop } from '../api';

export default function ShopLogs() {
  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { shop.allLogs().then(setLogs).catch((e) => setMsg(e.message)); }, []);
  return (
    <>
      <h2>📒 全班兌換紀錄</h2>
      {msg && <div className="panel">{msg}</div>}
      <div className="panel">
        {logs.length === 0 ? <div className="muted">尚無紀錄</div> : (
          <table>
            <thead><tr><th>時間</th><th>學生</th><th>商品</th><th>數量</th><th>花費</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString('zh-TW')}</td>
                  <td>{l.student_name} ({l.student_username})</td>
                  <td>{l.item_name}</td>
                  <td>{l.quantity}</td>
                  <td>{l.price_paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
