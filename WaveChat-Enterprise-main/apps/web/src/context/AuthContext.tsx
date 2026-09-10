import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { getOrCreateIdentity } from '../lib/crypto';
import { storage } from '../lib/storage';
import type { AuthResponse, User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login(phone: string, password: string): Promise<void>;
  register(name: string, phone: string, password: string): Promise<void>;
  logout(): Promise<void>;
  updateUser(user: User): void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => storage.getUser<User>());
  const [loading, setLoading] = useState(Boolean(storage.getAccess()));

  useEffect(() => {
    if (!storage.getAccess()) { setLoading(false); return; }
    api<{ user: User }>('/users/me').then(({ user }) => { setUser(user); storage.setUser(user); })
      .catch(() => { storage.clear(); setUser(null); }).finally(() => setLoading(false));
  }, []);

  async function login(phone: string, password: string) {
    const identity = await getOrCreateIdentity();
    const data = await api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password, publicKeyJwk: identity.publicKeyJwk }) }, false);
    storage.setSession(data.accessToken, data.refreshToken, data.user); setUser(data.user);
  }
  async function register(name: string, phone: string, password: string) {
    const identity = await getOrCreateIdentity();
    const data = await api<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, phone, password, publicKeyJwk: identity.publicKeyJwk }) }, false);
    storage.setSession(data.accessToken, data.refreshToken, data.user); setUser(data.user);
  }
  async function logout() {
    const refreshToken = storage.getRefresh();
    if (refreshToken) await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    storage.clear(); setUser(null);
  }
  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser: (next: User) => { setUser(next); storage.setUser(next); } }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context;
}
