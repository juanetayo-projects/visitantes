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
  const [edit, setEdit] = useState<Perfil | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', email: '', rol: 'orientador' as Rol, activo: true })
  const [editMsg, setEditMsg] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [yoId, setYoId] = useState<string | null>(null)

  async function cargar() { const { data } = await supabase.from('perfiles').select('*').order('email'); setItems((data ?? []) as Perfil[]) }
  useEffect(() => { cargar(); supabase.auth.getUser().then(({ data }) => setYoId(data.user?.id ?? null)) }, [])

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
    let r: Awaited<ReturnType<typeof invoke>>
    try { r = await invoke({ action: 'create', ...form }) } finally { setBusy(false) }
    if (r.error) { setMsg({ ok: false, t: r.error }); return }
    setMsg({ ok: true, t: `Usuario ${form.email} creado.` }); setForm({ ...vacio }); setOpen(false); cargar()
  }

  async function eliminar(p: Perfil) {
    if (!confirm(`¿Eliminar al usuario ${p.email}?`)) return
    const r = await invoke({ action: 'delete', id: p.id })
    if (r.error) { alert(r.error); return }
    cargar()
  }

  function abrirEdicion(p: Perfil) {
    setEdit(p); setEditMsg(null)
    setEditForm({ nombre: p.nombre ?? '', email: p.email ?? '', rol: p.rol, activo: p.activo })
  }

  async function guardarEdicion() {
    if (!edit) return
    const nombre = editForm.nombre.trim(); const email = editForm.email.trim().toLowerCase()
    if (!nombre) { setEditMsg('El nombre es obligatorio.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEditMsg('Escribe un correo válido.'); return }
    setEditBusy(true)
    // El correo también vive en Auth, por eso va por la Edge Function; lo demás basta con el perfil.
    let error: string | null | undefined
    try {
      if (email !== (edit.email ?? '').toLowerCase()) {
        error = (await invoke({ action: 'update', id: edit.id, nombre, email, rol: editForm.rol, activo: editForm.activo })).error
      } else {
        error = (await supabase.from('perfiles').update({ nombre, rol: editForm.rol, activo: editForm.activo }).eq('id', edit.id)).error?.message
      }
    } finally {
      setEditBusy(false)
    }
    if (error) { setEditMsg(error); return }
    setMsg({ ok: true, t: `Usuario ${email} actualizado.` }); setEdit(null); cargar()
  }

  function abrirResetPass(p: Perfil) { setPassModal(p); setPass1(''); setPass2(''); setPassMsg(null) }

  async function confirmarResetPass() {
    if (!passModal) return
    if (pass1.length < 6) { setPassMsg('La contraseña debe tener mínimo 6 caracteres.'); return }
    if (pass1 !== pass2) { setPassMsg('Las contraseñas no coinciden.'); return }
    setPassBusy(true)
    let r: Awaited<ReturnType<typeof invoke>>
    try { r = await invoke({ action: 'password', id: passModal.id, password: pass1 }) } finally { setPassBusy(false) }
    if (r.error) { setPassMsg(r.error); return }
    setMsg({ ok: true, t: `Contraseña actualizada para ${passModal.email}.` })
    setPassModal(null)
  }

  return (
    <div>
      <PageHeader title="Usuarios del sistema" subtitle="Administrador · Orientador · Coordinador"
        action={<Btn onClick={() => { setForm({ ...vacio }); setMsg(null); setOpen(true) }}>+ Nuevo usuario</Btn>} />

      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</div>}

      <Card hover={false} className="overflow-hidden">
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
                  <button onClick={() => abrirEdicion(p)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-100 mr-1">Editar</button>
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

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar usuario">
        {edit && (
          <div className="space-y-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo *</label>
              <input className={inputCls} value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Correo electrónico *</label>
              <input className={inputCls} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              <p className="mt-1 text-xs text-gray-400">Es el correo con el que inicia sesión.</p></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
              <select className={inputCls} value={editForm.rol} disabled={edit.id === yoId} onChange={(e) => setEditForm({ ...editForm, rol: e.target.value as Rol })}>
                {(Object.keys(ROL_LABEL) as Rol[]).map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </select></div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={editForm.activo} disabled={edit.id === yoId} onChange={(e) => setEditForm({ ...editForm, activo: e.target.checked })} /> Usuario activo
            </label>
            {edit.id === yoId && <p className="text-xs text-gray-400">Es tu propio usuario: el rol y el estado no se pueden cambiar desde aquí.</p>}
            {editMsg && <p className="text-sm text-rose-600">{editMsg}</p>}
            <div className="flex gap-2 pt-1">
              <Btn onClick={guardarEdicion} disabled={editBusy} className="flex-1">{editBusy ? 'Guardando…' : 'Guardar cambios'}</Btn>
              <Btn variant="ghost" onClick={() => setEdit(null)}>Cancelar</Btn>
            </div>
          </div>
        )}
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
