import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, ContadorCircular, Card, Badge, Btn, FilterBar, selectCls, inputCls, Modal, ConLateral, PanelIndicadores, ICONOS_IND } from '../../components/ui'
import { listInconsistencias, ultimoSync, type CensoInconsistencia, type CensoSyncLog } from '../../lib/data'
import { exportarExcel, type Columna } from '../../lib/exportar'
import EstadoSyncCenso from '../../components/EstadoSyncCenso'
import { useSyncCenso } from '../../components/ProgresoSync'
import { useAuth } from '../../auth/AuthProvider'

const TIPO_LABEL: Record<string, { label: string; color: 'red' | 'amber' | 'gray' }> = {
  ubicacion_no_homologada: { label: 'Ubicación sin homologar', color: 'red' },
  sin_cama: { label: 'Sin cama asignada', color: 'amber' },
  aislamiento_desconocido: { label: 'Aislamiento no contemplado', color: 'amber' },
  unidad_desconocida: { label: 'Unidad sin piso asignado', color: 'red' },
  ubicacion_inactiva: { label: 'Paciente en ubicación inactiva', color: 'red' },
  piso_incoherente: { label: 'Homologada a otro piso', color: 'red' },
  cama_duplicada: { label: 'Dos pacientes en una ubicación', color: 'amber' },
}

