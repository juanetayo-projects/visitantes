import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import { supabase } from '../../lib/supabase'

const ORIGEN = [{ value: 'auto', label: 'Auto' }, { value: 'regla', label: 'Regla' }, { value: 'manual', label: 'Manual' }]

export default function HomologacionCenso() {
  const [pendientes, setPendientes] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('homologacion_ubicaciones').select('id', { count: 'exact', head: true }).is('ubicacion_id', null).then(({ count }) => setPendientes(count ?? 0))
    supabase.from('homologacion_ubicaciones').select('id', { count: 'exact', head: true }).then(({ count }) => setTotal(count ?? 0))
  }, [])

  return (
    <div>
      <PageHeader title="Homologación CENSO" subtitle="Mapea cada ubicación que llega del CENSO a la ubicación real de la app. El sync horario aplica esta tabla automáticamente." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand">
          <span className="font-semibold">{total ?? '—'}</span> ubicaciones del CENSO catalogadas.
        </div>
        <div className={`rounded-xl px-4 py-3 text-sm ${pendientes ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {pendientes
            ? <><span className="font-semibold">{pendientes}</span> sin homologar — asígnales una ubicación de la app abajo.</>
            : 'Todas las ubicaciones están homologadas.'}
        </div>
      </div>

      <CrudTable
        tabla="homologacion_ubicaciones" titulo="Homologación de ubicaciones" orderBy="censo_unidad"
        subtitulo="CENSO (unidad · área · cama) → ubicación de la app. El sync inserta automáticamente las nuevas; revisa y corrige aquí."
        filtros={[
          { key: 'ubicacion_id', label: 'Estado', opciones: [{ value: '__notnull', label: 'Homologadas' }, { value: '__null', label: 'Sin homologar' }] },
          { key: 'censo_unidad', label: 'Unidad CENSO' },
          { key: 'censo_area', label: 'Área CENSO' },
          { key: 'origen', label: 'Origen', opciones: ORIGEN },
        ]}
        columnas={[
          { key: 'censo_unidad', label: 'Unidad CENSO' },
          { key: 'censo_area', label: 'Área CENSO' },
          { key: 'censo_cama', label: 'Cama CENSO' },
          { key: 'ubicacion_id', label: '→ Ubicación app' },
          { key: 'origen', label: 'Origen' },
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
