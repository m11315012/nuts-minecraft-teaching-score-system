import { useEffect, useState } from 'react';
import { users as uapi } from '../api';
import { useAuth } from '../AuthContext';
import { useModal } from '../components/Modal';

export default function Admin() {
  const { user } = useAuth();
  const modal = useModal();
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');
  const isAdmin = user.role === 'admin';

  const load = () => uapi.list().then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  const adjust = async (u) => {
    const result = await modal.form(`調整「${u.display_name}」的點數（目前 ${u.points}）`, [
      { name: 'delta', label: '點數變化（正=加，負=扣）', type: 'number', defaultValue: '10' },
      { name: 'note', label: '備註（選填）', defaultValue: '獎勵', required: false },
    ]);
    if (!result) return;
    const delta = parseInt(result.delta, 10);
    if (!Number.isFinite(delta) || delta === 0) { setMsg('❌ 請輸入非零整數'); return; }
    try { await uapi.adjustPoints(u.id, delta, result.note || ''); setMsg(`✅ 已${delta > 0 ? '加' : '扣'} ${Math.abs(delta)} 點給 ${u.display_name}`); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const editUser = async (u) => {
    const result = await modal.form('編輯使用者', [
      { name: 'display_name', label: '顯示名稱', defaultValue: u.display_name, required: true },
      { name: 'level', label: '等級', type: 'number', defaultValue: u.level },
      { name: 'exp', label: 'EXP', type: 'number', defaultValue: u.exp },
      { name: 'points', label: '點數', type: 'number', defaultValue: u.points },
    ]);
    if (!result) return;
    try { await uapi.update(u.id, result); setMsg('✅ 已更新'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const resetPwd = async (u) => {
    const password = await modal.prompt(`設定 ${u.username} 的新密碼`, '', { label: '新密碼', inputType: 'password' });
    if (!password) return;
    try { await uapi.update(u.id, { password }); setMsg('✅ 密碼已更新'); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const changeRole = async (u) => {
    const result = await modal.form('變更角色', [
      { name: 'role', label: '角色', type: 'select', defaultValue: u.role, options: [
        { value: 'student', label: 'student' }, { value: 'teacher', label: 'teacher' }, { value: 'admin', label: 'admin' },
      ]},
    ]);
    if (!result) return;
    try { await uapi.update(u.id, { role: result.role }); setMsg('✅ 角色已更新'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const del = async (u) => {
    const ok = await modal.confirm(`確定刪除使用者「${u.display_name}」？\n此動作會一併刪除其提交紀錄。`, { danger: true, okText: '刪除' });
    if (!ok) return;
    try { await uapi.remove(u.id); setMsg('🗑 已刪除'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const create = async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = {
      username: f.username.value,
      display_name: f.display_name.value,
      password: f.password.value,
      role: f.role.value,
      points: Number(f.points.value || 0),
    };
    try { await uapi.create(data); f.reset(); setMsg('✅ 已新增使用者'); load(); }
    catch (e) { setMsg('❌ ' + e.message); }
  };

  const filtered = list.filter((u) =>
    !filter || u.display_name.includes(filter) || u.username.includes(filter)
  );

  return (
    <>
      <h2>👥 學員 / 使用者管理</h2>
      {msg && <div className="panel" style={{ padding: 10 }}>{msg}</div>}

      {isAdmin && (
        <div className="panel">
          <h3>➕ 新增使用者</h3>
          <form onSubmit={create} style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <input name="username" placeholder="帳號" required />
            <input name="display_name" placeholder="顯示名稱" required />
            <input name="password" placeholder="密碼" required />
            <select name="role" defaultValue="student" style={{ padding: 8, background: '#1a1a1a', color: '#fff', border: '3px solid #555' }}>
              <option value="student">student</option>
              <option value="teacher">teacher</option>
              <option value="admin">admin</option>
            </select>
            <input name="points" type="number" placeholder="初始點數" defaultValue={0} />
            <button type="submit">建立</button>
          </form>
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="搜尋姓名或帳號…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />
          <button className="secondary" onClick={load}>重新整理</button>
        </div>
        <table>
          <thead>
            <tr><th>帳號</th><th>名稱</th><th>角色</th><th>Lv</th><th>EXP</th><th>💰點數</th><th>操作</th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.display_name}</td>
                <td><span className="stat-badge">{u.role}</span></td>
                <td>{u.level}</td>
                <td>{u.exp}</td>
                <td><strong style={{ color: '#fcd42a' }}>{u.points}</strong></td>
                <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={() => adjust(u)}>± 點數</button>
                  {isAdmin && <button className="secondary" onClick={() => editUser(u)}>編輯</button>}
                  {isAdmin && <button className="secondary" onClick={() => changeRole(u)}>角色</button>}
                  {isAdmin && <button className="secondary" onClick={() => resetPwd(u)}>改密碼</button>}
                  {isAdmin && u.id !== user.id && <button className="secondary" onClick={() => del(u)}>刪除</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
