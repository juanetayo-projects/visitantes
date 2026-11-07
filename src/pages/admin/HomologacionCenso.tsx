import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Btn } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import EstadoSyncCenso from '../../components/EstadoSyncCenso'
import { ejecutarSyncCenso } from '../../lib/data'
import { supabase } from '../../lib/supabase'

const ORIGEN = [{ value: 'auto', label: 'Auto' }, { value: 'regla', label: 'Regla' }, { value: 'manual', label: 'Manual' }]

function fechaCO(iso: string | null): string {
  if (!iso) return 'Sin registro'
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  return `${String(co.getUTCDate()).padStart(2, '0')}/${String(co.getUTCMonth() + 1).padStart(2, '0')}/${co.getUTCFullYear()}`
}

export default function HomologacionCenso() {
  const [pendientes, setPendientes] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [sinUbicar, setSinUbicar] = useState<number | null>(null)
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [version, setVersion] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)

  useEffect(() => {
    supabase.from('homologacion_ubicaciones').select('id', { count: 'exact', head: true }).eq('activo', true).is('ubicacion_id', null).then(({ count }) => setPendientes(count ?? 0))
    supabase.from('homologacion_ubicaciones').select('id', { count: 'exact', head: true }).eq('activo', true).then(({ count }) => setTotal(count ?? 0))
    // Pacientes reales que hoy no se pueden ubicar: es lo que de verdad indica si la homologación está al día.
    supabase.from('censo_inconsistencias').select('id', { count: 'exact', head: true }).in('tipo', ['ubicacion_no_homologada', 'unidad_desconocida', 'ubicacion_inactiva', 'piso_incoherente']).then(({ count }) => setSinUbicar(count ?? 0))
  }, [version])

  async function sincronizar() {
    setSincronizando(true); setMsg(null)
    const r = await ejecutarSyncCenso()
    setSincronizando(false)
    if (r.ok) setMsg({ ok: true, t: `Sincronización completada: ${r.resumen?.total_censo ?? '—'} pacientes en el censo.` })
    else setMsg({ ok: false, t: 'No se pudo sincronizar: ' + (r.error ?? 'error desconocido') })
    setVersion((v) => v + 1)
  }

  const hayProblemas = !!pendientes || !!sinUbicar

  return (
    <div>
      <PageHeader title="Homologación CENSO" subtitle="Mapea cada ubicación que llega del CENSO a la ubicación real de la app. La sincronización aplica esta tabla automáticamente."
        action={<Btn onClick={sincronizar} disabled={sincronizando}>{sincronizando ? 'Sincronizando…' : '↻ Sincronizar ahora'}</Btn>} />

      <EstadoSyncCenso key={version} />
      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand">
          <span className="font-semibold">{total ?? '—'}</span> ubicaciones del CENSO vigentes en el catálogo.
        </div>
        <button onClick={() => { setSoloPendientes((s) => !s); setVersion((v) => v + 1) }} disabled={!pendientes}
          className={`rounded-xl px-4 py-3 text-left text-sm ${pendientes ? 'bg-amber-50 text-amber-700 hover:ring-1 hover:ring-amber-300' : 'bg-emerald-50 text-emerald-700'}`}>
          {pendientes
            ? <><span className="font-semibold">{pendientes}</span> sin homologar — {soloPendientes ? 'ver todas' : 'clic para verlas y asignarlas'}.</>
            : 'Ninguna ubicación pendiente de homologar.'}
        </button>
        <div className={`rounded-xl px-4 py-3 text-sm ${sinUbicar ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {sinUbicar
            ? <><span className="font-semibold">{sinUbicar}</span> paciente(s) del censo sin ubicar bien. <Link to="/admin/ubicaciones?tab=censo" className="font-medium underline">Ver detalle</Link></>
            : 'Todos los pacientes con cama quedaron ubicados.'}
        </div>
      </div>
      {!hayProblemas && <p className="sr-only">La homologación está al día.</p>}

      <CrudTable
        key={`${version}-${soloPendientes}`}
        tabla="homologacion_ubicaciones" titulo="Homologación de ubicaciones" orderBy="censo_unidad"
        subtitulo="CENSO (unidad · área · cama) → ubicación de la app. La sincronización agrega sola las camas nuevas; las que no puede resolver quedan pendientes aquí. Los nombres de unidad que el censo ya no usa quedan como Activo = No."
        filtrosIniciales={soloPendientes ? { ubicacion_id: '__null', activo: 'true' } : { activo: 'true' }}
        filtros={[
          { key: 'ubicacion_id', label: 'Estado', opciones: [{ value: '__notnull', label: 'Homologadas' }, { value: '__null', label: 'Sin homologar' }] },
          { key: 'censo_unidad', label: 'Unidad CENSO' },
          { key: 'censo_area', label: 'Área CENSO' },
          { key: 'origen', label: 'Origen', opciones: ORIGEN },
          { key: 'activo', label: 'Vigencia', opciones: [{ value: 'true', label: 'Vigentes' }, { value: 'false', label: 'Históricas' }] },
        ]}
        columnas={[
          { key: 'censo_unidad', label: 'Unidad CENSO' },
          { key: 'censo_area', label: 'Área CENSO' },
          { key: 'censo_cama', label: 'Cama CENSO' },
          { key: 'ubicacion_id', label: '→ Ubicación app' },
          { key: 'origen', label: 'Origen' },
          { key: 'ultimo_visto', label: 'Última vez en censo', render: (r) => fechaCO(r.ultimo_visto) },
          { key: 'activo', label: 'Activo' },
        ]}
        campos={[
          { key: 'censo_unidad', label: 'Unidad CENSO (UbicacionActual)', type: 'text', required: true },
          { key: 'censo_area', label: 'Área CENSO (UbicacionArea, opcional)', type: 'text' },
          { key: 'censo_cama', label: 'Cama CENSO (Cama / UbicacionNombre)', type: 'text', required: true },
          { key: 'ubicacion_id', label: 'Ubicación de la app', type: 'select', optionsTable: { tabla: 'v_ubicaciones_label', labelKey: 'label', order: 'orden' } },
          { key: 'origen', label: 'Origen', type: 'select', options: ORIGEN, default: 'manual' },
          { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
        ]}
      />
    </div>
  )
}
