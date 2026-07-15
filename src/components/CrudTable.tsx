import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Btn, inputCls, textareaCls, selectCls, Badge, Modal, SearchableSelect } from './ui'

export type Lookups = Record<string, Map<string, string>>

export interface CrudField {
  key: string
  label: string
  type: 'text' | 'number' | 'email' | 'checkbox' | 'select' | 'date' | 'time' | 'textarea'
  required?: boolean
  options?: { value: string; label: string }[]
  optionsTable?: { tabla: string; labelKey: string; order?: string; filterActive?: boolean }
  default?: any
  inForm?: boolean
  step?: number
}
export interface CrudColumn {
  key: string
  label: string
  render?: (row: any, lookups: Lookups) => ReactNode
}

export interface CrudFiltro {
  key: string
  label: string
  // opciones explícitas; usa '__null' / '__notnull' para filtrar por (no) tener valor.
  // Si se omite, se calculan los valores distintos de la columna.
  opciones?: { value: string; label: string }[]
}

interface Props {
  tabla: string
  titulo: string
  columnas: CrudColumn[]
  campos: CrudField[]
  orderBy?: string
  subtitulo?: string
  filtros?: CrudFiltro[]
  // Se invoca antes de insertar/actualizar; puede completar/validar el formulario.
  // Si retorna { error }, se muestra el mensaje y no se guarda.
  onBeforeSave?: (form: Record<string, any>, editing: boolean) => Promise<Record<string, any> | { error: string }>
}

