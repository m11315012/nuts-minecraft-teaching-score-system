import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ModalProvider } from './components/Modal';
import Login from './pages/Login';
import Quests from './pages/Quests';
import Shop from './pages/Shop';
import MySubmissions from './pages/MySubmissions';
import Review from './pages/Review';
import ShopLogs from './pages/ShopLogs';
import Admin from './pages/Admin';
import { getSocket } from './socket';

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const isTeacher = user.role === 'teacher' || user.role === 'admin';
  return (
    <div className="nav">
      <strong style={{ color: '#fcd42a' }}>⛏ ClassQuest</strong>
      <Link to="/quests">任務</Link>
      <Link to="/shop">商店</Link>
      {user.role === 'student' && <Link to="/mine">我的提交</Link>}
      {isTeacher && <Link to="/review">審核</Link>}
      {isTeacher && <Link to="/shop-logs">兌換紀錄</Link>}
      {isTeacher && <Link to="/admin">學員管理</Link>}
      <span className="spacer" />
      <span className="stat-badge">Lv.{user.level}</span>
      <span className="stat-badge">⭐ {user.exp} EXP</span>
      <span className="stat-badge">💰 {user.points}</span>
      <span>{user.display_name} ({user.role})</span>
      <button className="secondary" onClick={async () => { await logout(); nav('/login'); }}>登出</button>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">載入中…</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function Toasts() {
  const { user, setUser } = useAuth();
  const [msgs, setMsgs] = useState([]);

  useEffect(() => {
    if (!user) return;
    const s = getSocket();
    if (!s) return;
    const push = (text) => {
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m, { id, text }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 4500);
    };
    const onNew = (d) => push(`🔔 新提交：${d.student} → ${d.quest_title}`);
    const onRedeemed = (d) => push(`🛒 ${d.student} 兌換了「${d.item_name}」x${d.quantity}（-${d.price_paid}💰）`);
    const onReviewed = (d) => {
      if (d.status === 'approved') {
        if (d.stats) {
          setUser((u) => u ? { ...u, level: d.stats.level, exp: d.stats.exp, points: d.stats.points } : u);
        }
        push(`✅ 審核通過！${d.stats ? `Lv.${d.stats.level} / ${d.stats.points}💰` : ''}`);
      } else {
        push(`❌ 被退回：${d.review_note || ''}`);
      }
    };
    s.on('submission:new', onNew);
    s.on('submission:reviewed', onReviewed);
    s.on('shop:redeemed', onRedeemed);
    return () => {
      s.off('submission:new', onNew);
      s.off('submission:reviewed', onReviewed);
      s.off('shop:redeemed', onRedeemed);
    };
  }, [user]);

  return (
    <>{msgs.map((m) => <div className="toast" key={m.id} style={{ top: 20 + msgs.indexOf(m) * 60 }}>{m.text}</div>)}</>
  );
}

function Shell() {
  return (
    <>
      <Nav />
      <Toasts />
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/quests" element={<Protected><Quests /></Protected>} />
          <Route path="/shop" element={<Protected><Shop /></Protected>} />
          <Route path="/mine" element={<Protected><MySubmissions /></Protected>} />
          <Route path="/review" element={<Protected><Review /></Protected>} />
          <Route path="/shop-logs" element={<Protected><ShopLogs /></Protected>} />
          <Route path="/admin" element={<Protected><Admin /></Protected>} />
          <Route path="*" element={<Navigate to="/quests" />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return <AuthProvider><ModalProvider><Shell /></ModalProvider></AuthProvider>;
}
