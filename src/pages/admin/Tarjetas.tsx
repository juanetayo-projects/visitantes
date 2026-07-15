import { PageHeader, Badge } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import { supabase } from '../../lib/supabase'
import { siguienteCodigoTarjeta } from '../../lib/data'

const ESTADOS = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_uso', label: 'En uso' },
  { value: 'inactiva', label: 'Inactiva' },
]
const COLOR: Record<string, any> = { disponible: 'green', en_uso: 'amber', inactiva: 'gray' }

export default function Tarjetas() {
  return (
    <div>
      <PageHeader title="Tarjetas de acceso" subtitle="Inventario de tarjetas asignables a visitantes" />
      <CrudTable
        tabla="tarjetas" titulo="Tarjetas" orderBy="codigo"
        subtitulo="El código se autogenera según el prefijo de la sede (déjalo vacío al crear una nueva)"
        columnas={[
          { key: 'codigo', label: 'Código' },
          { key: 'sede_id', label: 'Sede' },
          { key: 'estado', label: 'Estado', render: (r) => <Badge color={COLOR[r.estado]}>{ESTADOS.find((e) => e.value === r.estado)?.label}</Badge> },
        ]}
        campos={[
          { key: 'sede_id', label: 'Sede', type: 'select', required: true, optionsTable: { tabla: 'sedes', labelKey: 'nombre' } },
          { key: 'codigo', label: 'Código (vacío = autogenerar)', type: 'text' },
          { key: 'estado', label: 'Estado', type: 'select', options: ESTADOS, default: 'disponible' },
        ]}
        onBeforeSave={async (form, editing) => {
          if (!form.sede_id) return { error: 'Selecciona una sede.' }
          const { data: sede } = await supabase.from('sedes').select('prefijo_tarjeta, nombre').eq('id', form.sede_id).maybeSingle()
          const prefijo = sede?.prefijo_tarjeta
          if (!prefijo) return { error: `La sede «${sede?.nombre ?? ''}» no tiene un prefijo de tarjeta configurado (Administración → Sedes y ubicaciones).` }
          if (!form.codigo) {
            if (editing) return { error: 'El código es obligatorio al editar.' }
            return { ...form, codigo: await siguienteCodigoTarjeta(form.sede_id) }
          }
          if (!form.codigo.toUpperCase().startsWith(`${prefijo}-`)) {
            return { error: `El código debe empezar con "${prefijo}-" para la sede «${sede.nombre}».` }
          }
          return form
        }}
      />
    </div>
  )
}
