import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge, selectCls } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { ROL_LABEL, type Perfil, type Rol } from '../../lib/types'

export default function Usuarios() {
  const [items, setItems] = useState<Perfil[]>([])

  async function cargar() { const { data } = await supabase.from('perfiles').select('*').order('email'); setItems((data ?? []) as Perfil[]) }
  useEffect(() => { cargar() }, [])

  async function setRol(p: Perfil, rol: Rol) { await supabase.from('perfiles').update({ rol }).eq('id', p.id); cargar() }
  async function toggle(p: Perfil) { await supabase.from('perfiles').update({ activo: !p.activo }).eq('id', p.id); cargar() }

  return (
    <div>
      <PageHeader title="Usuarios del sistema" subtitle="Administrador · Orientador · Coordinador" />

      <div className="mb-5 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand">
        Los usuarios se crean por invitación desde Supabase Auth (o el alta automática al registrarse asigna rol «Orientador»).
        Aquí ajustas el rol y el estado. La creación con contraseña vía panel queda pendiente de una Edge Function de administración.
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand text-white"><tr>
            {['Nombre', 'Email', 'Rol', 'Estado'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-gray-400">Sin usuarios</td></tr>
              : items.map((p) => (
                <tr key={p.id} className="hover:bg-brand-50/40">
                  <td className="px-3 py-2 font-medium text-gray-800">{p.nombre || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{p.email}</td>
                  <td className="px-3 py-2">
                    <select className={selectCls} style={{ minWidth: 150 }} value={p.rol} onChange={(e) => setRol(p, e.target.value as Rol)}>
                      {(Object.keys(ROL_LABEL) as Rol[]).map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><button onClick={() => toggle(p)}>{p.activo ? <Badge color="green">Activo</Badge> : <Badge>Inactivo</Badge>}</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
