import React, { createContext, useContext, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import { SessionUser } from '../lib/types';

interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    organizationName: string;
    fullName: string;
    email: string;
    password: string;
    acceptedPrivacyPolicy: true;
  }) => Promise<void>;
  logout: () => void;
}

const USER_KEY = 'opsflow_user';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<SessionUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  });

  const persistSession = (newToken: string, newUser: SessionUser) => {
    setStoredToken(newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    persistSession(res.token, res.user);
  };

  const register = async (payload: {
    organizationName: string;
    fullName: string;
    email: string;
    password: string;
    acceptedPrivacyPolicy: true;
  }) => {
    const res = await apiRequest<{
      token: string;
      organization: { id: string; name: string };
      user: { id: string; fullName: string; email: string; role: SessionUser['role'] };
    }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) });

    persistSession(res.token, {
      id: res.user.id,
      organizationId: res.organization.id,
      organizationName: res.organization.name,
      fullName: res.user.fullName,
      email: res.user.email,
      role: res.user.role,
    });
  };

  const logout = () => {
    setStoredToken(null);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}