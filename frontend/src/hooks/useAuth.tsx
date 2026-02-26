import { createContext, useContext, ReactNode } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User, AuthResponse } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, tokens: AuthResponse) => void;
  clearAuth: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, tokens) =>
        set({
          user,
          accessToken: (tokens as any).access_token ?? null,
          refreshToken: (tokens as any).refresh_token ?? null,
        }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "auth-storage" }
  )
);

const AuthContext = createContext<{
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, clearAuth } = useAuthStore();

  // Helper: parse backend error detail (FastAPI style { detail: ... })
  async function parseError(res: Response) {
    try {
      const json = await res.json();
      if (json && json.detail) return typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
      return JSON.stringify(json);
    } catch {
      return await res.text().catch(() => "Unknown error");
    }
  }

  const login = async (email: string, password: string) => {
    // FastAPI login in your file expects JSON { email, password }
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const message = await parseError(response);
      throw new Error(message || "Login failed");
    }

    const tokens: AuthResponse = await response.json();

    // Prefer token response's user object if present (your backend returns it)
    let userData: User | null = (tokens as any).user ?? null;

    // If backend didn't include user in response, fetch /auth/me
    if (!userData) {
      const userResp = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${(tokens as any).access_token}` },
      });
      if (!userResp.ok) {
        const message = await parseError(userResp);
        throw new Error(message || "Failed to fetch user data after login");
      }
      userData = await userResp.json();
    }

    useAuthStore.getState().setAuth(userData as User, tokens);
  };

  const signup = async (email: string, password: string) => {
    // Backend expects JSON { email, password } for signup
    const response = await fetch("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const message = await parseError(response);
      throw new Error(message || "Signup failed");
    }

    const tokens: AuthResponse = await response.json();

    // Backend returns token response with user included (TokenResponse.user)
    let userData: User | null = (tokens as any).user ?? null;

    if (!userData) {
      const userResp = await fetch("/auth/me", {
        headers: { Authorization: `Bearer ${(tokens as any).access_token}` },
      });
      if (!userResp.ok) {
        const message = await parseError(userResp);
        throw new Error(message || "Failed to fetch user data after signup");
      }
      userData = await userResp.json();
    }

    useAuthStore.getState().setAuth(userData as User, tokens);
  };

  const logout = () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export { useAuthStore };