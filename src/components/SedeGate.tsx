import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { listSedes } from '../lib/data'
import type { Sede } from '../lib/types'

const LOGO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

// Se muestra una vez por sesión al orientador antes de entrar a la app: Cirugía y
// Hemodinamia solo aplican a Torre de Salud, y "sin tarjeta" en Registrar solo
// aplica a Urgencias, así que la app necesita saber en qué sede va a trabajar.
export default function SedeGate() {
  const { perfil, setSedeTrabajo, signOut } = useAuth()
  const [sedes, setSedes] = useState<Sede[]>([])

  useEffect(() => { listSedes().then(setSedes) }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#061536] to-[#0A2356] p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-neu">
        <div className="bg-gradient-to-br from-brand to-brand-light px-8 py-7 text-center text-white">
          <img src={LOGO} alt="Clínica Santa Bárbara" className="mx-auto h-14 w-auto" />
          <h1 className="mt-3 text-2xl font-bold">Control de Visitantes</h1>
          <p className="mt-1 text-sm text-brand-100">Hola, {perfil?.nombre ?? perfil?.email}</p>
        </div>
        <div className="px-8 py-7">
          <h2 className="mb-1 text-center text-xl font-bold text-brand">¿En qué sede vas a trabajar?</h2>
          <p className="mb-6 text-center text-sm text-gray-500">Los módulos de Cirugía y Hemodinamia solo aplican a Torre de Salud, y los ingresos sin tarjeta solo a Urgencias.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {sedes.map((s) => (
              <button key={s.id} onClick={() => setSedeTrabajo({ id: s.id, nombre: s.nombre })}
                className="flex flex-col items-center gap-2 rounded-xl bg-white p-5 text-center shadow-neu-sm transition-all duration-150 hover:shadow-neu active:shadow-neu-inset-sm">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /></svg>
                </span>
                <span className="font-semibold text-gray-800">{s.nombre}</span>
              </button>
            ))}
            {sedes.length === 0 && <p className="col-span-2 text-center text-sm text-gray-400">Cargando sedes…</p>}
          </div>
          <button onClick={signOut} className="mt-6 block w-full text-center text-sm font-medium text-gray-400 hover:text-brand">
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
