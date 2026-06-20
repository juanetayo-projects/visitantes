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
    try {
      const { data } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle()
      setPerfil((data as Perfil) ?? null)
    } catch {
      setPerfil(null)
    }
  }

  useEffect(() => {
    // Resuelve el estado de sesión sin bloquearse en la carga del perfil
    // (el perfil se carga en segundo plano para evitar quedar atascado en "Cargando").
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (data.session) cargarPerfil(data.session.user.id)
      })
      .finally(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) cargarPerfil(s.user.id)
      else { uidCargado.current = null; setPerfil(null) }
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => { await supabase.auth.signOut() }

  return <Ctx.Provider value={{ session, perfil, loading, signOut }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
