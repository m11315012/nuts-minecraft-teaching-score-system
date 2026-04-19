import { useEffect, useState } from 'react';
import { shop } from '../api';
import { useAuth } from '../AuthContext';
import { useModal } from '../components/Modal';

export default function Shop() {
  const { user, refresh } = useAuth();
  const modal = useModal();
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState('');
  const isTeacher = user.role === 'teacher' || user.role === 'admin';

  const load = async () => {
    setItems(await shop.items());
    if (user.role === 'student') setLogs(await shop.myLogs());
  };
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const redeem = async (id, name, price) => {
    const ok = await modal.confirm(`確定花 ${price} 點兌換「${name}」？`);
    if (!ok) return;
    try {
      await shop.redeem(id, 1);
      setMsg(`🎉 成功兌換 ${name}`);
      await refresh();
      await load();
    } catch (e) { setMsg('❌ ' + e.message); }
  };

  const create = async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = {
      name: f.name.value,
      description: f.description.value,
      price: Number(f.price.value || 0),
      stock: Number(f.stock.value || -1),
    };
    try { await shop.createItem(data); f.reset(); setMsg('✅ 已新增商品'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const edit = async (it) => {
    const result = await modal.form('編輯商品', [
      { name: 'name', label: '商品名稱', defaultValue: it.name, required: true },
      { name: 'description', label: '描述', type: 'textarea', defaultValue: it.description || '', required: false },
      { name: 'price', label: '價格', type: 'number', defaultValue: it.price },
      { name: 'stock', label: '庫存（-1 為無限）', type: 'number', defaultValue: it.stock },
    ]);
    if (!result) return;
    try { await shop.updateItem(it.id, result); setMsg('✅ 已更新'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const toggleActive = async (it) => {
    try { await shop.updateItem(it.id, { is_active: !it.is_active }); setMsg(`✅ 已${it.is_active ? '下架' : '上架'}`); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const del = async (it) => {
    const ok = await modal.confirm(`確定刪除商品「${it.name}」？`, { danger: true, okText: '刪除' });
    if (!ok) return;
    try { await shop.deleteItem(it.id); setMsg('🗑 已刪除'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  return (
    <>
      <h2>🛒 學生兌換商店</h2>
      {msg && <div className="panel" style={{ padding: 10 }}>{msg}</div>}

      {isTeacher && (
        <div className="panel">
          <h3>➕ 新增商品</h3>
          <form onSubmit={create} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <input name="name" placeholder="商品名稱" required />
            <input name="description" placeholder="描述" />
            <input name="price" type="number" placeholder="價格" defaultValue={100} />
            <input name="stock" type="number" placeholder="庫存(-1無限)" defaultValue={-1} />
            <button type="submit" style={{ gridColumn: '1 / -1' }}>建立商品</button>
          </form>
        </div>
      )}

      <div className="grid">
        {items.map((it) => (
          <div className="card" key={it.id}>
            <h3>{it.name}</h3>
            <p>{it.description}</p>
            <div className="muted">
              💰 {it.price} 點 · {it.stock === -1 ? '∞' : `剩 ${it.stock}`}
            </div>
            {user.role === 'student' && (
              <button
                style={{ marginTop: 10 }}
                disabled={user.points < it.price || (it.stock !== -1 && it.stock === 0)}
                onClick={() => redeem(it.id, it.name, it.price)}
              >
                兌換
              </button>
            )}
            {isTeacher && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="secondary" onClick={() => edit(it)}>編輯</button>
                <button className="secondary" onClick={() => toggleActive(it)}>{it.is_active ? '下架' : '上架'}</button>
                <button className="secondary" onClick={() => del(it)}>🗑 刪除</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {user.role === 'student' && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>我的兌換紀錄</h3>
          {logs.length === 0 ? <div className="muted">尚無紀錄</div> : (
            <table>
              <thead><tr><th>時間</th><th>商品</th><th>數量</th><th>花費</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString('zh-TW')}</td>
                    <td>{l.item_name}</td>
                    <td>{l.quantity}</td>
                    <td>{l.price_paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
