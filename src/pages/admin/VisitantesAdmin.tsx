import { PageHeader } from '../../components/ui'
import CrudTable from '../../components/CrudTable'

export default function VisitantesAdmin() {
  return (
    <div>
      <PageHeader title="Visitantes" subtitle="Base de datos de personas que han ingresado" />
      <CrudTable
        tabla="visitantes" titulo="Visitantes" orderBy="nombres_completos"
        columnas={[
          { key: 'cedula', label: 'Cédula' },
          { key: 'nombres_completos', label: 'Nombres completos' },
          { key: 'celular', label: 'Celular' },
          { key: 'email', label: 'Email' },
        ]}
        campos={[
          { key: 'cedula', label: 'Cédula', type: 'text', required: true },
          { key: 'nombres_completos', label: 'Nombres completos', type: 'text', required: true },
          { key: 'celular', label: 'Celular', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
        ]}
      />
    </div>
  )
}
