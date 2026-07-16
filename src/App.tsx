import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import Layout from './components/Layout'
import SedeGate from './components/SedeGate'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Registrar from './pages/Registrar'
import Visitas from './pages/Visitas'
import Mapa from './pages/Mapa'
import Estadisticas from './pages/Estadisticas'
import Monitoreo from './pages/Monitoreo'
import Tarjetas from './pages/Tarjetas'
import Historico from './pages/Historico'
import SinTarjeta from './pages/SinTarjeta'
import NotasAdministrativas from './pages/NotasAdministrativas'
import Cirugia from './pages/Cirugia'
import Hemodinamia from './pages/Hemodinamia'
import Usuarios from './pages/admin/Usuarios'
import Responsables from './pages/admin/Responsables'
import Ubicaciones from './pages/admin/Ubicaciones'
import ServiciosCargos from './pages/admin/ServiciosCargos'
import TarjetasCatalogo from './pages/admin/Tarjetas'
import VisitantesAdmin from './pages/admin/VisitantesAdmin'
import Festivos from './pages/admin/Festivos'
import HomologacionCenso from './pages/admin/HomologacionCenso'
import HorariosVisita from './pages/admin/HorariosVisita'
import SincronizacionCenso from './pages/admin/SincronizacionCenso'

function Protegido({ children }: { children: React.ReactNode }) {
  const { session, perfil, loading, sedeTrabajo } = useAuth()
  if (loading) return <div className="min-h-screen grid place-items-center text-brand">Cargando…</div>
  if (!session) return <Login />
  if (!perfil) return <div className="min-h-screen grid place-items-center text-brand">Cargando…</div>
  // Solo el orientador necesita identificar la sede: de eso depende si ve Cirugía/
  // Hemodinamia (solo Torre) y si puede registrar "sin tarjeta" (solo Urgencias).
  if (perfil.rol === 'orientador' && !sedeTrabajo) return <SedeGate />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Protegido>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="registrar" element={<Registrar />} />
              <Route path="visitas" element={<Visitas />} />
              <Route path="historico" element={<Historico />} />
              <Route path="sin-tarjeta" element={<SinTarjeta />} />
              <Route path="notas-administrativas" element={<NotasAdministrativas />} />
              <Route path="mapa" element={<Mapa />} />
              <Route path="tarjetas" element={<Tarjetas />} />
              <Route path="estadisticas" element={<Estadisticas />} />
              <Route path="monitoreo" element={<Monitoreo />} />
              <Route path="cirugia" element={<Cirugia />} />
              <Route path="hemodinamia" element={<Hemodinamia />} />
              <Route path="admin/usuarios" element={<Usuarios />} />
              <Route path="admin/responsables" element={<Responsables />} />
              <Route path="admin/ubicaciones" element={<Ubicaciones />} />
              <Route path="admin/servicios" element={<ServiciosCargos />} />
              <Route path="admin/tarjetas" element={<TarjetasCatalogo />} />
              <Route path="admin/visitantes" element={<VisitantesAdmin />} />
              <Route path="admin/horarios" element={<HorariosVisita />} />
              <Route path="admin/festivos" element={<Festivos />} />
              <Route path="admin/homologacion" element={<HomologacionCenso />} />
              <Route path="admin/sync-censo" element={<SincronizacionCenso />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Protegido>
      </BrowserRouter>
    </AuthProvider>
  )
}
