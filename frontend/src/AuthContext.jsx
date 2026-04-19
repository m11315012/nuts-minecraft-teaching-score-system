import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth } from './api';
import { connectSocket, disconnectSocket } from './socket';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('cq_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const me = await auth.me();
      setUser(me);
      connectSocket(token);
    } catch {
      localStorage.removeItem('cq_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username, password) => {
    const { token, user } = await auth.login(username, password);
    localStorage.setItem('cq_token', token);
    setUser(user);
    connectSocket(token);
  };

  const logout = async () => {
    try { await auth.logout(); } catch {}
    localStorage.removeItem('cq_token');
    disconnectSocket();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
