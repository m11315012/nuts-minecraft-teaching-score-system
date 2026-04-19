import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  if (user) return <Navigate to="/quests" />;

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await login(u, p); nav('/quests'); }
    catch (e) { setErr(e.message || '登入失敗'); }
    finally { setBusy(false); }
  };

  return (
    <div className="login-box panel">
      <h1>⛏ ClassQuest</h1>
      <p className="muted">Minecraft 風格 · 課堂管理系統</p>
      <form onSubmit={submit}>
        <label>帳號</label>
        <input value={u} onChange={(e) => setU(e.target.value)} autoFocus />
        <div style={{ height: 10 }} />
        <label>密碼</label>
        <input type="password" value={p} onChange={(e) => setP(e.target.value)} />
        <div style={{ height: 14 }} />
        <button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? '登入中…' : '進入世界'}
        </button>
        {err && <div className="error">{err}</div>}
      </form>
    </div>
  );
}
