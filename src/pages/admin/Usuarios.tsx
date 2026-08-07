import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge, selectCls, Btn, inputCls, Modal } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { ROL_LABEL, type Perfil, type Rol } from '../../lib/types'

const vacio = { email: '', password: '', nombre: '', rol: 'orientador' as Rol }

export default function Usuarios() {
  const [items, setItems] = useState<Perfil[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...vacio })
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [passModal, setPassModal] = useState<Perfil | null>(null)
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [passMsg, setPassMsg] = useState<string | null>(null)
  const [passBusy, setPassBusy] = useState(false)

  async function cargar() { const { data } = await supabase.from('perfiles').select('*').order('email'); setItems((data ?? []) as Perfil[]) }
  useEffect(() => { cargar() }, [])

  async function setRol(p: Perfil, rol: Rol) { await supabase.from('perfiles').update({ rol }).eq('id', p.id); cargar() }
  async function toggle(p: Perfil) { await supabase.from('perfiles').update({ activo: !p.activo }).eq('id', p.id); cargar() }

  async function invoke(body: any) {
    const { data, error } = await supabase.functions.invoke('admin-usuarios', { body })
    if (error) {
      // intenta leer el mensaje del cuerpo de la respuesta
      try { const ctx = await (error as any).context?.json?.(); if (ctx?.error) return { error: ctx.error } } catch { /* noop */ }
      return { error: error.message }
    }
    if (data?.error) return { error: data.error }
    return { ok: true }
  }

  async function crear() {
    setMsg(null)
    if (!form.email.trim() || form.password.length < 6) { setMsg({ ok: false, t: 'Correo y contraseña (mín. 6) obligatorios.' }); return }
    setBusy(true)
    const r = await invoke({ action: 'create', ...form })
    setBusy(false)
    if (r.error) { setMsg({ ok: false, t: r.error }); return }
    setMsg({ ok: true, t: `Usuario ${form.email} creado.` }); setForm({ ...vacio }); setOpen(false); cargar()
  }

  async function eliminar(p: Perfil) {
    if (!confirm(`¿Eliminar al usuario ${p.email}?`)) return
    const r = await invoke({ action: 'delete', id: p.id })
    if (r.error) { alert(r.error); return }
    cargar()
  }

  function abrirResetPass(p: Perfil) { setPassModal(p); setPass1(''); setPass2(''); setPassMsg(null) }

  async function confirmarResetPass() {
    if (!passModal) return
    if (pass1.length < 6) { setPassMsg('La contraseña debe tener mínimo 6 caracteres.'); return }
    if (pass1 !== pass2) { setPassMsg('Las contraseñas no coinciden.'); return }
    setPassBusy(true)
    const r = await invoke({ action: 'password', id: passModal.id, password: pass1 })
    setPassBusy(false)
    if (r.error) { setPassMsg(r.error); return }
    setMsg({ ok: true, t: `Contraseña actualizada para ${passModal.email}.` })
    setPassModal(null)
  }

  return (
    <div>
      <PageHeader title="Usuarios del sistema" subtitle="Administrador · Orientador · Coordinador"
        action={<Btn onClick={() => { setForm({ ...vacio }); setMsg(null); setOpen(true) }}>+ Nuevo usuario</Btn>} />

      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</div>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand text-white"><tr>
            {['Nombre', 'Email', 'Rol', 'Estado', 'Acciones'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-brand-50/40">
                <td className="px-3 py-2 font-medium text-gray-800">{p.nombre || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{p.email}</td>
                <td className="px-3 py-2">
                  <select className={selectCls} style={{ minWidth: 150 }} value={p.rol} onChange={(e) => setRol(p, e.target.value as Rol)}>
                    {(Object.keys(ROL_LABEL) as Rol[]).map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><button onClick={() => toggle(p)}>{p.activo ? <Badge color="green">Activo</Badge> : <Badge>Inactivo</Badge>}</button></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => abrirResetPass(p)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-100 mr-1">Contraseña</button>
                  <button onClick={() => eliminar(p)} className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario">
        <div className="space-y-3">
          <input className={inputCls} placeholder="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className={inputCls} type="email" placeholder="Correo electrónico" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inputCls} type="text" placeholder="Contraseña (mín. 6)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className={inputCls} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
            {(Object.keys(ROL_LABEL) as Rol[]).map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </select>
          {msg && !msg.ok && <p className="text-sm text-rose-600">{msg.t}</p>}
        </div>
        <div className="mt-4 flex gap-2">
          <Btn onClick={crear} disabled={busy} className="flex-1">{busy ? 'Creando…' : 'Crear usuario'}</Btn>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
        </div>
      </Modal>

      <Modal open={!!passModal} onClose={() => setPassModal(null)} title="Cambiar contraseña">
        {passModal && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Usuario: <span className="font-medium text-gray-700">{passModal.email}</span></p>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Nueva contraseña (mín. 6)</label>
              <input className={inputCls} type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Confirmar contraseña</label>
              <input className={inputCls} type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} /></div>
            {passMsg && <p className="text-sm text-rose-600">{passMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Btn onClick={confirmarResetPass} disabled={passBusy} className="flex-1">{passBusy ? 'Guardando…' : 'Actualizar contraseña'}</Btn>
              <Btn variant="ghost" onClick={() => setPassModal(null)}>Cancelar</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
