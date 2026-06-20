import { PageHeader } from '../../components/ui'
import CrudTable from '../../components/CrudTable'

export default function ServiciosCargos() {
  return (
    <div>
      <PageHeader title="Servicios y cargos" subtitle="Catálogos institucionales reutilizables" />
      <div className="grid gap-5 lg:grid-cols-2">
        <CrudTable
          tabla="servicios" titulo="Servicios" orderBy="nombre"
          columnas={[{ key: 'nombre', label: 'Servicio' }, { key: 'activo', label: 'Activo' }]}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
          ]}
        />
        <CrudTable
          tabla="cargos" titulo="Cargos" orderBy="nombre"
          columnas={[{ key: 'nombre', label: 'Cargo' }, { key: 'activo', label: 'Activo' }]}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
          ]}
        />
      </div>
    </div>
  )
}
