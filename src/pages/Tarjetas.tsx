import { useEffect, useState } from 'react'
import { PageHeader, Card, MetricCard, Badge, Btn, FilterBar, selectCls, Modal } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { inventarioTarjetas, listTarjetasDetalle, listSedes, listPisos, listUbicaciones, finalizarVisita, describirFiltros, type InventarioTarjetas, type TarjetaDetalle, type FiltrosTarjeta } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import type { Sede, Piso, Ubicacion } from '../lib/types'

const TIPO_LABEL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador' }
const ESTADO_LABEL: Record<string, string> = { disponible: 'Disponible', en_uso: 'En uso', inactiva: 'Inactiva' }
const ESTADO_COLOR: Record<string, any> = { disponible: 'green', en_uso: 'amber', inactiva: 'gray' }
function horaCO(iso: string | null) {
  if (!iso) return '—'
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16)
}

const COLS: Columna<TarjetaDetalle>[] = [
  { header: 'Tarjeta', get: (r) => r.codigo },
  { header: 'Estado', get: (r) => ESTADO_LABEL[r.estado] ?? r.estado },
  { header: 'Titular', get: (r) => r.visitante_nombre ?? '' },
  { header: 'Cédula', get: (r) => r.cedula ?? '' },
  { header: 'Teléfono', get: (r) => r.celular ?? '' },
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo_visitante ?? ''] ?? '' },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
  { header: 'Desde', get: (r) => horaCO(r.hora_ingreso) },
]

