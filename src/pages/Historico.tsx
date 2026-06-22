import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, FilterBar, selectCls, Btn, Badge } from '../components/ui'
import { listVisitas, listSedes, listPisos, listUbicaciones, describirFiltros, type VisitaListado, type FiltrosVisita } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import type { Sede, Piso, Ubicacion } from '../lib/types'

const TIPO_LABEL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador' }
function horaCO(iso: string) { return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16) }

const COLS: Columna<VisitaListado>[] = [
  { header: 'Fecha/hora ingreso', get: (r) => horaCO(r.created_at) },
  { header: 'Fecha/hora salida', get: (r) => (r.salida_at ? horaCO(r.salida_at) : '') },
  { header: 'Visitante', get: (r) => r.visitante?.nombres_completos ?? '' },
  { header: 'Cédula', get: (r) => r.visitante?.cedula ?? '' },
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo_visitante] ?? r.tipo_visitante },
  { header: 'Acompañante', get: (r) => r.tipo_acompanante ?? '' },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: '# Ingreso', get: (r) => r.num_ingreso ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
  { header: 'Tarjeta', get: (r) => r.tarjeta?.codigo ?? '' },
  { header: 'Estado', get: (r) => r.estado },
]

export default function Historico() {
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState<FiltrosVisita>({ estado: '' })

  useEffect(() => { listSedes().then(setSedes) }, [])
  useEffect(() => { if (f.sedeId) listPisos(f.sedeId).then(setPisos); else setPisos([]) }, [f.sedeId])
  useEffect(() => { if (f.pisoId) listUbicaciones(f.pisoId).then(setUbicaciones); else setUbicaciones([]) }, [f.pisoId])
  useEffect(() => {
    setLoading(true)
    listVisitas(f).then((r) => { setRows(r); setLoading(false) })
  }, [f.estado, f.tipo, f.sedeId, f.pisoId, f.ubicacionId, f.desde, f.hasta])

  const filtrados = useMemo(() => {
    if (!f.texto) return rows
    const t = f.texto.toLowerCase()
    return rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula, r.paciente_nombre, r.num_ingreso, r.ubicacion_etiqueta]
      .some((x) => x?.toLowerCase().includes(t)))
  }, [rows, f.texto])

  return (
    <div>
      <PageHeader title="Histórico de visitas" subtitle="Consulta por habitación/ubicación y por paciente (incluye visitas finalizadas)"
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Histórico de visitas', COLS, filtrados, describirFiltros(f, { sedes, pisos, ubicaciones }))}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Histórico de visitas', COLS, filtrados, describirFiltros(f, { sedes, pisos, ubicaciones }))}>PDF</Btn>
        </div>} />

      <FilterBar onClear={() => setF({ estado: '' })}>
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
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Todas (activas y finalizadas)</option><option value="activa">Activas</option><option value="finalizada">Finalizadas</option>
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Paciente, cédula, # ingreso, habitación…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500">{filtrados.length} visita(s)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Ingreso', 'Salida / devolución', 'Visitante', 'Tipo', 'Paciente', '# Ingreso', 'Ubicación', 'Tarjeta', 'Estado'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={9} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : filtrados.length === 0 ? <tr><td colSpan={9} className="py-10 text-center text-gray-400">Sin registros — ajusta los filtros</td></tr>
                : filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.salida_at ? horaCO(r.salida_at) : <span className="text-gray-300">— dentro —</span>}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante?.nombres_completos}</div>
                      <div className="text-xs text-gray-500">{r.visitante?.cedula}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={r.tipo_visitante === 'familiar' ? 'blue' : r.tipo_visitante === 'proveedor' ? 'amber' : 'gray'}>{TIPO_LABEL[r.tipo_visitante]}</Badge>
                      {r.tipo_acompanante && <div className="mt-0.5 text-xs capitalize text-gray-500">{r.tipo_acompanante}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.paciente_nombre ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{r.num_ingreso ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.ubicacion_etiqueta ?? '—'}</td>
                    <td className="px-3 py-2">{r.tarjeta?.codigo ? <Badge color="blue">{r.tarjeta.codigo}</Badge> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">{r.estado === 'activa' ? <Badge color="green">Dentro</Badge> : <Badge>Finalizada</Badge>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
