import { useEffect, useState } from 'react'
import { PageHeader, Card, MetricCard, FilterBar, selectCls, Btn } from '../components/ui'
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
  useEffect(() => {
    setLoading(true)
    listNotasAdministrativas(f).then((r) => { setRows(r); setLoading(false) })
  }, [f.desde, f.hasta, f.usuarioId, f.texto])

  const hoyCO = new Date(Date.now() - 5 * 3_600_000).toISOString().substring(0, 10)
  const notasHoy = rows.filter((r) => r.created_at.startsWith(hoyCO)).length
  const usuarioTop = [...actividad].sort((a, b) => b.notas - a.notas)[0]

  return (
    <div>
      <PageHeader title="Notas administrativas" subtitle="Novedades registradas sobre habitaciones/pacientes, independientes del registro de visitas"
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Notas administrativas', COLS, rows)}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Notas administrativas', COLS, rows)}>PDF</Btn>
        </div>} />

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <MetricCard label="Total notas (filtro)" value={rows.length} color="blue" />
        <MetricCard label="Notas de hoy" value={notasHoy} color="green" />
        <MetricCard label="Usuario más activo" value={usuarioTop ? usuarioTop.nombre : '—'} hint={usuarioTop ? `${usuarioTop.notas} nota(s)` : undefined} color="purple" />
      </div>

      <FilterBar onClear={() => setF({})}>
        <select className={selectCls} value={f.usuarioId ?? ''} onChange={(e) => setF({ ...f, usuarioId: e.target.value })}>
          <option value="">Todos los usuarios</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Buscar en comentario, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      {/* Actividad administrativa vs. gestión operativa, por usuario */}
      <Card className="overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-semibold text-brand">Actividad por usuario</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand/5 text-brand"><tr>
              <th className="px-3 py-2 text-left font-medium">Usuario</th>
              <th className="px-3 py-2 text-left font-medium">Notas administrativas</th>
              <th className="px-3 py-2 text-left font-medium">Visitas registradas</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {actividad.length === 0
                ? <tr><td colSpan={3} className="py-6 text-center text-gray-400">Sin datos</td></tr>
                : actividad.map((a) => (
                  <tr key={a.usuario_id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-medium text-gray-800">{a.nombre}</td>
                    <td className="px-3 py-2 text-gray-600">{a.notas}</td>
                    <td className="px-3 py-2 text-gray-600">{a.visitas}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500">{rows.length} nota(s)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Fecha/hora', 'Usuario', 'Paciente', 'Cédula', 'Ubicación', '# Ingreso', 'Comentario'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Sin registros</td></tr>
                : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at)}</td>
                    <td className="px-3 py-2 text-gray-700">{r.usuario_nombre ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.paciente_nombre ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.paciente_documento ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.ubicacion_etiqueta ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.num_ingreso ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-md">{r.comentario}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
