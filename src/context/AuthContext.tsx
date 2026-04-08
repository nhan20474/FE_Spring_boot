import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getToken, getStoredUser, clearToken, setStoredUser, setToken } from '@/services/api';
import * as backend from '@/services/backend';
import type { AuthUserDto, AuthRequest, AuthResponse, RegisterRequest } from '@/types/api';
import { ApiError } from '@/services/api';

export interface AuthState {
  user: AuthUserDto | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

interface AuthContextType extends AuthState {
  login: (body: AuthRequest) => Promise<AuthResponse>;
  loginWithToken: (token: string) => Promise<void>;
  register: (body: RegisterRequest) => Promise<AuthResponse>;
  logout: () => void;
  updateCurrentUser: (patch: Partial<AuthUserDto>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) {
      setUser(stored);
    }
    setIsInitialized(true);
    if (token) {
      void backend
        .fetchAuthMe()
        .then((u) => {
          setUser(u);
          setStoredUser(u);
        })
        .catch(() => {
          clearToken();
          setUser(null);
        });
    }
  }, []);

  const login = useCallback(async (body: AuthRequest): Promise<AuthResponse> => {
    const res = await backend.login(body);
    setUser(res.user);
    return res;
  }, []);

  const register = useCallback(async (body: RegisterRequest): Promise<AuthResponse> => {
    const res = await backend.register(body);
    setUser(res.user);
    return res;
  }, []);

  const loginWithToken = useCallback(async (token: string): Promise<void> => {
    setToken(token);
    try {
      const user = await backend.fetchAuthMe();
      setStoredUser(user);
      setUser(user);
    } catch {
      clearToken();
      setUser(null);
      throw new ApiError('Đăng nhập Google thất bại.', 401);
    }
  }, []);

  const logout = useCallback(() => {
    backend.logout();
    setUser(null);
    localStorage.removeItem('techhome_cart');
    window.dispatchEvent(new Event('techhome:logout'));
  }, []);

  const updateCurrentUser = useCallback((patch: Partial<AuthUserDto>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setStoredUser(next);
      return next;
    });
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user),
    isInitialized,
    login,
    loginWithToken,
    register,
    logout,
    updateCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
