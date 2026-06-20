import { useEffect, useState } from 'react'
import { PageHeader, Card, MetricCard, Badge, Btn, FilterBar, selectCls, Modal } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { inventarioTarjetas, tarjetasEnUso, listSedes, listPisos, listUbicaciones, finalizarVisita, type InventarioTarjetas, type TarjetaEnUso, type FiltrosTarjeta } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import type { Sede, Piso, Ubicacion } from '../lib/types'

const TIPO_LABEL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador' }
function horaCO(iso: string | null) {
  if (!iso) return '—'
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16)
}

const COLS: Columna<TarjetaEnUso>[] = [
  { header: 'Tarjeta', get: (r) => r.codigo },
  { header: 'Titular', get: (r) => r.visitante_nombre ?? '' },
  { header: 'Cédula', get: (r) => r.cedula ?? '' },
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo_visitante ?? ''] ?? '' },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
  { header: 'Desde', get: (r) => horaCO(r.hora_ingreso) },
]

export default function Tarjetas() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const [inv, setInv] = useState<InventarioTarjetas | null>(null)
  const [enUso, setEnUso] = useState<TarjetaEnUso[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmar, setConfirmar] = useState<TarjetaEnUso | null>(null)
  const [f, setF] = useState<FiltrosTarjeta>({})
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])

  async function cargar() {
    setLoading(true)
    const [i, u] = await Promise.all([inventarioTarjetas(), tarjetasEnUso(f)])
    setInv(i); setEnUso(u); setLoading(false)
  }
  useEffect(() => { cargar() }, [])
  useEffect(() => { listSedes().then(setSedes) }, [])
  useEffect(() => { if (f.sedeId) listPisos(f.sedeId).then(setPisos); else setPisos([]) }, [f.sedeId])
  useEffect(() => { if (f.pisoId) listUbicaciones(f.pisoId).then(setUbicaciones); else setUbicaciones([]) }, [f.pisoId])
  useEffect(() => { tarjetasEnUso(f).then(setEnUso) }, [f.sedeId, f.pisoId, f.ubicacionId, f.tipo, f.desde, f.hasta, f.texto])

  async function devolver() {
    if (!confirmar?.visita_id) { setConfirmar(null); return }
    await finalizarVisita(confirmar.visita_id, perfil?.id)
    setConfirmar(null); cargar()
  }

  return (
    <div>
      <PageHeader title="Tarjetas de acceso" subtitle="Inventario, tenencia y devolución de tarjetas"
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Tarjetas en uso', COLS, enUso)}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Tarjetas en uso', COLS, enUso)}>PDF</Btn>
        </div>} />

      {/* Inventario */}
      <div className="grid gap-4 sm:grid-cols-4 mb-5">
        <MetricCard label="Total tarjetas" value={inv?.total ?? '—'} color="blue" />
        <MetricCard label="Disponibles" value={inv?.disponible ?? '—'} color="green" />
        <MetricCard label="En uso" value={inv?.en_uso ?? '—'} color="amber" />
        <MetricCard label="Inactivas" value={inv?.inactiva ?? '—'} color="purple" />
      </div>

      {inv && inv.porSede.length > 0 && (
        <Card className="p-4 mb-5">
          <div className="text-sm font-semibold text-brand mb-2">Inventario por sede</div>
          <table className="w-full text-sm">
            <thead className="text-gray-500"><tr>
              {['Sede', 'Total', 'Disponibles', 'En uso', 'Inactivas'].map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {inv.porSede.map((s) => (
                <tr key={s.sede} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-medium text-gray-700">{s.sede}</td>
                  <td className="px-2 py-1.5">{s.total}</td>
                  <td className="px-2 py-1.5 text-emerald-700">{s.disponible}</td>
                  <td className="px-2 py-1.5 text-amber-700">{s.en_uso}</td>
                  <td className="px-2 py-1.5 text-gray-500">{s.inactiva}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {esStaff && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span><b>Salida y devolución de tarjeta:</b> busca la tarjeta por su código (o por el titular/paciente)
            en la tabla de abajo y pulsa <b>«Registrar salida y devolver»</b>. La tarjeta vuelve a estar disponible
            y la habitación queda libre para asignar a otro visitante.</span>
        </div>
      )}

      {/* Filtros completos */}
      <FilterBar onClear={() => setF({})}>
        <select className={selectCls} value={f.sedeId ?? ''} onChange={(e) => setF({ ...f, sedeId: e.target.value, pisoId: '', ubicacionId: '' })}>
          <option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.pisoId ?? ''} disabled={!f.sedeId} onChange={(e) => setF({ ...f, pisoId: e.target.value, ubicacionId: '' })}>
          <option value="">{f.sedeId ? 'Todos los pisos' : 'Elige sede'}</option>{pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.ubicacionId ?? ''} disabled={!f.pisoId} onChange={(e) => setF({ ...f, ubicacionId: e.target.value })}>
          <option value="">{f.pisoId ? 'Todas las ubicaciones' : 'Elige piso'}</option>{ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}{u.area ? ` (${u.area})` : ''}</option>)}
        </select>
        <select className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option><option value="familiar">Familiar</option><option value="proveedor">Proveedor</option><option value="colaborador">Colaborador</option>
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Buscar tarjeta, titular, cédula, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      {/* Tarjetas en uso — quién las tiene */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-100">
          <div className="font-semibold text-brand">¿Quién tiene cada tarjeta? <span className="text-gray-400 text-sm">({enUso.length} en uso)</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Tarjeta', 'Titular', 'Tipo', 'Paciente / ubicación', 'Desde', esStaff ? 'Devolución' : ''].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : enUso.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-gray-400">No hay tarjetas en uso</td></tr>
                : enUso.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2"><Badge color="amber">{r.codigo}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante_nombre ?? '—'}</div>
                      <div className="text-xs text-gray-500">{r.cedula}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{TIPO_LABEL[r.tipo_visitante ?? ''] ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.paciente_nombre ? <><div className="text-gray-800">{r.paciente_nombre}</div><div className="text-xs text-gray-500">{r.ubicacion_etiqueta}</div></> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.hora_ingreso)}</td>
                    {esStaff && <td className="px-3 py-2">
                      <button onClick={() => setConfirmar(r)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7M13 16v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Registrar salida y devolver
                      </button>
                    </td>}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!confirmar} onClose={() => setConfirmar(null)} title="Registrar salida y devolver tarjeta">
        {confirmar && (
          <>
            <p className="text-sm text-gray-700">
              Confirma la salida de <b>{confirmar.visitante_nombre}</b> y la devolución de la tarjeta
              <b> {confirmar.codigo}</b>. La tarjeta volverá a estar <b>disponible</b> y se liberará el cupo.
            </p>
            <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {confirmar.paciente_nombre ? `Paciente: ${confirmar.paciente_nombre} · ${confirmar.ubicacion_etiqueta}` : 'Sin paciente asociado'}
              {' · '}Ingreso: {horaCO(confirmar.hora_ingreso)}
            </div>
            <div className="mt-4 flex gap-2">
              <Btn onClick={devolver} className="flex-1">Confirmar salida y devolución</Btn>
              <Btn variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
