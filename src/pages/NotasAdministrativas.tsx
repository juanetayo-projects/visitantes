import { useEffect, useMemo, useState } from 'react'
import { PageHeader, ContadorCircular, ConLateral, PanelIndicadores, ICONOS_IND, Card, FilterBar, selectCls, Btn } from '../components/ui'
import { listNotasAdministrativas, metricasNotasPorUsuario, type FiltrosNota, type ActividadUsuario } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import { supabase } from '../lib/supabase'
import type { NotaAdministrativa } from '../lib/types'

type Fila = NotaAdministrativa & { usuario_nombre: string | null; ubicacion_etiqueta: string | null }

function horaCO(iso: string) { return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16) }

const COLS: Columna<Fila>[] = [
  { header: 'Fecha/hora', get: (r) => horaCO(r.created_at) },
  { header: 'Usuario', get: (r) => r.usuario_nombre ?? '' },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: 'Cédula', get: (r) => r.paciente_documento ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
  { header: '# Ingreso', get: (r) => r.num_ingreso ?? '' },
  { header: 'Comentario', get: (r) => r.comentario },
]

export default function NotasAdministrativas() {
  const [rows, setRows] = useState<Fila[]>([])
  const [actividad, setActividad] = useState<ActividadUsuario[]>([])
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState<FiltrosNota>({})

  useEffect(() => { supabase.from('perfiles').select('id, nombre').order('nombre').then(({ data }) => setUsuarios(data ?? [])) }, [])
  useEffect(() => { metricasNotasPorUsuario().then(setActividad) }, [])
  // `f` solo cambia por setF, y todos sus campos se usan en la consulta: basta con depender de él.
  useEffect(() => {
    let vigente = true // descarta la respuesta si otra consulta la reemplazó
    setLoading(true)
    listNotasAdministrativas(f)
      .then((r) => { if (vigente) setRows(r) })
      .finally(() => { if (vigente) setLoading(false) })
    return () => { vigente = false }
  }, [f])

  const hoyCO = new Date(Date.now() - 5 * 3_600_000).toISOString().substring(0, 10)
  const notasHoy = rows.filter((r) => r.created_at.startsWith(hoyCO)).length
  const usuarioTop = [...actividad].sort((a, b) => b.notas - a.notas)[0]

  // El nombre del usuario ya queda como encabezado de cada grupo, así que la tabla
  // de detalle no repite esa columna.
  const grupos = useMemo(() => {
    const m = new Map<string, { nombre: string; notas: Fila[] }>()
    rows.forEach((r) => {
      const key = r.registrado_por ?? '__sin_usuario__'
      const g = m.get(key) ?? { nombre: r.usuario_nombre ?? 'Usuario desconocido', notas: [] }
      g.notas.push(r)
      m.set(key, g)
    })
    return Array.from(m.values()).sort((a, b) => b.notas.length - a.notas.length || a.nombre.localeCompare(b.nombre))
  }, [rows])

  return (
    <div>
      <PageHeader title="Notas administrativas" subtitle="Novedades registradas sobre habitaciones/pacientes, independientes del registro de visitas"
        contador={<ContadorCircular valor={loading ? '…' : rows.length} etiqueta={rows.length === 1 ? 'nota' : 'notas'} />}
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Notas administrativas', COLS, rows)}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Notas administrativas', COLS, rows)}>PDF</Btn>
        </div>} />

      <ConLateral lateral={<>
        <PanelIndicadores titulo="Resumen" items={[
          { label: 'Total notas (filtro)', value: rows.length, icono: ICONOS_IND.total, color: 'blue' },
          { label: 'Notas de hoy', value: notasHoy, icono: ICONOS_IND.calendario, color: 'green' },
          { label: 'Usuario más activo', value: usuarioTop ? usuarioTop.notas : '—', hint: usuarioTop?.nombre, icono: ICONOS_IND.personas, color: 'purple' },
        ]} />
      <FilterBar vertical onClear={() => setF({})}>
        <select className={selectCls} value={f.usuarioId ?? ''} onChange={(e) => setF({ ...f, usuarioId: e.target.value })}>
          <option value="">Todos los usuarios</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Buscar en comentario, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>
        {/* Actividad administrativa vs. gestión operativa, por usuario; clic para ver solo sus notas */}
        <PanelIndicadores titulo="Actividad por usuario" accion={<span className="text-[11px] text-gray-500">notas</span>} items={actividad.map((a) => ({
          label: a.nombre, value: a.notas, hint: `${a.visitas} visita(s) registrada(s)`, icono: ICONOS_IND.personas, color: 'teal' as const,
          activo: f.usuarioId === a.usuario_id, onClick: () => setF({ ...f, usuarioId: f.usuarioId === a.usuario_id ? '' : a.usuario_id }),
        }))}>
          {actividad.length === 0 && <p className="text-sm text-gray-400">Sin datos</p>}
        </PanelIndicadores>
      </>}>

      {loading ? (
        <Card className="py-10 text-center text-gray-400 text-sm">Cargando…</Card>
      ) : rows.length === 0 ? (
        <Card className="py-10 text-center text-gray-400 text-sm">Sin registros</Card>
      ) : (
        // Una sola tabla con una fila separadora por usuario: así hay un único encabezado inmovilizado.
        <Card hover={false} className="overflow-hidden">
          <div className="tabla-scroll">
            <table className="w-full text-sm">
              <thead className="bg-brand text-white"><tr>
                {['Fecha/hora', 'Paciente', 'Cédula', 'Ubicación', '# Ingreso', 'Comentario'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
              </tr></thead>
              {grupos.map((g) => (
                <tbody key={g.nombre} className="divide-y divide-gray-100">
                  <tr className="bg-brand-50">
                    <td colSpan={6} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-brand">{g.nombre}</span>
                        <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">{g.notas.length} {g.notas.length === 1 ? 'nota' : 'notas'}</span>
                      </div>
                    </td>
                  </tr>
                  {g.notas.map((r) => (
                    <tr key={r.id} className="hover:bg-brand-50/40">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at)}</td>
                      <td className="px-3 py-2 text-gray-700">{r.paciente_nombre ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.paciente_documento ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.ubicacion_etiqueta ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.num_ingreso ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-md">{r.comentario}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </Card>
      )}
      </ConLateral>
    </div>
  )
}
