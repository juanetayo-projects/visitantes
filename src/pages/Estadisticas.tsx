import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { PageHeader, Card, FilterBar, selectCls, MetricCard, Modal, Badge } from '../components/ui'
import { listVisitas, listSedes, listPisos, type VisitaListado, type FiltrosVisita } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import { setFestivos } from '../lib/festivosColombia'
import type { Sede, Piso } from '../lib/types'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const HORAS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}h`)
const TIPO_LABEL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador' }

function partesCO(iso: string) {
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  return { fecha: co.toISOString().substring(0, 10), dow: (co.getUTCDay() + 6) % 7, hora: co.getUTCHours() }
}
function horaCO(iso: string) {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16)
}

const COLS: Columna<VisitaListado>[] = [
  { header: 'Fecha/hora', get: (r) => horaCO(r.created_at) },
  { header: 'Visitante', get: (r) => r.visitante?.nombres_completos ?? '' },
  { header: 'Cédula', get: (r) => r.visitante?.cedula ?? '' },
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo_visitante] ?? r.tipo_visitante },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
]

export default function Estadisticas() {
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState<FiltrosVisita>({ estado: '' })
  const [sel, setSel] = useState<{ dow: number; hora: number } | null>(null)
  const festivos = useMemo(() => setFestivos(2024, 2027), [])

  useEffect(() => { listSedes().then(setSedes) }, [])
  useEffect(() => { if (f.sedeId) listPisos(f.sedeId).then(setPisos); else setPisos([]) }, [f.sedeId])
  useEffect(() => {
    setLoading(true)
    listVisitas({ ...f, estado: f.estado || '' }).then((r) => { setRows(r); setLoading(false) })
  }, [f.estado, f.tipo, f.sedeId, f.pisoId, f.desde, f.hasta])

  const { matriz, total, festivosCount, max } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let fest = 0
    rows.forEach((r) => {
      const p = partesCO(r.created_at)
      m[p.dow][p.hora]++
      if (p.dow === 6 || festivos.has(p.fecha)) fest++
    })
    let mx = 0
    const data: [number, number, number][] = []
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) { mx = Math.max(mx, m[d][h]); data.push([h, d, m[d][h]]) }
    return { matriz: data, total: rows.length, festivosCount: fest, max: mx }
  }, [rows, festivos])

  const detalle = useMemo(() => {
    if (!sel) return []
    return rows.filter((r) => { const p = partesCO(r.created_at); return p.dow === sel.dow && p.hora === sel.hora })
  }, [sel, rows])

  const option = {
    tooltip: { position: 'top', formatter: (p: any) => `${DIAS[p.value[1]]} · ${HORAS[p.value[0]]}<br/><b>${p.value[2]}</b> visita(s)<br/><span style="font-size:11px">clic para ver detalle</span>` },
    grid: { height: '70%', top: '8%', left: 70, right: 20 },
    xAxis: { type: 'category', data: HORAS, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'category', data: DIAS, splitArea: { show: true } },
    visualMap: { min: 0, max: Math.max(1, max), calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#EAF0FA', '#85B7EB', '#16468E', '#0D2D6B'] } },
    series: [{ name: 'Visitas', type: 'heatmap', data: matriz, label: { show: max <= 30 }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(13,45,107,0.4)' } } }],
  }

  const onEvents = { click: (p: any) => { if (p.value && p.value[2] > 0) setSel({ hora: p.value[0], dow: p.value[1] }) } }

  return (
    <div>
      <PageHeader title="Mapa de calor" subtitle="Flujo de visitantes por día y hora — zona horaria Colombia (GMT-5)" />

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <MetricCard label="Total de visitas" value={total} color="blue" />
        <MetricCard label="En domingos / festivos" value={festivosCount} hint="calendario Colombia" color="amber" />
        <MetricCard label="Pico (día·hora)" value={max} hint="máximo en una celda" color="teal" />
      </div>

      <FilterBar onClear={() => setF({ estado: '' })}>
        <select className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option>
          <option value="familiar">Familiar</option><option value="proveedor">Proveedor</option><option value="colaborador">Colaborador</option>
        </select>
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Activas y finalizadas</option><option value="activa">Solo activas</option><option value="finalizada">Solo finalizadas</option>
        </select>
        <select className={selectCls} value={f.sedeId ?? ''} onChange={(e) => setF({ ...f, sedeId: e.target.value, pisoId: '' })}>
          <option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.pisoId ?? ''} disabled={!f.sedeId} onChange={(e) => setF({ ...f, pisoId: e.target.value })}>
          <option value="">{f.sedeId ? 'Todos los pisos' : 'Elige sede'}</option>{pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
      </FilterBar>

      <Card className="p-5">
        <div className="text-sm font-semibold text-brand mb-2">Mapa de calor — visitas por día y hora <span className="font-normal text-gray-400">(clic en una celda para ver el detalle)</span></div>
        {loading ? <div className="py-16 text-center text-gray-400 text-sm">Cargando…</div>
          : <ReactECharts option={option} onEvents={onEvents} style={{ height: 420 }} />}
      </Card>

      {/* Ajuste 6: detalle de personas de la celda seleccionada */}
      <Modal open={!!sel} onClose={() => setSel(null)} maxWidth="max-w-3xl"
        title={sel ? `${DIAS[sel.dow]} · ${HORAS[sel.hora]} — ${detalle.length} visita(s)` : ''}>
        <div className="mb-3 flex justify-end gap-2">
          <button onClick={() => exportarExcel(`Visitas ${sel ? DIAS[sel.dow] + ' ' + HORAS[sel.hora] : ''}`, COLS, detalle)} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-100">Excel</button>
          <button onClick={() => exportarPDF(`Visitas ${sel ? DIAS[sel.dow] + ' ' + HORAS[sel.hora] : ''}`, COLS, detalle)} className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-100">PDF</button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand/5 text-brand sticky top-0">
              <tr>{['Hora', 'Visitante', 'Tipo', 'Paciente / ubicación'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detalle.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/40">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at).substring(11)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{r.visitante?.nombres_completos}</div>
                    <div className="text-xs text-gray-500">{r.visitante?.cedula}{r.visitante?.celular ? ` · ${r.visitante.celular}` : ''}</div>
                  </td>
                  <td className="px-3 py-2"><Badge color={r.tipo_visitante === 'familiar' ? 'blue' : r.tipo_visitante === 'proveedor' ? 'amber' : 'gray'}>{TIPO_LABEL[r.tipo_visitante]}</Badge></td>
                  <td className="px-3 py-2 text-gray-700">
                    {r.paciente_nombre ? <><div>{r.paciente_nombre}</div><div className="text-xs text-gray-500">{r.ubicacion_etiqueta}</div></> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
