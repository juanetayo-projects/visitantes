import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Registrar from './pages/Registrar'
import Visitas from './pages/Visitas'
import Mapa from './pages/Mapa'
import Estadisticas from './pages/Estadisticas'
import Usuarios from './pages/admin/Usuarios'
import Responsables from './pages/admin/Responsables'
import Ubicaciones from './pages/admin/Ubicaciones'
import ServiciosCargos from './pages/admin/ServiciosCargos'
import Tarjetas from './pages/admin/Tarjetas'

function Protegido({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-screen grid place-items-center text-brand">Cargando…</div>
  if (!session) return <Login />
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
              <Route path="mapa" element={<Mapa />} />
              <Route path="estadisticas" element={<Estadisticas />} />
              <Route path="admin/usuarios" element={<Usuarios />} />
              <Route path="admin/responsables" element={<Responsables />} />
              <Route path="admin/ubicaciones" element={<Ubicaciones />} />
              <Route path="admin/servicios" element={<ServiciosCargos />} />
              <Route path="admin/tarjetas" element={<Tarjetas />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Protegido>
      </BrowserRouter>
    </AuthProvider>
  )
}
