import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, inputCls, Badge } from '../../components/ui'
import { supabase } from '../../lib/supabase'

interface Item { id: string; nombre: string; activo: boolean }

function Panel({ tabla, titulo }: { tabla: 'servicios' | 'cargos'; titulo: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [nuevo, setNuevo] = useState('')
  async function cargar() { const { data } = await supabase.from(tabla).select('*').order('nombre'); setItems((data ?? []) as Item[]) }
  useEffect(() => { cargar() }, [])
  async function agregar() { if (!nuevo.trim()) return; await supabase.from(tabla).insert({ nombre: nuevo.trim() }); setNuevo(''); cargar() }
  async function toggle(i: Item) { await supabase.from(tabla).update({ activo: !i.activo }).eq('id', i.id); cargar() }

  return (
    <Card className="p-5">
      <div className="font-semibold text-brand mb-3">{titulo} <span className="text-gray-400 text-sm">({items.length})</span></div>
      <div className="flex gap-2 mb-3">
        <input className={inputCls} value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder={`Nuevo ${titulo.toLowerCase()}`} onKeyDown={(e) => e.key === 'Enter' && agregar()} />
        <Btn onClick={agregar}>Agregar</Btn>
      </div>
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between py-2">
            <span className={i.activo ? 'text-gray-800' : 'text-gray-400 line-through'}>{i.nombre}</span>
            <button onClick={() => toggle(i)}>{i.activo ? <Badge color="green">Activo</Badge> : <Badge>Inactivo</Badge>}</button>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function ServiciosCargos() {
  return (
    <div>
      <PageHeader title="Servicios y cargos" subtitle="Catálogos institucionales reutilizables" />
      <div className="grid gap-5 md:grid-cols-2">
        <Panel tabla="servicios" titulo="Servicios" />
        <Panel tabla="cargos" titulo="Cargos" />
      </div>
    </div>
  )
}
