import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { errorMessage, fromSupabaseError } from '../lib/errors'

export { supabase }

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string): Promise<string | null> {
    if (!supabase) return errorMessage('AUTH_NOT_CONFIGURED')
    const { error } = await supabase.auth.signUp({ email, password })
    return fromSupabaseError(error)?.message ?? null
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    if (!supabase) return errorMessage('AUTH_NOT_CONFIGURED')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return fromSupabaseError(error)?.message ?? null
  }

  async function signInWithGoogle(): Promise<string | null> {
    if (!supabase) return errorMessage('AUTH_NOT_CONFIGURED')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/consent' },
    })
    return fromSupabaseError(error)?.message ?? null
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
