import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, FilterBar, selectCls, Btn, Badge } from '../components/ui'
import { listVisitas, listSedes, describirFiltros, type VisitaListado, type FiltrosVisita } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import type { Sede } from '../lib/types'

function horaCO(iso: string) { return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16) }

const COLS: Columna<VisitaListado>[] = [
  { header: 'Fecha/hora ingreso', get: (r) => horaCO(r.created_at) },
  { header: 'Fecha/hora salida', get: (r) => (r.salida_at ? horaCO(r.salida_at) : '') },
  { header: 'Visitante', get: (r) => r.visitante?.nombres_completos ?? '' },
  { header: 'Cédula', get: (r) => r.visitante?.cedula ?? '' },
  { header: 'Celular', get: (r) => r.visitante?.celular ?? '' },
  { header: 'Acompañante', get: (r) => r.tipo_acompanante ?? '' },
  { header: 'Sede', get: (r) => r.sede?.nombre ?? '' },
  { header: 'Estado', get: (r) => r.estado },
]

// Registros de ingreso sin tarjeta/ubicación asignada (paciente aún no ubicado). Ver también Histórico
// (que solo muestra ingresos vinculados a paciente+tarjeta).
export default function SinTarjeta() {
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState<FiltrosVisita>({ estado: '' })

  useEffect(() => { listSedes().then(setSedes) }, [])
  useEffect(() => {
    setLoading(true)
    listVisitas({ ...f, tipo: 'sin_tarjeta' }).then((r) => { setRows(r); setLoading(false) })
  }, [f.estado, f.sedeId, f.desde, f.hasta])

  const filtrados = useMemo(() => {
    if (!f.texto) return rows
    const t = f.texto.toLowerCase()
    return rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula].some((x) => x?.toLowerCase().includes(t)))
  }, [rows, f.texto])

  return (
    <div>
      <PageHeader title="Ingresos sin tarjeta" subtitle="Visitantes registrados sin ubicación/tarjeta asignada (paciente aún no ubicado)"
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Ingresos sin tarjeta', COLS, filtrados, describirFiltros({ ...f, tipo: 'sin_tarjeta' }, { sedes }))}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Ingresos sin tarjeta', COLS, filtrados, describirFiltros({ ...f, tipo: 'sin_tarjeta' }, { sedes }))}>PDF</Btn>
        </div>} />

      <FilterBar onClear={() => setF({ estado: '' })}>
        <select className={selectCls} value={f.sedeId ?? ''} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>
          <option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Todas (activas y finalizadas)</option><option value="activa">Activas</option><option value="finalizada">Finalizadas</option>
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Nombre o cédula del visitante…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500">{filtrados.length} registro(s)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Ingreso', 'Salida', 'Visitante', 'Acompañante', 'Sede', 'Estado'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={6} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : filtrados.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-gray-400">Sin registros — ajusta los filtros</td></tr>
                : filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.salida_at ? horaCO(r.salida_at) : <span className="text-gray-300">— dentro —</span>}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante?.nombres_completos}</div>
                      <div className="text-xs text-gray-500">{r.visitante?.cedula}{r.visitante?.celular ? ` · ${r.visitante.celular}` : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 capitalize">{r.tipo_acompanante ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.sede?.nombre ?? '—'}</td>
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
