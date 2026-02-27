import { createContext, useContext, ReactNode } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthResponse } from '../types'
import * as authService from '../services/authService'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, tokens: AuthResponse) => void
  clearAuth: () => void
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
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' },
  ),
)

const AuthContext = createContext<{
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
} | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, clearAuth } = useAuthStore()

  const login = async (email: string, password: string) => {
    const tokens = await authService.login(email, password)
    let userData: User | null = (tokens as any).user ?? null

    if (!userData) {
      userData = await authService.me((tokens as any).access_token)
    }

    useAuthStore.getState().setAuth(userData as User, tokens)
  }

  const signup = async (email: string, password: string) => {
    const tokens = await authService.signup(email, password)
    let userData: User | null = (tokens as any).user ?? null

    if (!userData) {
      userData = await authService.me((tokens as any).access_token)
    }

    useAuthStore.getState().setAuth(userData as User, tokens)
  }

  const logout = () => {
    clearAuth()
  }

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
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export { useAuthStore }