function fechaHoraCO(iso: string | null): string {
  if (!iso) return '—'
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dd = String(co.getUTCDate()).padStart(2, '0'); const mm = String(co.getUTCMonth() + 1).padStart(2, '0')
  let h = co.getUTCHours(); const min = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dd}/${mm}/${co.getUTCFullYear()} ${h}:${min} ${ap}`
}

// fecha_hora_ingreso ya viene en hora local de Colombia (timestamp sin zona): solo se formatea.
function fechaIngreso(v: string | null): { fecha: string; hora: string } | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return null
  const h24 = parseInt(m[4], 10); const h = h24 % 12 === 0 ? 12 : h24 % 12
  return { fecha: `${m[3]}/${m[2]}/${m[1]}`, hora: `${h}:${m[5]} ${h24 < 12 ? 'a.m.' : 'p.m.'}` }
}
const fechaIngresoTxt = (v: string | null) => { const f = fechaIngreso(v); return f ? `${f.fecha} ${f.hora}` : '' }

// Días transcurridos desde el ingreso. Ambas horas se comparan en hora de Colombia (UTC-5).
function diasEstancia(v: string | null): number | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return null
  const ingreso = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  return (Date.now() - 5 * 3_600_000 - ingreso) / 86_400_000
}
const ESTANCIAS: { value: string; label: string; cumple: (d: number) => boolean }[] = [
  { value: 'lt1', label: 'Menos de 24 horas', cumple: (d) => d < 1 },
  { value: '1a3', label: '1 a 3 días', cumple: (d) => d >= 1 && d < 4 },
  { value: '4a7', label: '4 a 7 días', cumple: (d) => d >= 4 && d < 8 },
  { value: 'gt7', label: 'Más de 7 días', cumple: (d) => d >= 8 },
]

interface Filtros { tipo: string; unidad: string; area: string; estancia: string; desde: string; hasta: string; texto: string }
const VACIO: Filtros = { tipo: '', unidad: '', area: '', estancia: '', desde: '', hasta: '', texto: '' }

// Funciones puras (fuera del componente): reciben filas y filtros por parámetro, así los useMemo
// que las usan dependen solo de [rows, f] y nunca trabajan con datos de un render anterior.
// Aplica todos los filtros salvo `omitir`: así el total de cada opción de un filtro refleja
// los demás filtros activos y coincide con lo que mostraría la tabla al elegirla.
function filtrar(rows: CensoInconsistencia[], f: Filtros, omitir?: keyof Filtros): CensoInconsistencia[] {
  const t = f.texto.trim().toLowerCase()
  const estancia = omitir === 'estancia' ? undefined : ESTANCIAS.find((e) => e.value === f.estancia)
  return rows.filter((r) => {
    const dia = r.fecha_hora_ingreso?.substring(0, 10) ?? ''
    const d = diasEstancia(r.fecha_hora_ingreso)
    return (omitir === 'tipo' || !f.tipo || r.tipo === f.tipo) &&
      (omitir === 'unidad' || !f.unidad || r.censo_unidad === f.unidad) &&
      (omitir === 'area' || !f.area || r.censo_area === f.area) &&
      (!estancia || (d != null && estancia.cumple(d))) &&
      (!f.desde || (dia !== '' && dia >= f.desde)) &&
      (!f.hasta || (dia !== '' && dia <= f.hasta)) &&
      (!t || [r.paciente, r.num_ingreso, r.censo_cama, r.detalle].some((x) => x?.toLowerCase().includes(t)))
  })
}
function contar(vals: (string | null)[]): [string, number][] {
  const m = new Map<string, number>()
  vals.forEach((v) => { if (v) m.set(v, (m.get(v) ?? 0) + 1) })
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}
// Las opciones salen de todas las filas (para no desaparecer al filtrar); el total, de las filtradas.
function conTotales(todas: (string | null)[], filtradas: (string | null)[]): [string, number][] {
  const n = new Map(contar(filtradas))
  return contar(todas).map(([v]) => [v, n.get(v) ?? 0])
}

const COLS: Columna<CensoInconsistencia>[] = [
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo]?.label ?? r.tipo },
  { header: 'Paciente', get: (r) => r.paciente ?? '' },
  { header: '# Ingreso', get: (r) => r.num_ingreso ?? '' },
  { header: 'Fecha/hora ingreso', get: (r) => fechaIngresoTxt(r.fecha_hora_ingreso) },
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
  if (f.estancia) p.push(`Estancia: ${ESTANCIAS.find((e) => e.value === f.estancia)?.label ?? f.estancia}`)
  if (f.desde || f.hasta) p.push(`Ingreso: ${f.desde ? f.desde.split('-').reverse().join('/') : '…'} – ${f.hasta ? f.hasta.split('-').reverse().join('/') : '…'}`)
  if (f.texto.trim()) p.push(`Búsqueda: "${f.texto.trim()}"`)
  return p.join(' · ')
}

// soloConsulta: vista para orientadores/coordinadores, sin ejecutar la sincronización ni ir a Homologación.
export default function SincronizacionCenso({ soloConsulta: soloConsultaProp = false }: { soloConsulta?: boolean }) {
  const { perfil } = useAuth()
  // Solo el administrador puede sincronizar; cualquier otro rol ve la página en modo consulta.
  const soloConsulta = soloConsultaProp || perfil?.rol !== 'admin'
  const [rows, setRows] = useState<CensoInconsistencia[]>([])
  const [log, setLog] = useState<CensoSyncLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState<Filtros>(VACIO)
  const [confirmar, setConfirmar] = useState(false)
  const sync = useSyncCenso()
  const ejecutando = sync.corriendo

  function cargar() {
    setLoading(true)
    Promise.all([listInconsistencias(), ultimoSync()]).then(([r, l]) => { setRows(r); setLog(l); setLoading(false) })
  }
  useEffect(cargar, [])

  async function ejecutar() {
    setConfirmar(false)
    const res = await sync.ejecutar()
    if (res.ok) cargar()
  }

  const tipos = useMemo(() => conTotales(rows.map((r) => r.tipo), filtrar(rows, f, 'tipo').map((r) => r.tipo)), [rows, f])
  const unidades = useMemo(() => conTotales(rows.map((r) => r.censo_unidad), filtrar(rows, f, 'unidad').map((r) => r.censo_unidad)), [rows, f])
  const areas = useMemo(() => {
    const base = rows.filter((r) => !f.unidad || r.censo_unidad === f.unidad)
    return conTotales(base.map((r) => r.censo_area), filtrar(rows, f, 'area').map((r) => r.censo_area))
  }, [rows, f])
  const estancias = useMemo(() => {
    const base = filtrar(rows, f, 'estancia').map((r) => diasEstancia(r.fecha_hora_ingreso))
    return ESTANCIAS.map((e) => ({ ...e, n: base.filter((d) => d != null && e.cumple(d)).length }))
  }, [rows, f])
  const porTipo = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.tipo, (m.get(r.tipo) ?? 0) + 1))
    return [...m.entries()].sort((x, y) => y[1] - x[1])
  }, [rows])

  // Desglose por unidad CENSO (de mayor a menor), con el detalle por tipo como subtítulo.
  const porUnidad = useMemo(() => {
    const m = new Map<string, { n: number; tipos: Map<string, number> }>()
    rows.forEach((r) => {
      const u = r.censo_unidad ?? ''
      const e = m.get(u) ?? { n: 0, tipos: new Map() }
      e.n++; e.tipos.set(r.tipo, (e.tipos.get(r.tipo) ?? 0) + 1); m.set(u, e)
    })
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([u, e]) => ({
      unidad: u, n: e.n,
      detalle: [...e.tipos.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${(TIPO_LABEL[t]?.label ?? t).toLowerCase()}`).join(' · '),
    }))
  }, [rows])

  const filtrados = useMemo(() => filtrar(rows, f), [rows, f])
  const hayFiltros = Object.values(f).some((v) => v.trim() !== '')

  return (
    <div>
      <PageHeader title={soloConsulta ? "Inconsistencias del censo" : "Sincronización CENSO"}
        subtitle={soloConsulta ? "Pacientes del CENSO que la app no pudo ubicar en la última sincronización. Si necesitas corregir alguno, avisa al administrador." : "Estado de la última sincronización e inconsistencias detectadas al cruzar el CENSO con la homologación."}
        contador={<ContadorCircular valor={loading ? '…' : filtrados.length} etiqueta={filtrados.length === 1 ? 'inconsistencia' : 'inconsistencias'} de={filtrados.length !== rows.length ? rows.length : undefined} />}
        action={<div className="flex gap-2">
          {!soloConsulta && <Link to="/admin/homologacion" className="self-center text-sm font-medium text-brand-light hover:underline">Ir a Homologación →</Link>}
          <Btn variant="light" onClick={() => exportarExcel('Sincronización CENSO — Inconsistencias', COLS, filtrados, { filtros: describirFiltros(f) })} disabled={!filtrados.length}>Excel</Btn>
          {!soloConsulta && <Btn onClick={() => setConfirmar(true)} disabled={ejecutando}>{ejecutando ? 'Sincronizando…' : '↻ Ejecutar ahora'}</Btn>}
        </div>} />

      {!soloConsulta && sync.vista}
      <ConLateral lateral={
        <>
          <EstadoSyncCenso key={log?.run_at ?? 'sin'} soloSiDesactualizado />
          <PanelIndicadores titulo="Última sincronización" accion={log ? (log.ok ? <Badge color="green">OK</Badge> : <Badge color="red">Con errores</Badge>) : undefined} items={log ? [
            { label: 'Pacientes en censo', value: log.total_censo ?? '—', icono: ICONOS_IND.personas, color: 'blue' },
            { label: 'Actualizados', value: log.pacientes_upsert ?? '—', icono: ICONOS_IND.actualizar, color: 'teal' },
            { label: 'Egresos', value: log.altas ?? '—', icono: ICONOS_IND.salida, color: 'purple' },
            { label: 'Aislamientos', value: log.aislamientos ?? '—', icono: ICONOS_IND.alerta, color: 'red' },
          ] : []}>
            {log
              ? <p className="mb-2 text-sm font-medium text-brand">{fechaHoraCO(log.run_at)}</p>
              : <p className="text-sm text-gray-500">{soloConsulta ? 'Aún no se ha ejecutado ninguna sincronización.' : 'Aún no se ha ejecutado ninguna sincronización. Usa «Ejecutar ahora» o espera la corrida automática.'}</p>}
            {log && !log.ok && log.mensaje && <p className="mb-2 break-words text-xs text-rose-600">{log.mensaje}</p>}
          </PanelIndicadores>
          {/* Desglose: clic en un tipo para ver solo esas inconsistencias en la tabla */}
          <PanelIndicadores titulo={`Inconsistencias (${rows.length})`} items={porTipo.map(([t, n]) => ({
            label: TIPO_LABEL[t]?.label ?? t, value: n, icono: t === 'sin_cama' ? ICONOS_IND.cama : ICONOS_IND.alerta,
            color: TIPO_LABEL[t]?.color === 'red' ? 'red' as const : 'amber' as const,
            activo: f.tipo === t, onClick: () => setF({ ...f, tipo: f.tipo === t ? '' : t }),
          }))}>
            {rows.length === 0 && !loading && <p className="text-sm text-emerald-600">✓ Sin inconsistencias.</p>}
          </PanelIndicadores>
          {/* Desglose por unidad CENSO: clic en una unidad para filtrar la tabla por ella */}
          {porUnidad.length > 0 && (
            <PanelIndicadores titulo={`Por unidad CENSO (${porUnidad.length})`} items={porUnidad.map((u) => ({
              label: u.unidad || 'Sin unidad', hint: u.detalle, value: u.n, icono: ICONOS_IND.base, color: 'blue' as const,
              activo: f.unidad === u.unidad && u.unidad !== '',
              onClick: u.unidad ? () => setF({ ...f, unidad: f.unidad === u.unidad ? '' : u.unidad, area: '' }) : undefined,
            }))} />
          )}
        </>
      }>
      <FilterBar onClear={() => setF(VACIO)}>
        <select className={selectCls} aria-label="Tipo de inconsistencia" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option>
          {tipos.map(([t, n]) => <option key={t} value={t}>{TIPO_LABEL[t]?.label ?? t} ({n})</option>)}
        </select>
        <select className={selectCls} aria-label="Unidad CENSO" value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value, area: '' })}>
          <option value="">Todas las unidades CENSO</option>
          {unidades.map(([u, n]) => <option key={u} value={u}>{u} ({n})</option>)}
        </select>
        {areas.length > 0 && (
          <select className={selectCls} aria-label="Área" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
            <option value="">Todas las áreas</option>
            {areas.map(([a, n]) => <option key={a} value={a}>{a} ({n})</option>)}
          </select>
        )}
        <select className={selectCls} aria-label="Estancia" value={f.estancia} onChange={(e) => setF({ ...f, estancia: e.target.value })}>
          <option value="">Cualquier estancia</option>
          {estancias.map((e) => <option key={e.value} value={e.value}>{e.label} ({e.n})</option>)}
        </select>
        <input type="date" aria-label="Ingreso desde" title="Ingreso desde" className={selectCls} value={f.desde} max={f.hasta || undefined} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" aria-label="Ingreso hasta" title="Ingreso hasta" className={selectCls} value={f.hasta} min={f.desde || undefined} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input aria-label="Buscar por paciente, # ingreso, cama, detalle" className={inputCls} placeholder="Paciente, # ingreso, cama, detalle…" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>
      <p className="-mt-3 mb-3 px-1 text-xs text-gray-500">
        {loading ? 'Cargando…' : hayFiltros
          ? <>Mostrando <b className="text-brand">{filtrados.length}</b> de {rows.length} registros{describirFiltros(f) ? ` · ${describirFiltros(f)}` : ''}</>
          : <>Total: <b className="text-brand">{rows.length}</b> registros</>}
      </p>
      <Card hover={false} className="overflow-hidden">
        <div className="tabla-scroll">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Tipo', 'Paciente / # ingreso', 'Ingreso', 'Unidad CENSO', 'Área', 'Cama', 'Detalle'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : filtrados.length === 0 ? <tr><td colSpan={7}className="py-10 text-center text-emerald-600">{rows.length === 0 ? '✓ Sin inconsistencias — todos los pacientes del CENSO quedaron homologados.' : 'Sin resultados con estos filtros.'}</td></tr>
                : filtrados.map((r) => {
                  const t = TIPO_LABEL[r.tipo] ?? { label: r.tipo, color: 'gray' as const }
                  const fi = fechaIngreso(r.fecha_hora_ingreso)
                  return (
                    <tr key={r.id} className="hover:bg-brand-50/40">
                      <td className="px-3 py-2 whitespace-nowrap"><Badge color={t.color}>{t.label}</Badge></td>
                      <td className="px-3 py-2">
                        <div className="text-gray-800">{r.paciente ?? '—'}</div>
                        <div className="text-xs text-gray-500">#{r.num_ingreso ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fi ? <><div className="text-gray-700">{fi.fecha}</div><div className="text-xs text-gray-500">{fi.hora}</div></> : <span className="text-gray-400">—</span>}
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
      </ConLateral>

      {/* Confirmación de ejecución manual */}
      <Modal open={!soloConsulta && confirmar} onClose={() => setConfirmar(false)} title="Ejecutar sincronización del CENSO">
        <p className="text-sm text-gray-700">
          Esto <b>consultará la API del CENSO en este momento</b> y actualizará los pacientes, aislamientos e
          inconsistencias en la base de datos. Hay corridas automáticas; úsalo para <b>forzar</b> una actualización inmediata.
        </p>
        <div className="mt-4 flex gap-2">
          <Btn onClick={ejecutar} className="flex-1">Sí, ejecutar ahora</Btn>
          <Btn variant="ghost" onClick={() => setConfirmar(false)}>Cancelar</Btn>
        </div>
      </Modal>
    </div>
  )
}