export default function CrudTable({ tabla, titulo, columnas, campos, orderBy = 'created_at', subtitulo, filtros, onBeforeSave }: Props) {
  const [filtroVals, setFiltroVals] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<any[]>([])
  const [lookups, setLookups] = useState<Lookups>({})
  const [optionsMap, setOptionsMap] = useState<Record<string, { value: string; label: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from(tabla).select('*').order(orderBy)
    setRows(data ?? [])
    setLoading(false)
  }

  async function cargarOpciones() {
    const lk: Lookups = {}; const om: Record<string, { value: string; label: string }[]> = {}
    for (const c of campos) {
      if (c.optionsTable) {
        let q = supabase.from(c.optionsTable.tabla).select('*').order(c.optionsTable.order ?? c.optionsTable.labelKey)
        if (c.optionsTable.filterActive) q = q.eq('activo', true)
        const { data } = await q
        const opts = (data ?? []).map((r: any) => ({ value: r.id, label: r[c.optionsTable!.labelKey] }))
        om[c.key] = opts
        lk[c.key] = new Map(opts.map((o) => [o.value, o.label]))
      } else if (c.options) {
        om[c.key] = c.options
        lk[c.key] = new Map(c.options.map((o) => [o.value, o.label]))
      }
    }
    setOptionsMap(om); setLookups(lk)
  }

  useEffect(() => { cargar(); cargarOpciones() }, [tabla])

  function abrirNuevo() {
    const f: Record<string, any> = {}
    campos.forEach((c) => { f[c.key] = c.default ?? (c.type === 'checkbox' ? false : '') })
    setForm(f); setEditing(null); setError(null); setOpen(true)
  }
  function abrirEdicion(row: any) {
    const f: Record<string, any> = {}
    campos.forEach((c) => {
      let v = row[c.key] ?? (c.type === 'checkbox' ? false : '')
      if (c.type === 'time' && typeof v === 'string' && v) v = v.substring(0, 5) // "13:00:00" → "13:00"
      f[c.key] = v
    })
    setForm(f); setEditing(row); setError(null); setOpen(true)
  }

  async function guardar() {
    setError(null)
    for (const c of campos) {
      if (c.required && (form[c.key] === '' || form[c.key] == null)) { setError(`«${c.label}» es obligatorio.`); return }
    }
    let payload: Record<string, any> = {}
    campos.forEach((c) => {
      let v = form[c.key]
      if (c.type === 'number') v = v === '' ? null : Number(v)
      if (c.type === 'select' && v === '') v = null
      if ((c.type === 'text' || c.type === 'email' || c.type === 'time' || c.type === 'date' || c.type === 'textarea') && v === '') v = null
      payload[c.key] = v
    })
    if (onBeforeSave) {
      const res = await onBeforeSave(payload, !!editing)
      if ('error' in res) { setError(res.error); return }
      payload = res
    }
    const res = editing
      ? await supabase.from(tabla).update(payload).eq('id', editing.id)
      : await supabase.from(tabla).insert(payload)
    if (res.error) { setError(res.error.message); return }
    setOpen(false); cargar()
  }

  async function eliminar(row: any) {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from(tabla).delete().eq('id', row.id)
    if (error) alert('No se pudo eliminar: ' + error.message + '\n(Probablemente está referenciado por otros registros.)')
    else cargar()
  }

  // Opciones de cada filtro: explícitas, o valores distintos de la columna
  const filtroOpciones = useMemo(() => {
    const m: Record<string, { value: string; label: string }[]> = {}
    ;(filtros ?? []).forEach((f) => {
      if (f.opciones) { m[f.key] = f.opciones; return }
      const lk = lookups[f.key]
      const set = new Set<string>()
      rows.forEach((r) => { const v = r[f.key]; if (v != null && v !== '') set.add(String(v)) })
      m[f.key] = [...set].sort().map((v) => ({ value: v, label: lk?.get(v) ?? v }))
    })
    return m
  }, [filtros, rows, lookups])

  const filtrados = useMemo(() => {
    let r = rows
    ;(filtros ?? []).forEach((f) => {
      const v = filtroVals[f.key]
      if (!v) return
      if (v === '__null') r = r.filter((x) => x[f.key] == null)
      else if (v === '__notnull') r = r.filter((x) => x[f.key] != null)
      else r = r.filter((x) => String(x[f.key] ?? '') === v)
    })
    if (busca.trim()) {
      const t = busca.toLowerCase()
      r = r.filter((row) => columnas.some((c) => {
        const raw = c.render ? '' : String(row[c.key] ?? '')
        const lk = lookups[c.key]?.get(row[c.key])
        return raw.toLowerCase().includes(t) || (lk?.toLowerCase().includes(t) ?? false)
      }))
    }
    return r
  }, [rows, busca, columnas, lookups, filtros, filtroVals])

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-gray-100">
        <div>
          <div className="font-semibold text-brand">{titulo} <span className="text-gray-400 text-sm">({filtrados.length}{filtrados.length !== rows.length ? ` de ${rows.length}` : ''})</span></div>
          {subtitulo && <div className="text-xs text-gray-500">{subtitulo}</div>}
        </div>
        <div className="flex gap-2">
          <input className={inputCls} style={{ width: 200 }} placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <Btn onClick={abrirNuevo}>+ Agregar</Btn>
        </div>
      </div>

      {filtros && filtros.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5 self-center text-sm font-medium text-brand">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 9v6l-4 2v-8z" /></svg>
            Filtros
          </div>
          {filtros.map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">{f.label}</label>
              <select className={selectCls} value={filtroVals[f.key] ?? ''} onChange={(e) => setFiltroVals({ ...filtroVals, [f.key]: e.target.value })}>
                <option value="">Todos</option>
                {(filtroOpciones[f.key] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          {(Object.values(filtroVals).some(Boolean) || busca) && (
            <button onClick={() => { setFiltroVals({}); setBusca('') }} className="self-center text-xs text-gray-500 hover:text-brand">Limpiar</button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand/5 text-brand">
            <tr>{columnas.map((c) => <th key={c.key} className="px-3 py-2 text-left font-medium whitespace-nowrap">{c.label}</th>)}
              <th className="px-3 py-2 text-right font-medium">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={columnas.length + 1} className="py-8 text-center text-gray-400">Cargando…</td></tr>
              : filtrados.length === 0 ? <tr><td colSpan={columnas.length + 1} className="py-8 text-center text-gray-400">Sin registros</td></tr>
              : filtrados.map((r) => (
                <tr key={r.id} className="hover:bg-brand-50/40">
                  {columnas.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-gray-700">
                      {c.render ? c.render(r, lookups)
                        : lookups[c.key] ? (lookups[c.key].get(r[c.key]) ?? '—')
                        : typeof r[c.key] === 'boolean' ? (r[c.key] ? <Badge color="green">Sí</Badge> : <Badge>No</Badge>)
                        : String(r[c.key] ?? '—')}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => abrirEdicion(r)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-100 mr-1">Editar</button>
                    <button onClick={() => eliminar(r)} className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">Eliminar</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`${editing ? 'Editar' : 'Nuevo'} — ${titulo}`}>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {campos.filter((c) => c.inForm !== false).map((c) => (
                <div key={c.key}>
                  {c.type === 'checkbox'
                    ? <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={!!form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.checked })} /> {c.label}
                      </label>
                    : <>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{c.label}{c.required && ' *'}</label>
                        {c.type === 'select'
                          ? <SearchableSelect value={form[c.key] ?? ''} onChange={(v) => setForm({ ...form, [c.key]: v })} options={optionsMap[c.key] ?? []} />
                          : c.type === 'textarea'
                          ? <textarea className={textareaCls} rows={3} value={form[c.key] ?? ''} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} />
                          : <input className={inputCls} type={c.type === 'number' ? 'number' : c.type === 'email' ? 'email' : c.type === 'date' ? 'date' : c.type === 'time' ? 'time' : 'text'} step={c.step}
                              value={form[c.key] ?? ''} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} />}
                      </>}
                </div>
              ))}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <Btn onClick={guardar} className="flex-1">{editing ? 'Guardar cambios' : 'Crear'}</Btn>
              <Btn variant="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
            </div>
      </Modal>
    </Card>
  )
}
