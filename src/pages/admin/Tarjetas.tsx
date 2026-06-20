import { PageHeader, Badge } from '../../components/ui'
import CrudTable from '../../components/CrudTable'

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
        columnas={[
          { key: 'codigo', label: 'Código' },
          { key: 'sede_id', label: 'Sede' },
          { key: 'estado', label: 'Estado', render: (r) => <Badge color={COLOR[r.estado]}>{ESTADOS.find((e) => e.value === r.estado)?.label}</Badge> },
        ]}
        campos={[
          { key: 'codigo', label: 'Código', type: 'text', required: true },
          { key: 'sede_id', label: 'Sede', type: 'select', optionsTable: { tabla: 'sedes', labelKey: 'nombre' } },
          { key: 'estado', label: 'Estado', type: 'select', options: ESTADOS, default: 'disponible' },
        ]}
      />
    </div>
  )
}
