import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, selectCls } from '../components/ui'
import MapaHabitaciones from '../components/MapaHabitaciones'
import { listSedes, listPisos } from '../lib/data'
import type { Sede, Piso } from '../lib/types'

export default function Mapa() {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [sedeId, setSedeId] = useState('')
  const [pisoId, setPisoId] = useState('')

  useEffect(() => { listSedes().then((s) => { setSedes(s); if (s[0]) setSedeId(s[0].id) }) }, [])
  useEffect(() => {
    if (!sedeId) return
    listPisos(sedeId).then((p) => { setPisos(p); setPisoId(p[0]?.id ?? '') })
  }, [sedeId])

  const pisoSel = useMemo(() => pisos.find((p) => p.id === pisoId), [pisos, pisoId])

  return (
    <div>
      <PageHeader title="Mapa de habitaciones" subtitle="Vista global de ocupación y acompañantes en tiempo real" />

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sede</label>
            <select className={selectCls} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Piso / servicio</label>
            <select className={selectCls} value={pisoId} onChange={(e) => setPisoId(e.target.value)}>
              {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        {pisoSel && <div className="mb-4 text-lg font-semibold text-brand">{pisoSel.nombre}</div>}
        {pisoId
          ? <MapaHabitaciones pisoId={pisoId} />
          : <div className="py-16 text-center text-gray-400 text-sm">Selecciona un piso</div>}
      </Card>
    </div>
  )
}
