import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/types'

// Sede en la que el orientador va a trabajar durante esta sesión (se pregunta al
// iniciar sesión porque Cirugía/Hemodinamia solo aplican a Torre de Salud, y
// "sin tarjeta" en Registrar solo aplica a Urgencias). No es un dato persistente
// del perfil: se guarda en sessionStorage y se vuelve a preguntar en cada login.
export interface SedeTrabajo { id: string; nombre: string }
const SEDE_TRABAJO_KEY = 'visitantes_sede_trabajo'

interface AuthCtx {
  session: Session | null
  perfil: Perfil | null
  loading: boolean
  signOut: () => Promise<void>
  sedeTrabajo: SedeTrabajo | null
  setSedeTrabajo: (s: SedeTrabajo) => void
  limpiarSedeTrabajo: () => void
}

const Ctx = createContext<AuthCtx>({
  session: null, perfil: null, loading: true, signOut: async () => {},
  sedeTrabajo: null, setSedeTrabajo: () => {}, limpiarSedeTrabajo: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const uidCargado = useRef<string | null>(null)
  const [sedeTrabajo, setSedeTrabajoState] = useState<SedeTrabajo | null>(() => {
    try { const raw = sessionStorage.getItem(SEDE_TRABAJO_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
  })
  const setSedeTrabajo = (s: SedeTrabajo) => {
    setSedeTrabajoState(s)
    sessionStorage.setItem(SEDE_TRABAJO_KEY, JSON.stringify(s))
  }
  const limpiarSedeTrabajo = () => {
    setSedeTrabajoState(null)
    sessionStorage.removeItem(SEDE_TRABAJO_KEY)
  }

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

  const signOut = async () => {
    await supabase.auth.signOut()
    limpiarSedeTrabajo()
  }

  return <Ctx.Provider value={{ session, perfil, loading, signOut, sedeTrabajo, setSedeTrabajo, limpiarSedeTrabajo }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
