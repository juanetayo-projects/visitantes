import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Badge, selectCls } from './ui'
import EstadoSyncCenso from './EstadoSyncCenso'
import { supabase } from '../lib/supabase'

interface Unidad { id_gomedisys: string; nombre: string; piso_id: string | null; ultimo_visto: string | null }
interface Piso { id: string; nombre: string; orden: number }
interface Ubic { id: string; piso_id: string; etiqueta: string; activo: boolean }
interface Homol { ubicacion_id: string | null; ultimo_visto: string | null; activo: boolean }
interface Incon { id: string; tipo: string; censo_unidad: string | null; censo_area: string | null; censo_cama: string | null }

const TIPOS_CATALOGO: Record<string, string> = {
  ubicacion_no_homologada: 'Cama sin homologar',
  unidad_desconocida: 'Unidad sin piso',
  ubicacion_inactiva: 'Ubicación inactiva en la app',
  piso_incoherente: 'Homologada a otro piso',
  cama_duplicada: 'Dos pacientes en una ubicación',
}

// Compara lo que reporta el censo contra el catálogo de la app.
export default function ComparacionCenso() {
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [ubic, setUbic] = useState<Ubic[]>([])
  const [homol, setHomol] = useState<Homol[]>([])
  const [incons, setIncons] = useState<Incon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const [u, p, ub, h, i] = await Promise.all([
      supabase.from('censo_unidades').select('*').order('nombre'),
      supabase.from('pisos').select('id, nombre, orden').order('orden'),
      supabase.from('ubicaciones').select('id, piso_id, etiqueta, activo'),
      supabase.from('homologacion_ubicaciones').select('ubicacion_id, ultimo_visto, activo'),
      supabase.from('censo_inconsistencias').select('id, tipo, censo_unidad, censo_area, censo_cama').in('tipo', Object.keys(TIPOS_CATALOGO)),
    ])
    setUnidades((u.data ?? []) as Unidad[]); setPisos((p.data ?? []) as Piso[]); setUbic((ub.data ?? []) as Ubic[])
    setHomol((h.data ?? []) as Homol[]); setIncons((i.data ?? []) as Incon[]); setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  async function asignarPiso(id: string, piso_id: string) {
    setError(null)
    const { error: e } = await supabase.from('censo_unidades').update({ piso_id: piso_id || null }).eq('id_gomedisys', id)
    if (e) setError('No se pudo guardar: ' + e.message)
    cargar()
  }

  const pisoNombre = useMemo(() => new Map(pisos.map((p) => [p.id, p.nombre])), [pisos])

  // Ubicaciones activas que el censo nunca ha reportado desde que se lleva este control.
  const hayRastreo = homol.some((h) => h.ultimo_visto)
  const noVistasPorPiso = useMemo(() => {
    const vistas = new Set(homol.filter((h) => h.activo && h.ultimo_visto).map((h) => h.ubicacion_id))
    const m = new Map<string, string[]>()
    ubic.filter((u) => u.activo && !vistas.has(u.id)).forEach((u) => {
      const k = pisoNombre.get(u.piso_id) ?? '—'
      m.set(k, [...(m.get(k) ?? []), u.etiqueta])
    })
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [ubic, homol, pisoNombre])

  // Una fila por cama aunque tenga varios pacientes reportados.
  const camas = useMemo(() => {
    const m = new Map<string, Incon>()
    incons.forEach((i) => m.set(`${i.tipo}|${i.censo_unidad}|${i.censo_area}|${i.censo_cama}`, i))
    return [...m.values()].sort((a, b) => (a.censo_unidad ?? '').localeCompare(b.censo_unidad ?? '') || (a.censo_cama ?? '').localeCompare(b.censo_cama ?? '', 'es', { numeric: true }))
  }, [incons])

  if (loading) return <div className="py-10 text-center text-sm text-gray-400">Cargando…</div>

  return (
    <div className="space-y-5">
      <EstadoSyncCenso />
      {error && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <Card hover={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 p-4">
          <div>
            <div className="font-semibold text-brand">Diferencias con el censo <span className="text-sm text-gray-400">({camas.length})</span></div>
            <div className="text-xs text-gray-500">Según la última sincronización: camas con pacientes que la app no puede ubicar bien.</div>
          </div>
          <Link to="/admin/homologacion" className="text-sm font-medium text-brand-light hover:underline">Ir a Homologación CENSO →</Link>
        </div>
        {camas.length === 0
          ? <div className="py-8 text-center text-sm text-emerald-600">✓ Todas las camas ocupadas del censo están ubicadas en la app.</div>
          : <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-brand/5 text-brand"><tr>{['Problema', 'Unidad del censo', 'Área', 'Cama'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {camas.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2"><Badge color="red">{TIPOS_CATALOGO[c.tipo] ?? c.tipo}</Badge></td>
                    <td className="px-3 py-2 text-gray-700">{c.censo_unidad ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.censo_area ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.censo_cama ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>}
      </Card>

      <Card hover={false} className="overflow-hidden">
        <div className="border-b border-black/5 p-4">
          <div className="font-semibold text-brand">Unidades del censo y su piso <span className="text-sm text-gray-400">({unidades.length})</span></div>
          <div className="text-xs text-gray-500">Cada unidad se reconoce por su ID de GoMedisys, así que renombrarla no rompe nada. Una unidad nueva aparece aquí sin piso: asígnaselo para que sus camas se homologuen solas.</div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-brand/5 text-brand"><tr>{['ID', 'Unidad (nombre actual en el censo)', 'Piso de la app'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {unidades.map((u) => (
              <tr key={u.id_gomedisys}>
                <td className="px-3 py-2 text-gray-500">{u.id_gomedisys}</td>
                <td className="px-3 py-2 text-gray-800">{u.nombre}</td>
                <td className="px-3 py-2">
                  <select aria-label={`Piso de ${u.nombre}`} className={`${selectCls} ${u.piso_id ? '' : 'ring-1 ring-amber-400'}`} value={u.piso_id ?? ''} onChange={(e) => asignarPiso(u.id_gomedisys, e.target.value)}>
                    <option value="">— Sin piso —</option>
                    {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      <Card className="p-4">
        <div className="font-semibold text-brand">Ubicaciones activas de la app no vistas en el censo</div>
        <div className="mb-3 text-xs text-gray-500">El censo solo reporta camas ocupadas, así que aparecer aquí no significa que la ubicación no exista. Si una sigue aquí durante semanas, conviene revisarla.</div>
        {!hayRastreo
          ? <p className="text-sm text-gray-500">Aún no hay datos: el rastreo empieza con la primera sincronización de la nueva versión.</p>
          : noVistasPorPiso.length === 0
            ? <p className="text-sm text-emerald-600">✓ Todas las ubicaciones activas se han visto en el censo.</p>
            : <div className="space-y-2">
                {noVistasPorPiso.map(([piso, etiquetas]) => (
                  <details key={piso} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium text-gray-700">{piso} <span className="text-gray-400">({etiquetas.length})</span></summary>
                    <p className="mt-1 text-xs text-gray-500">{[...etiquetas].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).join(', ')}</p>
                  </details>
                ))}
              </div>}
      </Card>
    </div>
  )
}
