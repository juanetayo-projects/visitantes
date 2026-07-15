import { useState } from 'react'
import { PageHeader, Card, Btn, inputCls } from '../../components/ui'
import CrudTable from '../../components/CrudTable'
import { supabase } from '../../lib/supabase'
import { festivosColombia } from '../../lib/festivosColombia'

export default function Festivos() {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [key, setKey] = useState(0)
  const [msg, setMsg] = useState('')

  async function generar() {
    const lista = festivosColombia(anio)
    const { error } = await supabase.from('festivos').upsert(lista, { onConflict: 'fecha' })
    setMsg(error ? 'Error: ' + error.message : `Generados ${lista.length} festivos de ${anio}.`)
    setKey((k) => k + 1)
  }

  return (
    <div>
      <PageHeader title="Festivos" subtitle="Calendario de Colombia (Ley Emiliani). El sistema también los calcula automáticamente." />
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Generar festivos del año</span>
          <input type="number" className={`${inputCls} w-28`} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          <Btn onClick={generar}>Generar automáticamente</Btn>
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
