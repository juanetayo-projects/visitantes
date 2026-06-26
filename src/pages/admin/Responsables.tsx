import { useState } from 'react'
import { PageHeader } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import ImportarResponsables from '../../components/ImportarResponsables'

export default function Responsables() {
  const [recarga, setRecarga] = useState(0)
  return (
    <div>
      <PageHeader title="Responsables" subtitle="Colaboradores que acompañan a proveedores" />
      <div className="mb-6"><ImportarResponsables onDone={() => setRecarga((k) => k + 1)} /></div>
      <CrudTable
        key={`resp-${recarga}`}
        tabla="responsables" titulo="Responsables" orderBy="nombre_completo"
        filtros={[
          { key: 'servicio_id', label: 'Servicio' },
          { key: 'cargo_id', label: 'Cargo' },
          { key: 'activo', label: 'Activo', opciones: [{ value: 'true', label: 'Activos' }, { value: 'false', label: 'Inactivos' }] },
        ]}
        columnas={[
          { key: 'nombre_completo', label: 'Nombre' },
          { key: 'numero_documento', label: 'Documento' },
          { key: 'servicio_id', label: 'Servicio' },
          { key: 'cargo_id', label: 'Cargo' },
          { key: 'telefono', label: 'Teléfono' },
          { key: 'activo', label: 'Activo' },
        ]}
        campos={[
          { key: 'nombre_completo', label: 'Nombre completo', type: 'text', required: true },
          { key: 'numero_documento', label: 'Documento', type: 'text', required: true },
          { key: 'servicio_id', label: 'Servicio', type: 'select', optionsTable: { tabla: 'servicios', labelKey: 'nombre', filterActive: true } },
          { key: 'cargo_id', label: 'Cargo', type: 'select', optionsTable: { tabla: 'cargos', labelKey: 'nombre', filterActive: true } },
          { key: 'telefono', label: 'Teléfono', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
        ]}
      />
    </div>
  )
}
