import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, Badge, Btn, FilterBar, selectCls, inputCls, Modal } from '../../components/ui'
import { listInconsistencias, ultimoSync, ejecutarSyncCenso, type CensoInconsistencia, type CensoSyncLog } from '../../lib/data'
import { exportarExcel, type Columna } from '../../lib/exportar'

const TIPO_LABEL: Record<string, { label: string; color: 'red' | 'amber' | 'gray' }> = {
  ubicacion_no_homologada: { label: 'Ubicación sin homologar', color: 'red' },
  sin_cama: { label: 'Sin cama asignada', color: 'amber' },
  aislamiento_desconocido: { label: 'Aislamiento no contemplado', color: 'amber' },
  unidad_desconocida: { label: 'Unidad desconocida', color: 'red' },
}

function fechaHoraCO(iso: string | null): string {
  if (!iso) return '—'
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dd = String(co.getUTCDate()).padStart(2, '0'); const mm = String(co.getUTCMonth() + 1).padStart(2, '0')
  let h = co.getUTCHours(); const min = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dd}/${mm}/${co.getUTCFullYear()} ${h}:${min} ${ap}`
}

interface Filtros { tipo: string; unidad: string; area: string; texto: string }
const VACIO: Filtros = { tipo: '', unidad: '', area: '', texto: '' }

const COLS: Columna<CensoInconsistencia>[] = [
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo]?.label ?? r.tipo },
  { header: 'Paciente', get: (r) => r.paciente ?? '' },
  { header: '# Ingreso', get: (r) => r.num_ingreso ?? '' },
  { header: 'Unidad CENSO', get: (r) => r.censo_unidad ?? '' },
  { header: 'Área', get: (r) => r.censo_area ?? '' },
  { header: 'Cama', get: (r) => r.censo_cama ?? '' },
  { header: 'Detalle', get: (r) => r.detalle ?? '' },
]
function describirFiltros(f: Filtros): string {
  const p: string[] = []
  if (f.tipo) p.push(`Tipo: ${TIPO_LABEL[f.tipo]?.label ?? f.tipo}`)
  if (f.unidad) p.push(`Unidad CENSO: ${f.unidad}`)
  if (f.area) p.push(`Área: ${f.area}`)
  if (f.texto.trim()) p.push(`Búsqueda: "${f.texto.trim()}"`)
  return p.join(' · ')
}

export default function SincronizacionCenso() {
  const [rows, setRows] = useState<CensoInconsistencia[]>([])
  const [log, setLog] = useState<CensoSyncLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState<Filtros>(VACIO)
  const [confirmar, setConfirmar] = useState(false)
  const [ejecutando, setEjecutando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  function cargar() {
    setLoading(true)
    Promise.all([listInconsistencias(), ultimoSync()]).then(([r, l]) => { setRows(r); setLog(l); setLoading(false) })
  }
  useEffect(cargar, [])

  async function ejecutar() {
    setConfirmar(false); setEjecutando(true); setMsg(null)
    const res = await ejecutarSyncCenso()
    setEjecutando(false)
    if (res.ok) {
      const r = res.resumen ?? {}
      setMsg({ ok: true, texto: `Sincronización completada: ${r.total_censo} en censo · ${r.pacientes_upsert} actualizados · ${r.altas} egresos · ${r.inconsistencias} inconsistencias.` })
      cargar()
    } else {
      setMsg({ ok: false, texto: 'No se pudo ejecutar: ' + (res.error ?? 'error desconocido') })
    }
  }

  const unidades = useMemo(() => [...new Set(rows.map((r) => r.censo_unidad).filter(Boolean))].sort() as string[], [rows])
  const areas = useMemo(() => [...new Set(rows.map((r) => r.censo_area).filter(Boolean))].sort() as string[], [rows])
  const tipos = useMemo(() => [...new Set(rows.map((r) => r.tipo))].sort(), [rows])

  const filtrados = useMemo(() => {
    const t = f.texto.trim().toLowerCase()
    return rows.filter((r) =>
      (!f.tipo || r.tipo === f.tipo) &&
      (!f.unidad || r.censo_unidad === f.unidad) &&
      (!f.area || r.censo_area === f.area) &&
      (!t || [r.paciente, r.num_ingreso, r.censo_cama, r.detalle].some((x) => x?.toLowerCase().includes(t))))
  }, [rows, f])

  return (
    <div>
      <PageHeader title="Sincronización CENSO" subtitle="Estado de la última sincronización e inconsistencias detectadas al cruzar el CENSO con la homologación."
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Sincronización CENSO — Inconsistencias', COLS, filtrados, { filtros: describirFiltros(f) })} disabled={!filtrados.length}>Excel</Btn>
          <Btn onClick={() => setConfirmar(true)} disabled={ejecutando}>{ejecutando ? 'Sincronizando…' : '↻ Ejecutar ahora'}</Btn>
        </div>} />

      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.texto}</div>}

      {/* Estado de la última corrida */}
      <Card className="mb-5 p-5">
        {!log ? (
          <div className="text-sm text-gray-500">Aún no se ha ejecutado ninguna sincronización. Usa «Ejecutar ahora» o espera la corrida automática horaria.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Última sincronización</div>
              <div className="flex items-center gap-2 text-lg font-semibold text-brand">
                {fechaHoraCO(log.run_at)}
                {log.ok ? <Badge color="green">OK</Badge> : <Badge color="red">Con errores</Badge>}
              </div>
              {!log.ok && log.mensaje && <div className="text-xs text-rose-600">{log.mensaje}</div>}
            </div>
            {[['Pacientes en censo', log.total_censo], ['Actualizados', log.pacientes_upsert], ['Egresos', log.altas],
              ['Aislamientos', log.aislamientos], ['Inconsistencias', log.inconsistencias]].map(([k, v]) => (
              <div key={k as string}>
                <div className="text-xs uppercase tracking-wide text-gray-400">{k}</div>
                <div className="text-lg font-semibold text-gray-800">{v ?? '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <FilterBar onClear={() => setF(VACIO)}>
        <select className={selectCls} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]?.label ?? t}</option>)}
        </select>
        <select className={selectCls} value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>
          <option value="">Todas las unidades</option>
          {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className={selectCls} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
          <option value="">Todas las áreas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input className={inputCls} style={{ minWidth: 220 }} placeholder="Paciente, # ingreso, cama, detalle…" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="text-sm text-gray-500">{filtrados.length}{filtrados.length !== rows.length ? ` de ${rows.length}` : ''} inconsistencia(s)</div>
          <Link to="/admin/homologacion" className="text-sm font-medium text-brand-light hover:underline">Ir a Homologación CENSO →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Tipo', 'Paciente / # ingreso', 'Unidad CENSO', 'Área', 'Cama', 'Detalle'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : filtrados.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-emerald-600">{rows.length === 0 ? '✓ Sin inconsistencias — todos los pacientes del CENSO quedaron homologados.' : 'Sin resultados con estos filtros.'}</td></tr>
                : filtrados.map((r) => {
                  const t = TIPO_LABEL[r.tipo] ?? { label: r.tipo, color: 'gray' as const }
                  return (
                    <tr key={r.id} className="hover:bg-brand-50/40">
                      <td className="px-3 py-2 whitespace-nowrap"><Badge color={t.color}>{t.label}</Badge></td>
                      <td className="px-3 py-2">
                        <div className="text-gray-800">{r.paciente ?? '—'}</div>
                        <div className="text-xs text-gray-500">#{r.num_ingreso ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{r.censo_unidad ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.censo_area ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.censo_cama ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.detalle}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmación de ejecución manual */}
      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="Ejecutar sincronización del CENSO">
        <p className="text-sm text-gray-700">
          Esto <b>consultará la API del CENSO en este momento</b> y actualizará los pacientes, aislamientos e
          inconsistencias en la base de datos. La corrida automática es cada hora; úsalo para <b>forzar</b> una actualización inmediata.
        </p>
        <div className="mt-4 flex gap-2">
          <Btn onClick={ejecutar} className="flex-1">Sí, ejecutar ahora</Btn>
          <Btn variant="ghost" onClick={() => setConfirmar(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  )
}
