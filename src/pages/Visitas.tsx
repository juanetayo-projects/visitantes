import { useEffect, useState } from 'react'
import { PageHeader, Card, FilterBar, selectCls, Btn, Badge, Modal } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { listVisitas, listSedes, listPisos, listUbicaciones, finalizarVisita, type VisitaListado, type FiltrosVisita } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import type { Sede, Piso, Ubicacion } from '../lib/types'

function horaCO(iso: string) {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16)
}
const TIPO_LABEL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador' }

const COLS: Columna<VisitaListado>[] = [
  { header: 'Fecha/hora', get: (r) => horaCO(r.created_at) },
  { header: 'Visitante', get: (r) => r.visitante?.nombres_completos ?? '' },
  { header: 'Cédula', get: (r) => r.visitante?.cedula ?? '' },
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo_visitante] ?? r.tipo_visitante },
  { header: 'Acompañante', get: (r) => r.tipo_acompanante ?? '' },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
  { header: 'Responsable', get: (r) => r.responsable?.nombre_completo ?? '' },
  { header: 'Tarjeta', get: (r) => r.tarjeta?.codigo ?? '' },
  { header: 'Aislamiento', get: (r) => r.aislamiento ?? '' },
  { header: 'Estado', get: (r) => r.estado },
]

export default function Visitas() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState<FiltrosVisita>({ estado: 'activa' })
  const [confirmar, setConfirmar] = useState<VisitaListado | null>(null)

  async function cargar() { setLoading(true); setRows(await listVisitas(f)); setLoading(false) }
  useEffect(() => { listSedes().then(setSedes) }, [])
  useEffect(() => {
    if (f.sedeId) listPisos(f.sedeId).then(setPisos); else setPisos([])
  }, [f.sedeId])
  useEffect(() => {
    if (f.pisoId) listUbicaciones(f.pisoId).then(setUbicaciones); else setUbicaciones([])
  }, [f.pisoId])
  useEffect(() => { cargar() }, [f.estado, f.tipo, f.sedeId, f.pisoId, f.ubicacionId, f.desde, f.hasta])

  async function salida() {
    if (!confirmar) return
    await finalizarVisita(confirmar.id, perfil?.id)
    setConfirmar(null); cargar()
  }

  const filtrados = f.texto
    ? rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula, r.paciente_nombre, r.ubicacion_etiqueta]
        .some((x) => x?.toLowerCase().includes(f.texto!.toLowerCase())))
    : rows

  return (
    <div>
      <PageHeader title="Visitas" subtitle={`${filtrados.length} registros`} action={
        <div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Visitas', COLS, filtrados)}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Visitas', COLS, filtrados)}>PDF</Btn>
        </div>
      } />

      <FilterBar onClear={() => setF({ estado: '' })}>
        <select className={selectCls} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Todos los estados</option>
          <option value="activa">Activas (dentro)</option>
          <option value="finalizada">Finalizadas</option>
        </select>
        <select className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option>
          <option value="familiar">Familiar</option>
          <option value="proveedor">Proveedor</option>
          <option value="colaborador">Colaborador</option>
        </select>
        <select className={selectCls} value={f.sedeId ?? ''} onChange={(e) => setF({ ...f, sedeId: e.target.value, pisoId: '', ubicacionId: '' })}>
          <option value="">Todas las sedes</option>
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.pisoId ?? ''} disabled={!f.sedeId} onChange={(e) => setF({ ...f, pisoId: e.target.value, ubicacionId: '' })}>
          <option value="">{f.sedeId ? 'Todos los pisos' : 'Elige sede'}</option>
          {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.ubicacionId ?? ''} disabled={!f.pisoId} onChange={(e) => setF({ ...f, ubicacionId: e.target.value })}>
          <option value="">{f.pisoId ? 'Todas las ubicaciones' : 'Elige piso'}</option>
          {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}{u.area ? ` (${u.area})` : ''}</option>)}
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Buscar nombre, cédula, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white">
              <tr>
                {['Ingreso', 'Visitante', 'Tipo', 'Paciente / ubicación', 'Tarjeta', 'Estado', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : filtrados.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin registros</td></tr>
                : filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante?.nombres_completos}</div>
                      <div className="text-xs text-gray-500">{r.visitante?.cedula}{r.visitante?.celular ? ` · ${r.visitante.celular}` : ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={r.tipo_visitante === 'familiar' ? 'blue' : r.tipo_visitante === 'proveedor' ? 'amber' : 'gray'}>{TIPO_LABEL[r.tipo_visitante]}</Badge>
                      {r.tipo_acompanante && <div className="mt-0.5 text-xs capitalize text-gray-500">{r.tipo_acompanante}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {r.paciente_nombre
                        ? <div><div className="text-gray-800">{r.paciente_nombre}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">{r.ubicacion_etiqueta}{r.aislamiento && <Badge color="red">{r.aislamiento}</Badge>}</div></div>
                        : r.responsable?.nombre_completo
                          ? <span className="text-xs text-gray-500">Resp.: {r.responsable.nombre_completo}</span>
                          : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">{r.tarjeta?.codigo ? <Badge color="blue">{r.tarjeta.codigo}</Badge> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">{r.estado === 'activa' ? <Badge color="green">Dentro</Badge> : <Badge>Finalizada</Badge>}</td>
                    <td className="px-3 py-2 text-right">
                      {esStaff && r.estado === 'activa' &&
                        <button onClick={() => setConfirmar(r)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7M13 16v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          Registrar salida
                        </button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de confirmación de salida */}
      <Modal open={!!confirmar} onClose={() => setConfirmar(null)} title="Registrar salida y devolver tarjeta">
        {confirmar && (
          <>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Visitante</div>
              <div className="text-base font-semibold text-gray-800">{confirmar.visitante?.nombres_completos}</div>
              <div className="text-sm text-gray-500">Cédula {confirmar.visitante?.cedula ?? '—'}{confirmar.visitante?.celular ? ` · ☎ ${confirmar.visitante.celular}` : ''}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-400 text-xs">Tarjeta</span><div className="font-medium text-brand">{confirmar.tarjeta?.codigo ?? '— sin tarjeta —'}</div></div>
                <div><span className="text-gray-400 text-xs">Tipo</span><div>{TIPO_LABEL[confirmar.tipo_visitante] ?? confirmar.tipo_visitante}</div></div>
                <div className="col-span-2"><span className="text-gray-400 text-xs">Paciente / ubicación</span>
                  <div>{confirmar.paciente_nombre ? `${confirmar.paciente_nombre} · ${confirmar.ubicacion_etiqueta ?? ''}` : (confirmar.responsable?.nombre_completo ? `Resp.: ${confirmar.responsable.nombre_completo}` : 'Sin paciente asociado')}</div></div>
                <div className="col-span-2"><span className="text-gray-400 text-xs">Ingreso</span><div>{horaCO(confirmar.created_at)}</div></div>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">Al confirmar, se registra la salida, la tarjeta queda <b>disponible</b> y se libera el cupo de la habitación.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={salida} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
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
