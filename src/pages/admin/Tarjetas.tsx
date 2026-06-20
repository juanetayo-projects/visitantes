import { useEffect, useState } from 'react'
import { PageHeader, Card, FilterBar, Btn, inputCls, selectCls, Badge } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { listSedes } from '../../lib/data'
import type { Sede, Tarjeta } from '../../lib/types'

const EST: Record<string, { c: any; t: string }> = {
  disponible: { c: 'green', t: 'Disponible' }, en_uso: { c: 'amber', t: 'En uso' }, inactiva: { c: 'gray', t: 'Inactiva' },
}

export default function Tarjetas() {
  const [items, setItems] = useState<Tarjeta[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [estado, setEstado] = useState('')
  const [codigo, setCodigo] = useState('')
  const [sedeNueva, setSedeNueva] = useState('')

  async function cargar() {
    let q = supabase.from('tarjetas').select('*').order('codigo')
    if (estado) q = q.eq('estado', estado)
    setItems(((await q).data ?? []) as Tarjeta[])
  }
  useEffect(() => { listSedes().then((s) => { setSedes(s); setSedeNueva(s[0]?.id ?? '') }) }, [])
  useEffect(() => { cargar() }, [estado])

  async function agregar() {
    if (!codigo.trim()) return
    await supabase.from('tarjetas').insert({ codigo: codigo.trim(), sede_id: sedeNueva || null })
    setCodigo(''); cargar()
  }
  async function toggleInactiva(t: Tarjeta) {
    if (t.estado === 'en_uso') return
    await supabase.from('tarjetas').update({ estado: t.estado === 'inactiva' ? 'disponible' : 'inactiva' }).eq('id', t.id)
    cargar()
  }

  const cont = (e: string) => items.filter((i) => i.estado === e).length

  return (
    <div>
      <PageHeader title="Tarjetas de acceso" subtitle="Inventario de tarjetas asignables a visitantes" />
      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        {Object.entries(EST).map(([k, v]) => (
          <Card key={k} className="p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">{v.t}</span><Badge color={v.c}>{cont(k)}</Badge>
          </Card>
        ))}
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-end gap-2">
          <input className={inputCls} style={{ maxWidth: 200 }} placeholder="Código (ej. T-051)" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <select className={selectCls} value={sedeNueva} onChange={(e) => setSedeNueva(e.target.value)}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          <Btn onClick={agregar}>Agregar tarjeta</Btn>
        </div>
      </Card>

      <FilterBar onClear={() => setEstado('')}>
        <select className={selectCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option><option value="disponible">Disponible</option><option value="en_uso">En uso</option><option value="inactiva">Inactiva</option>
        </select>
      </FilterBar>

      <Card className="p-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
          {items.map((t) => (
            <button key={t.id} onClick={() => toggleInactiva(t)} disabled={t.estado === 'en_uso'}
              className={`rounded-lg border-2 px-2 py-2 text-center transition ${t.estado === 'disponible' ? 'border-emerald-300 bg-emerald-50' : t.estado === 'en_uso' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
              <div className="text-sm font-semibold text-gray-800">{t.codigo}</div>
              <div className="text-[11px] text-gray-500">{EST[t.estado].t}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
