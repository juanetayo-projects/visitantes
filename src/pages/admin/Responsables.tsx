import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, inputCls, selectCls, Badge } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { listServicios, listCargos } from '../../lib/data'
import type { Responsable, Servicio, Cargo } from '../../lib/types'

const vacio = { nombre_completo: '', numero_documento: '', servicio_id: '', cargo_id: '', telefono: '', email: '' }

export default function Responsables() {
  const [items, setItems] = useState<Responsable[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [form, setForm] = useState({ ...vacio })

  async function cargar() {
    const { data } = await supabase.from('responsables').select('*').order('nombre_completo')
    setItems((data ?? []) as Responsable[])
  }
  useEffect(() => { cargar(); listServicios().then(setServicios); listCargos().then(setCargos) }, [])

  async function agregar() {
    if (!form.nombre_completo.trim() || !form.numero_documento.trim()) return
    await supabase.from('responsables').insert({
      nombre_completo: form.nombre_completo.trim(), numero_documento: form.numero_documento.trim(),
      servicio_id: form.servicio_id || null, cargo_id: form.cargo_id || null,
      telefono: form.telefono || null, email: form.email || null,
    })
    setForm({ ...vacio }); cargar()
  }
  async function toggle(r: Responsable) { await supabase.from('responsables').update({ activo: !r.activo }).eq('id', r.id); cargar() }

  const nombreServ = (id: string | null) => servicios.find((s) => s.id === id)?.nombre ?? ''
  const nombreCargo = (id: string | null) => cargos.find((c) => c.id === id)?.nombre ?? ''

  return (
    <div>
      <PageHeader title="Responsables" subtitle="Colaboradores que acompañan a proveedores" />
      <Card className="p-5 mb-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={inputCls} placeholder="Nombre completo *" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} />
          <input className={inputCls} placeholder="Documento *" value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} />
          <select className={selectCls} value={form.servicio_id} onChange={(e) => setForm({ ...form, servicio_id: e.target.value })}>
            <option value="">Servicio</option>{servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select className={selectCls} value={form.cargo_id} onChange={(e) => setForm({ ...form, cargo_id: e.target.value })}>
            <option value="">Cargo</option>{cargos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input className={inputCls} placeholder="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="mt-3"><Btn onClick={agregar}>Agregar responsable</Btn></div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand text-white"><tr>
            {['Nombre', 'Documento', 'Servicio', 'Cargo', 'Contacto', 'Estado'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">Sin responsables</td></tr>
              : items.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/40">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.nombre_completo}</td>
                  <td className="px-3 py-2 text-gray-600">{r.numero_documento}</td>
                  <td className="px-3 py-2 text-gray-600">{nombreServ(r.servicio_id)}</td>
                  <td className="px-3 py-2 text-gray-600">{nombreCargo(r.cargo_id)}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{[r.telefono, r.email].filter(Boolean).join(' · ')}</td>
                  <td className="px-3 py-2"><button onClick={() => toggle(r)}>{r.activo ? <Badge color="green">Activo</Badge> : <Badge>Inactivo</Badge>}</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
