import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ROL_LABEL, type Rol } from '../lib/types'

const LOGO = `${import.meta.env.BASE_URL}images/logo_cacsb_blanc.png`

interface Item { to: string; label: string; icon: string; roles: Rol[] }

const TOP: Item[] = [
  { to: '/', label: 'Inicio', icon: 'M3 12l9-9 9 9M5 10v10h14V10', roles: ['admin', 'orientador', 'coordinador'] },
  { to: '/registrar', label: 'Registrar visita', icon: 'M12 5v14M5 12h14', roles: ['admin', 'orientador'] },
  { to: '/visitas', label: 'Visitas', icon: 'M4 6h16M4 12h16M4 18h16', roles: ['admin', 'orientador', 'coordinador'] },
  { to: '/historico', label: 'Histórico', icon: 'M3 12a9 9 0 109-9 9 9 0 00-9 9zm9-5v5l3 2M3 12H1m2-4l-1.5-1', roles: ['admin', 'orientador', 'coordinador'] },
  { to: '/mapa', label: 'Mapa de habitaciones', icon: 'M9 20l-5-2V6l5 2m0 12l6-2m-6 2V8m6 10l5-2V4l-5 2m0 12V6', roles: ['admin', 'orientador', 'coordinador'] },
  { to: '/tarjetas', label: 'Tarjetas de acceso', icon: 'M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z', roles: ['admin', 'orientador', 'coordinador'] },
  { to: '/estadisticas', label: 'Mapa de calor', icon: 'M3 3v18h18M7 14l3-3 3 3 5-5', roles: ['admin', 'coordinador'] },
  { to: '/monitoreo', label: 'Centro de monitoreo', icon: 'M3 5h18v12H3zM8 21h8M12 17v4', roles: ['admin', 'coordinador'] },
]

const ADMIN: Item[] = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: '', roles: ['admin'] },
  { to: '/admin/responsables', label: 'Responsables', icon: '', roles: ['admin'] },
  { to: '/admin/ubicaciones', label: 'Sedes y ubicaciones', icon: '', roles: ['admin'] },
  { to: '/admin/servicios', label: 'Servicios y cargos', icon: '', roles: ['admin'] },
  { to: '/admin/tarjetas', label: 'Tarjetas (catálogo)', icon: '', roles: ['admin'] },
  { to: '/admin/visitantes', label: 'Visitantes', icon: '', roles: ['admin'] },
  { to: '/admin/festivos', label: 'Festivos', icon: '', roles: ['admin'] },
  { to: '/admin/homologacion', label: 'Homologación CENSO', icon: '', roles: ['admin'] },
]

const linkCls = (isActive: boolean, sub = false) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${sub ? 'pl-7 ' : ''}${isActive ? 'bg-white/15 font-medium' : 'hover:bg-white/10'}`

export default function Layout() {
  const { perfil, signOut } = useAuth()
  const location = useLocation()
  const rol = perfil?.rol ?? 'orientador'
  const top = TOP.filter(i => i.roles.includes(rol))
  const esAdmin = rol === 'admin'
  const adminActivo = ADMIN.some(i => location.pathname === i.to)
  const [abierto, setAbierto] = useState(adminActivo)
  const iniciales = (perfil?.nombre || perfil?.email || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-brand text-white flex flex-col shrink-0">
        <div className="flex flex-col items-center gap-2 px-4 py-5 border-b border-white/10 text-center">
          <img src={LOGO} alt="Clínica" className="h-12 w-auto" />
          <span className="text-base font-semibold leading-tight">Control de Visitantes</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {top.map(i => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => linkCls(isActive)}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={i.icon} /></svg>
              {i.label}
            </NavLink>
          ))}

          {esAdmin && (
            <div className="pt-1">
              <button onClick={() => setAbierto(a => !a)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${adminActivo ? 'bg-white/10 font-medium' : 'hover:bg-white/10'}`}>
                <span className="flex items-center gap-2.5">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.3 4.3a1 1 0 011.4 0l1 1a8 8 0 011 0l1-1a1 1 0 011.4 1.4l-1 1a8 8 0 010 1l1 1a1 1 0 01-1.4 1.4M12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>
                  Administración
                </span>
                <svg className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
              </button>
              {abierto && (
                <div className="mt-1 space-y-1 border-l border-white/15 ml-3">
                  {ADMIN.map(i => (
                    <NavLink key={i.to} to={i.to} className={({ isActive }) => linkCls(isActive, true)}>{i.label}</NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 text-[11px] text-brand-100">
          © 2026 Clínica Santa Bárbara
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {/* Header azul (mismo tono que el menú lateral) */}
        <header className="sticky top-0 z-20 flex items-center justify-end gap-3 bg-brand px-6 py-2.5 shadow-sm">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/30">{iniciales}</div>
          <div className="leading-tight">
            <div className="text-sm font-medium text-white">{perfil?.nombre || perfil?.email}</div>
            <div className="text-xs text-brand-100">{ROL_LABEL[rol]}{perfil?.email ? ` · ${perfil.email}` : ''}</div>
          </div>
          <button onClick={signOut} className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/15">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7M13 16v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Cerrar sesión
          </button>
        </header>
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