export default function Tarjetas() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const [inv, setInv] = useState<InventarioTarjetas | null>(null)
  const [rows, setRows] = useState<TarjetaDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmar, setConfirmar] = useState<TarjetaDetalle | null>(null)
  const [f, setF] = useState<FiltrosTarjeta>({ estado: 'en_uso' })
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])

  async function cargar() {
    setLoading(true)
    const [i, u] = await Promise.all([inventarioTarjetas(), listTarjetasDetalle(f)])
    setInv(i); setRows(u); setLoading(false)
  }
  useEffect(() => { cargar() }, [])
  useEffect(() => { listSedes().then(setSedes) }, [])
  useEffect(() => { if (f.sedeId) listPisos(f.sedeId).then(setPisos); else setPisos([]) }, [f.sedeId])
  useEffect(() => { if (f.pisoId) listUbicaciones(f.pisoId).then(setUbicaciones); else setUbicaciones([]) }, [f.pisoId])
  useEffect(() => { listTarjetasDetalle(f).then(setRows) }, [f.estado, f.sedeId, f.pisoId, f.ubicacionId, f.tipo, f.desde, f.hasta, f.texto])

  async function devolver() {
    if (!confirmar?.visita_id) { setConfirmar(null); return }
    await finalizarVisita(confirmar.visita_id, perfil?.id)
    setConfirmar(null); cargar()
  }

  // Filtra por estado en las tarjetas métricas para resaltar el seleccionado
  function setEstado(e: string) { setF({ ...f, estado: e }) }

  return (
    <div>
      <PageHeader title="Tarjetas de acceso" subtitle="Inventario, tenencia y devolución de tarjetas"
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Tarjetas de acceso', COLS, rows, describirFiltros(f, { sedes, pisos, ubicaciones }))}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Tarjetas de acceso', COLS, rows, describirFiltros(f, { sedes, pisos, ubicaciones }))}>PDF</Btn>
        </div>} />

      {/* Inventario — clic para filtrar por estado */}
      <div className="grid gap-4 sm:grid-cols-4 mb-5">
        <button onClick={() => setEstado('')} className="text-left"><MetricCard label="Total tarjetas" value={inv?.total ?? '—'} hint={!f.estado ? '● filtro activo' : 'ver todas'} color="blue" /></button>
        <button onClick={() => setEstado('disponible')} className="text-left"><MetricCard label="Disponibles" value={inv?.disponible ?? '—'} hint={f.estado === 'disponible' ? '● filtro activo' : 'filtrar'} color="green" /></button>
        <button onClick={() => setEstado('en_uso')} className="text-left"><MetricCard label="En uso" value={inv?.en_uso ?? '—'} hint={f.estado === 'en_uso' ? '● filtro activo' : 'filtrar'} color="amber" /></button>
        <button onClick={() => setEstado('inactiva')} className="text-left"><MetricCard label="Inactivas" value={inv?.inactiva ?? '—'} hint={f.estado === 'inactiva' ? '● filtro activo' : 'filtrar'} color="purple" /></button>
      </div>

      {/* Filtros completos */}
      <FilterBar onClear={() => setF({ estado: 'en_uso' })}>
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          <option value="disponible">Disponibles</option>
          <option value="en_uso">En uso</option>
          <option value="inactiva">Inactivas</option>
        </select>
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
        <input className={selectCls} placeholder="Buscar tarjeta, titular, cédula, teléfono…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-100">
          <div className="font-semibold text-brand">Tarjetas <span className="text-gray-400 text-sm">({rows.length})</span></div>
          {esStaff && <span className="text-xs text-gray-500">Para una salida, busca la tarjeta en uso y pulsa «Registrar salida y devolver».</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Tarjeta', 'Estado', 'Titular', 'Teléfono', 'Tipo', 'Paciente / ubicación', 'Desde', esStaff ? 'Acción' : ''].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin tarjetas para el filtro</td></tr>
                : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-semibold text-gray-800">{r.codigo}</td>
                    <td className="px-3 py-2"><Badge color={ESTADO_COLOR[r.estado]}>{ESTADO_LABEL[r.estado]}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante_nombre ?? '—'}</div>
                      <div className="text-xs text-gray-500">{r.cedula}</div>
                    </td>
                    <td className="px-3 py-2">
                      {r.celular
                        ? <a href={`tel:${r.celular}`} className="inline-flex items-center gap-1 text-brand-light hover:underline">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.3a1 1 0 01.95.68l1 3a1 1 0 01-.27 1.05l-1.2 1.2a14 14 0 006.3 6.3l1.2-1.2a1 1 0 011.05-.27l3 1a1 1 0 01.68.95V19a2 2 0 01-2 2A16 16 0 013 5z" /></svg>
                            {r.celular}
                          </a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.tipo_visitante ? TIPO_LABEL[r.tipo_visitante] : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">
                      {r.paciente_nombre ? <><div className="text-gray-800">{r.paciente_nombre}</div><div className="text-xs text-gray-500">{r.ubicacion_etiqueta}</div></> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.estado === 'en_uso' ? horaCO(r.hora_ingreso) : '—'}</td>
                    {esStaff && <td className="px-3 py-2">
                      {r.estado === 'en_uso' && r.visita_id
                        ? <button onClick={() => setConfirmar(r)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7M13 16v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Registrar salida y devolver
                          </button>
                        : <span className="text-gray-300">—</span>}
                    </td>}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de confirmación de salida con datos del visitante + iconos */}
      <Modal open={!!confirmar} onClose={() => setConfirmar(null)} title="Registrar salida y devolver tarjeta">
        {confirmar && (
          <>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Visitante</div>
              <div className="text-base font-semibold text-gray-800">{confirmar.visitante_nombre}</div>
              <div className="text-sm text-gray-500">Cédula {confirmar.cedula ?? '—'}{confirmar.celular ? ` · ☎ ${confirmar.celular}` : ''}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-400 text-xs">Tarjeta</span><div className="font-medium text-brand">{confirmar.codigo}</div></div>
                <div><span className="text-gray-400 text-xs">Tipo</span><div>{confirmar.tipo_visitante ? TIPO_LABEL[confirmar.tipo_visitante] : '—'}</div></div>
                <div className="col-span-2"><span className="text-gray-400 text-xs">Paciente / ubicación</span>
                  <div>{confirmar.paciente_nombre ? `${confirmar.paciente_nombre} · ${confirmar.ubicacion_etiqueta}` : 'Sin paciente asociado'}</div></div>
                <div className="col-span-2"><span className="text-gray-400 text-xs">Ingreso</span><div>{horaCO(confirmar.hora_ingreso)}</div></div>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">Al confirmar, la tarjeta <b>{confirmar.codigo}</b> vuelve a estar <b>disponible</b> y la habitación queda libre.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={devolver} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Confirmar salida
              </button>
              <button onClick={() => setConfirmar(null)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" /></svg>
                Cancelar
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
