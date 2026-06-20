import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/types'

interface AuthCtx {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ session: null, perfil: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const uidCargado = useRef<string | null>(null)

  async function cargarPerfil(uid: string) {
    if (uidCargado.current === uid) return // evita recargas redundantes (token refresh, etc.)
    uidCargado.current = uid
    const { data } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle()
    setPerfil((data as Perfil) ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await cargarPerfil(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s) await cargarPerfil(s.user.id)
      else { uidCargado.current = null; setPerfil(null) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => { await supabase.auth.signOut() }

  return <Ctx.Provider value={{ session, perfil, loading, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
