import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, Badge, Btn } from '../../components/ui'
import { listInconsistencias, ultimoSync, type CensoInconsistencia, type CensoSyncLog } from '../../lib/data'

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

export default function SincronizacionCenso() {
  const [rows, setRows] = useState<CensoInconsistencia[]>([])
  const [log, setLog] = useState<CensoSyncLog | null>(null)
  const [loading, setLoading] = useState(true)

  function cargar() {
    setLoading(true)
    Promise.all([listInconsistencias(), ultimoSync()]).then(([r, l]) => { setRows(r); setLog(l); setLoading(false) })
  }
  useEffect(cargar, [])

  return (
    <div>
      <PageHeader title="Sincronización CENSO" subtitle="Estado de la última sincronización horaria e inconsistencias detectadas al cruzar el CENSO con la homologación."
        action={<Btn variant="light" onClick={cargar}>Actualizar</Btn>} />

      {/* Estado de la última corrida */}
      <Card className="mb-5 p-5">
        {!log ? (
          <div className="text-sm text-gray-500">Aún no se ha ejecutado ninguna sincronización. El proceso corre automáticamente cada hora.</div>
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

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="text-sm text-gray-500">{rows.length} inconsistencia(s) en la última corrida</div>
          <Link to="/admin/homologacion" className="text-sm font-medium text-brand-light hover:underline">Ir a Homologación CENSO →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Tipo', 'Paciente / # ingreso', 'Unidad CENSO', 'Área', 'Cama', 'Detalle'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-emerald-600">✓ Sin inconsistencias — todos los pacientes del CENSO quedaron homologados.</td></tr>
                : rows.map((r) => {
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
    </div>
  )
}
