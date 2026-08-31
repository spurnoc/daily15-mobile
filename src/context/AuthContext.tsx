import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

interface AuthState {
  token: string | null;
  email: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  token: null,
  email: null,
  loading: true,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const stored = await AsyncStorage.getItem('auth_token');
      const storedEmail = await AsyncStorage.getItem('auth_email');
      if (stored) {
        setToken(stored);
        setEmail(storedEmail);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    // Hardcoded demo login — bypasses API for testing
    if (email === 'demo@daily15.app' && password === 'demo1234') {
      const fakeToken = btoa('demo:0:' + Date.now());
      await AsyncStorage.setItem('auth_token', fakeToken);
      await AsyncStorage.setItem('auth_email', email);
      setToken(fakeToken);
      setEmail(email);
      return true;
    }
    try {
      const resp = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.token) {
        await AsyncStorage.setItem('auth_token', data.token);
        await AsyncStorage.setItem('auth_email', email);
        setToken(data.token);
        setEmail(email);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  async function register(email: string, password: string): Promise<boolean> {
    try {
      const resp = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.token) {
        await AsyncStorage.setItem('auth_token', data.token);
        await AsyncStorage.setItem('auth_email', email);
        setToken(data.token);
        setEmail(email);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  async function logout() {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_email');
    setToken(null);
    setEmail(null);
  }

  return (
    <AuthContext.Provider value={{ token, email, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
