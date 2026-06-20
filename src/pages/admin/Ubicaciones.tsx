import { useEffect, useState } from 'react'
import { PageHeader, Card, selectCls, Badge } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { listSedes, listPisos, listUbicaciones } from '../../lib/data'
import type { Sede, Piso, Ubicacion } from '../../lib/types'

export default function Ubicaciones() {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [ubic, setUbic] = useState<Ubicacion[]>([])
  const [sedeId, setSedeId] = useState('')
  const [pisoId, setPisoId] = useState('')

  useEffect(() => { listSedes().then((s) => { setSedes(s); setSedeId(s[0]?.id ?? '') }) }, [])
  useEffect(() => { if (sedeId) listPisos(sedeId).then((p) => { setPisos(p); setPisoId(p[0]?.id ?? '') }) }, [sedeId])
  useEffect(() => { if (pisoId) listUbicaciones(pisoId).then(setUbic) }, [pisoId])

  async function setCupo(u: Ubicacion, cupo: number) {
    await supabase.from('ubicaciones').update({ cupo_default: cupo }).eq('id', u.id)
    setUbic((prev) => prev.map((x) => x.id === u.id ? { ...x, cupo_default: cupo } : x))
  }

  return (
    <div>
      <PageHeader title="Sedes y ubicaciones" subtitle="Estructura de pisos, habitaciones, cubículos, camas y sillones" />
      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-3">
          <select className={selectCls} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          <select className={selectCls} value={pisoId} onChange={(e) => setPisoId(e.target.value)}>{pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          <div className="ml-auto self-center"><Badge color="blue">{ubic.length} ubicaciones</Badge></div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {ubic.map((u) => (
            <div key={u.id} className="rounded-lg border border-gray-200 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">{u.etiqueta}</span>
                <span className="text-[10px] uppercase text-gray-400">{u.tipo}</span>
              </div>
              {u.area && <div className="text-[11px] text-gray-500">{u.area}</div>}
              <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                Cupo:
                <select className="rounded border border-gray-200 px-1 py-0.5 text-xs" value={u.cupo_default} onChange={(e) => setCupo(u, Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
