import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LOGO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

function IconMail() {
  return <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8a2 2 0 012-2h14a2 2 0 012 2" /></svg>
}
function IconLock() {
  return <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M6 11h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z" /></svg>
}
function IconEye({ off }: { off?: boolean }) {
  return off
    ? <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A9.6 9.6 0 0112 4c5 0 9 4.5 9 8a9.8 9.8 0 01-2.3 3.9M6.1 6.1A11 11 0 003 12c0 3.5 4 8 9 8 1.3 0 2.5-.3 3.6-.8" /></svg>
    : <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPass, setVerPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('Credenciales inválidas. Verifica correo y contraseña.')
    // Aterriza siempre en el Inicio, sin importar qué ruta quedó cargada de una sesión anterior.
    else navigate('/', { replace: true })
  }

  async function olvido() {
    setError(null); setInfo(null)
    if (!email) { setError('Escribe tu correo para enviarte el enlace de recuperación.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + import.meta.env.BASE_URL })
    if (error) setError(error.message)
    else setInfo('Si el correo existe, recibirás un enlace para restablecer tu contraseña.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#061536] to-[#0A2356] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-neu">
        <div className="bg-gradient-to-br from-brand to-brand-light px-8 py-7 text-center text-white">
          <img src={LOGO} alt="Clínica Santa Bárbara" className="mx-auto h-14 w-auto" />
          <h1 className="mt-3 text-2xl font-bold">Control de Visitantes</h1>
          <p className="mt-1 text-sm text-brand-100">Clínica de Alta Complejidad Santa Bárbara</p>
        </div>

        <div className="px-8 py-7">
          <h2 className="mb-6 text-center text-2xl font-bold text-brand">Iniciar Sesión</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Correo electrónico</label>
              <div className="flex items-center gap-2 rounded-xl bg-neu-inset px-3 shadow-neu-inset-sm transition-shadow focus-within:shadow-neu-inset">
                <IconMail />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="correo@cacsantabarbara.co" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
              <div className="flex items-center gap-2 rounded-xl bg-neu-inset px-3 shadow-neu-inset-sm transition-shadow focus-within:shadow-neu-inset">
                <IconLock />
                <input type={verPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="••••••••" />
                <button type="button" onClick={() => setVerPass(v => !v)} className="text-gray-400 hover:text-gray-600" aria-label="Mostrar/ocultar">
                  <IconEye off={verPass} />
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-600">{info}</p>}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-brand py-2.5 font-semibold text-white shadow-neu-sm transition-all duration-150 hover:shadow-neu hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <button onClick={olvido} className="mt-4 block w-full text-center text-sm font-medium text-brand-light hover:underline">
            ¿Olvidaste tu contraseña?
          </button>

          <div className="my-5 border-t border-gray-200" />
          <p className="text-center text-sm text-gray-500">
            ¿No tienes cuenta?{' '}
            <button onClick={() => setInfo('Las cuentas las crea el administrador. Solicita tu acceso.')}
              className="font-semibold text-brand hover:underline">Solicita acceso</button>
          </p>
        </div>
      </div>

      <p className="absolute bottom-4 text-center text-xs text-white/70">
        © 2026 Clínica Santa Bárbara — Sistema Interno
      </p>
    </div>
  )
}
