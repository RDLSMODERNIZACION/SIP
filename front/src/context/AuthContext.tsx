"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe, login as loginRequest, logout as logoutRequest } from "@/src/lib/auth";
import { getToken } from "@/src/lib/api";
import type { User } from "@/src/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshMe() {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const me = await getMe();
      setUser(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el usuario");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    const response = await loginRequest(email, password);
    setUser(response.user);
  }

  function logout() {
    logoutRequest();
    setUser(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  function hasRole(...roles: string[]) {
    if (!user) return false;
    return roles.includes(user.role_code);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshMe,
      hasRole,
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
