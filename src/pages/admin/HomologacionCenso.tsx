import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Btn, PanelIndicadores, ICONOS_IND } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import EstadoSyncCenso from '../../components/EstadoSyncCenso'
import { useSyncCenso } from '../../components/ProgresoSync'
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
  const sync = useSyncCenso()

  useEffect(() => {
    supabase.from('homologacion_ubicaciones').select('id', { count: 'exact', head: true }).eq('activo', true).is('ubicacion_id', null).then(({ count }) => setPendientes(count ?? 0))
    supabase.from('homologacion_ubicaciones').select('id', { count: 'exact', head: true }).eq('activo', true).then(({ count }) => setTotal(count ?? 0))
    // Pacientes reales que hoy no se pueden ubicar: es lo que de verdad indica si la homologación está al día.
    supabase.from('censo_inconsistencias').select('id', { count: 'exact', head: true }).in('tipo', ['ubicacion_no_homologada', 'unidad_desconocida', 'ubicacion_inactiva', 'piso_incoherente']).then(({ count }) => setSinUbicar(count ?? 0))
  }, [version])

  async function sincronizar() {
    await sync.ejecutar()
    setVersion((v) => v + 1)
  }

  return (
    <div>
      <PageHeader title="Homologación CENSO" subtitle="Mapea cada ubicación que llega del CENSO a la ubicación real de la app. La sincronización aplica esta tabla automáticamente."
        action={<Btn onClick={sincronizar} disabled={sync.corriendo}>{sync.corriendo ? 'Sincronizando…' : '↻ Sincronizar ahora'}</Btn>} />
      {sync.vista}

      <CrudTable
        key={`${version}-${soloPendientes}`}
        tabla="homologacion_ubicaciones" titulo="Homologación de ubicaciones" orderBy="censo_unidad"
        subtitulo="CENSO (unidad · área · cama) → ubicación de la app. La sincronización agrega sola las camas nuevas; las que no puede resolver quedan pendientes aquí. Los nombres de unidad que el censo ya no usa quedan como Activo = No."
        lateral={
          <>
            <EstadoSyncCenso key={version} />
            <PanelIndicadores titulo="Estado de la homologación" items={[
              { label: 'Ubicaciones vigentes', value: total ?? '—', hint: 'Del censo, en el catálogo', icono: ICONOS_IND.base, color: 'blue' },
              { label: 'Sin homologar', value: pendientes ?? '—', hint: pendientes ? (soloPendientes ? 'Clic para ver todas' : 'Clic para verlas y asignarlas') : 'Ninguna pendiente', icono: ICONOS_IND.alerta, color: pendientes ? 'amber' : 'green', activo: soloPendientes, onClick: pendientes ? () => { setSoloPendientes((v) => !v); setVersion((v) => v + 1) } : undefined },
              { label: 'Pacientes sin ubicar', value: sinUbicar ?? '—', hint: sinUbicar ? <Link to="/admin/ubicaciones?tab=censo" className="font-medium text-brand-light underline">Ver detalle</Link> : 'Todos con cama están ubicados', icono: ICONOS_IND.cama, color: sinUbicar ? 'red' : 'green' },
            ]} />
          </>
        }
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
