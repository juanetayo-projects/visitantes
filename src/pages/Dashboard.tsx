import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, MetricCard, Card, FilterBar, selectCls, Modal, Badge } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { listVisitas, listSedes, listPisos, inventarioTarjetas, pacientesSinCama, type VisitaListado, type FiltrosVisita, type InventarioTarjetas, type PacienteSinCama } from '../lib/data'
import type { Sede, Piso } from '../lib/types'

function Ico({ d }: { d: string }) {
  return <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [inv, setInv] = useState<InventarioTarjetas | null>(null)
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [f, setF] = useState<FiltrosVisita>({ estado: '' })
  const [sinCama, setSinCama] = useState<PacienteSinCama[]>([])
  const [verSinCama, setVerSinCama] = useState(false)

  useEffect(() => { listSedes().then(setSedes); inventarioTarjetas().then(setInv); pacientesSinCama().then(setSinCama) }, [])
  useEffect(() => { if (f.sedeId) listPisos(f.sedeId).then(setPisos); else setPisos([]) }, [f.sedeId])
  useEffect(() => { listVisitas(f).then(setRows) }, [f.estado, f.tipo, f.sedeId, f.pisoId, f.desde, f.hasta])

  const m = useMemo(() => {
    const filtr = f.texto
      ? rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula, r.paciente_nombre, r.ubicacion_etiqueta]
          .some((x) => x?.toLowerCase().includes(f.texto!.toLowerCase())))
      : rows
    const activas = filtr.filter((r) => r.estado === 'activa')
    const ingresosPaciente = new Set(activas.map((r) => r.num_ingreso).filter(Boolean))
    const aislados = new Set(activas.filter((r) => r.aislamiento).map((r) => r.num_ingreso).filter(Boolean))
    const porTipo = (t: string) => filtr.filter((r) => r.tipo_visitante === t).length
    return {
      total: filtr.length,
      activas: activas.length,
      finalizadas: filtr.length - activas.length,
      conAcomp: ingresosPaciente.size,
      aislamiento: aislados.size,
      familiar: porTipo('familiar'), proveedor: porTipo('proveedor'), colaborador: porTipo('colaborador'),
    }
  }, [rows, f.texto])

  return (
    <div>
      <PageHeader title={`Bienvenido${perfil?.nombre ? ', ' + perfil.nombre.split(' ')[0] : ''}`} subtitle="Resumen operativo · Clínica Santa Bárbara" />

      <FilterBar onClear={() => setF({ estado: '' })}>
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Todos los estados</option><option value="activa">Activas (dentro)</option><option value="finalizada">Finalizadas</option>
        </select>
        <select className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option><option value="familiar">Familiar</option><option value="proveedor">Proveedor</option><option value="colaborador">Colaborador</option>
        </select>
        <select className={selectCls} value={f.sedeId ?? ''} onChange={(e) => setF({ ...f, sedeId: e.target.value, pisoId: '' })}>
          <option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.pisoId ?? ''} disabled={!f.sedeId} onChange={(e) => setF({ ...f, pisoId: e.target.value })}>
          <option value="">{f.sedeId ? 'Todos los pisos' : 'Elige sede'}</option>{pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Buscar nombre, cédula, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <MetricCard label="Visitantes dentro" value={m.activas} hint="visitas activas (filtro)" color="blue" icon={<Ico d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8z" />} />
        <MetricCard label="Visitas (filtro)" value={m.total} hint={`${m.finalizadas} finalizadas`} color="teal" icon={<Ico d="M4 6h16M4 12h16M4 18h16" />} />
        <MetricCard label="Pacientes con acompañante" value={m.conAcomp} hint="habitaciones acompañadas" color="green" icon={<Ico d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />} />
        <MetricCard label="En aislamiento" value={m.aislamiento} hint="pacientes (CENSO)" color="red" icon={<Ico d="M12 9v4m0 4h.01M10.3 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.14l-8-14a2 2 0 00-3.4 0z" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <button onClick={() => setVerSinCama(true)} className="text-left transition hover:-translate-y-0.5">
          <MetricCard label="Sin cama asignada" value={sinCama.length} hint="clic para ver registros →" color="amber"
            icon={<Ico d="M3 7v10M3 12h15a3 3 0 013 3v2M7 12V9a1 1 0 011-1h6a1 1 0 011 1v3" />} />
        </button>
        <MetricCard label="Familiares" value={m.familiar} color="blue" />
        <MetricCard label="Proveedores" value={m.proveedor} color="purple" />
        <MetricCard label="Tarjetas en uso" value={inv?.en_uso ?? '—'} hint="inventario global" color="teal" />
        <MetricCard label="Tarjetas disponibles" value={inv?.disponible ?? '—'} hint="inventario global" color="green" />
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
        <Link to="/tarjetas"><Card className="p-5 hover:ring-brand-light transition cursor-pointer">
          <div className="text-brand mb-2"><Ico d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></div>
          <div className="font-semibold text-gray-800">Tarjetas y salidas</div>
          <div className="text-sm text-gray-500">Inventario, tenencia y devolución</div>
        </Card></Link>
      </div>

      <Modal open={verSinCama} onClose={() => setVerSinCama(false)} title="Pacientes sin cama asignada" maxWidth="max-w-3xl">
        <p className="mb-3 text-sm text-gray-600">
          Pacientes que el CENSO reporta <b>sin ubicación física</b> (sala de espera de urgencias, recuperación, etc.).
          Búscalos por su número de identificación al registrar una visita.
        </p>
        <div className="max-h-[60vh] overflow-auto rounded-lg ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-brand text-white"><tr>
              {['Paciente', 'Edad', 'Unidad CENSO', '# Ingreso'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {sinCama.length === 0
                ? <tr><td colSpan={4} className="py-8 text-center text-emerald-600">✓ Todos los pacientes tienen cama asignada.</td></tr>
                : sinCama.map((p) => (
                  <tr key={p.num_ingreso} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{p.paciente ?? '—'}</div>
                      <div className="text-xs text-gray-500">ID {p.documento ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.edad ?? '—'}</td>
                    <td className="px-3 py-2"><Badge color="amber"><span className="whitespace-nowrap">{p.unidad ?? '—'}</span></Badge></td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.num_ingreso}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-right text-xs text-gray-400">{sinCama.length} paciente(s)</div>
      </Modal>
    </div>
  )
}
