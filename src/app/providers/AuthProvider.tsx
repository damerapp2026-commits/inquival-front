import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../shared/services/api';
import type { User } from '../../shared/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!token) { setIsLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
    } finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const res = data.data;
    localStorage.setItem('token', res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const register = async (email: string, password: string, fullName: string) => {
    await api.post('/auth/register', { email, password, fullName });
  };

  const logout = () => { localStorage.removeItem('token'); setToken(null); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
