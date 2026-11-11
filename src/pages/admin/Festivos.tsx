import { useState } from 'react'
import { PageHeader, Card, Btn, inputCls } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import { supabase } from '../../lib/supabase'
import { festivosColombia } from '../../lib/festivosColombia'

export default function Festivos() {
  // undefined mientras el campo está vacío o incompleto: Number('') daría 0 y se generarían
  // festivos del «año 0» en la base de datos.
  const [anio, setAnio] = useState<number | undefined>(new Date().getFullYear())
  const [key, setKey] = useState(0)
  const [msg, setMsg] = useState('')
  const anioValido = anio != null && Number.isInteger(anio) && anio >= 2000 && anio <= 2100

  async function generar() {
    if (anio == null || !anioValido) { setMsg('Escribe un año válido (2000 a 2100).'); return }
    const lista = festivosColombia(anio)
    const { error } = await supabase.from('festivos').upsert(lista, { onConflict: 'fecha' })
    setMsg(error ? 'Error: ' + error.message : `Generados ${lista.length} festivos de ${anio}.`)
    setKey((k) => k + 1)
  }

  return (
    <div>
      <PageHeader title="Festivos" subtitle="Calendario de Colombia (Ley Emiliani). Desde 2026 incluye el festivo de Nuestra Señora del Rosario de Chiquinquirá (Ley 2578 de 2026). El sistema también los calcula automáticamente." />
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Generar festivos del año</span>
          <input type="number" min={2000} max={2100} aria-label="Año" className={`${inputCls} w-28`} value={anio ?? ''}
            onChange={(e) => { const n = e.currentTarget.valueAsNumber; setAnio(Number.isFinite(n) ? n : undefined) }} />
          <Btn onClick={generar} disabled={!anioValido}>Generar automáticamente</Btn>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </Card>
      <CrudTable
        key={key}
        tabla="festivos" titulo="Festivos" orderBy="fecha"
        columnas={[{ key: 'fecha', label: 'Fecha' }, { key: 'nombre', label: 'Nombre' }]}
        campos={[
          { key: 'fecha', label: 'Fecha', type: 'date', required: true },
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        ]}
      />
    </div>
  )
}
