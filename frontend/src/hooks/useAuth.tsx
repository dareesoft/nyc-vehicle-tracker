/**
 * Authentication Hook with Context
 * Manages user authentication state with localStorage persistence
 * Uses React Context to share state across components
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'

const API_BASE = '/api'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: string | null
  token: string | null
  expiresAt: string | null
}

interface LoginResult {
  success: boolean
  message?: string
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
}

const STORAGE_KEY = 'nyc_tracker_auth'

// Get initial state from localStorage
function getStoredAuth(): Partial<AuthState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      // Check if token is expired
      if (data.expiresAt && new Date(data.expiresAt) > new Date()) {
        return {
          token: data.token,
          user: data.user,
          expiresAt: data.expiresAt,
        }
      }
    }
  } catch (e) {
    console.error('Error reading auth from storage:', e)
  }
  return {}
}

// Save auth to localStorage
function saveAuth(token: string, user: string, expiresAt: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user, expiresAt }))
}

// Clear auth from localStorage
function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

// Create context with default values
const AuthContext = createContext<AuthContextType | null>(null)

/**
 * Auth Provider Component - Wrap your app with this
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = getStoredAuth()
    return {
      isAuthenticated: !!stored.token,
      isLoading: !!stored.token, // Will verify on mount
      user: stored.user || null,
      token: stored.token || null,
      expiresAt: stored.expiresAt || null,
    }
  })

  // Verify token on mount
  useEffect(() => {
    if (state.token) {
      verifyToken(state.token)
    }
  }, [])

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (data.valid) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          user: data.user,
          expiresAt: data.expires_at,
        }))
        return true
      } else {
        // Token invalid, clear everything
        clearAuth()
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          token: null,
          expiresAt: null,
        })
        return false
      }
    } catch (error) {
      console.error('Token verification failed:', error)
      setState(prev => ({ ...prev, isLoading: false }))
      return false
    }
  }

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.success && data.token) {
        // Save to storage
        saveAuth(data.token, data.user, data.expires_at)

        // Update state - this will trigger re-render in all components using useAuth
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: data.user,
          token: data.token,
          expiresAt: data.expires_at,
        })

        return { success: true }
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
        return { success: false, message: data.message || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      setState(prev => ({ ...prev, isLoading: false }))
      return { success: false, message: 'Connection error' }
    }
  }, [])

  const logout = useCallback(async () => {
    // Call logout API to invalidate token
    if (state.token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: state.token }),
        })
      } catch (error) {
        console.error('Logout API error:', error)
      }
    }

    // Clear local state
    clearAuth()
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      token: null,
      expiresAt: null,
    })
  }, [state.token])

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (!state.token) return false
    return verifyToken(state.token)
  }, [state.token])

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    checkAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to use auth context - must be used within AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
