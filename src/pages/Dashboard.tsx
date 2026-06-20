import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, MetricCard, Card } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { metricasDashboard, type Metricas } from '../lib/data'
import { hoyColombia } from '../lib/festivosColombia'

function Ico({ d }: { d: string }) {
  return <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const [m, setM] = useState<Metricas | null>(null)

  useEffect(() => { metricasDashboard(hoyColombia()).then(setM) }, [])

  return (
    <div>
      <PageHeader title={`Bienvenido${perfil?.nombre ? ', ' + perfil.nombre.split(' ')[0] : ''}`} subtitle="Resumen operativo · Clínica Santa Bárbara" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard label="Visitantes dentro" value={m?.activas ?? '—'} hint="visitas activas" color="blue" icon={<Ico d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8z" />} />
        <MetricCard label="Ingresos hoy" value={m?.ingresosHoy ?? '—'} hint="eventos de entrada" color="teal" icon={<Ico d="M11 16l-4-4m0 0l4-4m-4 4h14M5 4v16" />} />
        <MetricCard label="Pacientes con acompañante" value={m ? `${m.pacientesConAcomp}/${m.pacientes}` : '—'} hint="habitaciones acompañadas" color="green" icon={<Ico d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />} />
        <MetricCard label="En aislamiento" value={m?.enAislamiento ?? '—'} hint="pacientes (CENSO)" color="red" icon={<Ico d="M12 9v4m0 4h.01M10.3 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.14l-8-14a2 2 0 00-3.4 0z" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard label="Familiares" value={m?.familiar ?? '—'} color="blue" />
        <MetricCard label="Proveedores" value={m?.proveedor ?? '—'} color="amber" />
        <MetricCard label="Tarjetas en uso" value={m?.tarjetasEnUso ?? '—'} color="purple" />
        <MetricCard label="Tarjetas disponibles" value={m?.tarjetasDisp ?? '—'} color="teal" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/registrar"><Card className="p-5 hover:ring-brand-light transition cursor-pointer">
          <div className="text-brand mb-2"><Ico d="M12 5v14M5 12h14" /></div>
          <div className="font-semibold text-gray-800">Registrar visita</div>
          <div className="text-sm text-gray-500">Ingreso de familiar, proveedor o colaborador</div>
        </Card></Link>
        <Link to="/mapa"><Card className="p-5 hover:ring-brand-light transition cursor-pointer">
          <div className="text-brand mb-2"><Ico d="M9 20l-5-2V6l5 2m0 12l6-2m-6 2V8m6 10l5-2V4l-5 2m0 12V6" /></div>
          <div className="font-semibold text-gray-800">Mapa de habitaciones</div>
          <div className="text-sm text-gray-500">Ocupación y acompañantes en tiempo real</div>
        </Card></Link>
        <Link to="/visitas"><Card className="p-5 hover:ring-brand-light transition cursor-pointer">
          <div className="text-brand mb-2"><Ico d="M4 6h16M4 12h16M4 18h16" /></div>
          <div className="font-semibold text-gray-800">Visitas</div>
          <div className="text-sm text-gray-500">Consulta, filtros, salidas y exportación</div>
        </Card></Link>
      </div>
    </div>
  )
}
