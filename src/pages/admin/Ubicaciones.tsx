import { useState } from 'react'
import { PageHeader } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import ImportarEstructura from '../../components/ImportarEstructura'

const TIPOS = [
  { value: 'habitacion', label: 'Habitación' }, { value: 'cubiculo', label: 'Cubículo' },
  { value: 'sillon', label: 'Sillón' }, { value: 'cama', label: 'Cama' },
  { value: 'camilla', label: 'Camilla' }, { value: 'area', label: 'Área' },
]

export default function Ubicaciones() {
  const [recarga, setRecarga] = useState(0)
  return (
    <div>
      <PageHeader title="Sedes y ubicaciones" subtitle="Estructura física: sedes, puertas, pisos y ubicaciones (camas, cubículos, sillones)" />
      <div className="space-y-6">
        <ImportarEstructura onDone={() => setRecarga((k) => k + 1)} />
        <CrudTable
          key={`sedes-${recarga}`}
          tabla="sedes" titulo="Sedes" orderBy="orden"
          subtitulo="El prefijo de tarjeta se usa para autogenerar el código (p.ej. T- → T-051) en Tarjetas (catálogo)"
          columnas={[{ key: 'nombre', label: 'Sede' }, { key: 'prefijo_tarjeta', label: 'Prefijo tarjeta' }, { key: 'orden', label: 'Orden' }, { key: 'activo', label: 'Activo' }]}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'prefijo_tarjeta', label: 'Prefijo de tarjeta (ej. T, U)', type: 'text' },
            { key: 'orden', label: 'Orden', type: 'number', default: 0 },
            { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
          ]}
        />
        <CrudTable
          tabla="puertas" titulo="Puertas de acceso" orderBy="nombre"
          subtitulo="«Requiere tarjeta» controla si Registrar pide tarjeta de acceso al ingresar por esa puerta"
          columnas={[{ key: 'nombre', label: 'Puerta' }, { key: 'sede_id', label: 'Sede' }, { key: 'requiere_tarjeta', label: 'Requiere tarjeta' }, { key: 'activo', label: 'Activo' }]}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'sede_id', label: 'Sede', type: 'select', required: true, optionsTable: { tabla: 'sedes', labelKey: 'nombre' } },
            { key: 'requiere_tarjeta', label: 'Requiere tarjeta de acceso', type: 'checkbox', default: true },
            { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
          ]}
        />
        <CrudTable
          key={`pisos-${recarga}`}
          tabla="pisos" titulo="Pisos" orderBy="orden"
          columnas={[{ key: 'nombre', label: 'Piso' }, { key: 'numero', label: 'N°' }, { key: 'sede_id', label: 'Sede' }, { key: 'orden', label: 'Orden' }, { key: 'activo', label: 'Activo' }]}
          campos={[
            { key: 'nombre', label: 'Nombre', type: 'text', required: true },
            { key: 'numero', label: 'Número', type: 'number', required: true },
            { key: 'sede_id', label: 'Sede', type: 'select', required: true, optionsTable: { tabla: 'sedes', labelKey: 'nombre' } },
            { key: 'orden', label: 'Orden', type: 'number', default: 0 },
            { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
          ]}
        />
        <CrudTable
          key={`ubic-${recarga}`}
          tabla="ubicaciones" titulo="Ubicaciones" orderBy="orden"
          subtitulo="Habitaciones, cubículos, camas, camillas y sillones por piso"
          filtros={[
            { key: 'piso_id', label: 'Piso' },
            { key: 'tipo', label: 'Tipo', opciones: TIPOS },
            { key: 'area', label: 'Área' },
            { key: 'servicio', label: 'Servicio' },
            { key: 'activo', label: 'Activo', opciones: [{ value: 'true', label: 'Activos' }, { value: 'false', label: 'Inactivos' }] },
          ]}
          columnas={[
            { key: 'etiqueta', label: 'Etiqueta' }, { key: 'tipo', label: 'Tipo' },
            { key: 'area', label: 'Área' }, { key: 'servicio', label: 'Servicio' }, { key: 'piso_id', label: 'Piso' },
            { key: 'cupo_default', label: 'Cupo' }, { key: 'activo', label: 'Activo' },
          ]}
          campos={[
            { key: 'etiqueta', label: 'Etiqueta', type: 'text', required: true },
            { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: TIPOS },
            { key: 'piso_id', label: 'Piso', type: 'select', required: true, optionsTable: { tabla: 'pisos', labelKey: 'nombre', order: 'orden' } },
            { key: 'area', label: 'Área (opcional)', type: 'text' },
            { key: 'servicio', label: 'Servicio / descripción (opcional)', type: 'text' },
            { key: 'cupo_default', label: 'Cupo', type: 'number', default: 2 },
            { key: 'orden', label: 'Orden', type: 'number', default: 0 },
            { key: 'activo', label: 'Activo', type: 'checkbox', default: true },
          ]}
        />
      </div>
    </div>
  )
}
