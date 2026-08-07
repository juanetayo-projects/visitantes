import { useEffect, useState } from 'react'
import { PageHeader, Card, MetricCard, FilterBar, selectCls, inputCls, textareaCls, Btn, Badge, Modal, ComentariosBadge } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import {
  listSolicitudesOtro, crearSolicitudOtro, cambiarEstadoOtro,
  listComentariosOtro, comentarOtro, listComentariosOtroPorSolicitud, listAtendidoPorOtro, type FiltrosOtro,
} from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import { ESTADO_HEMODINAMIA_LABEL, type SolicitudOtro, type EstadoHemodinamia, type ComentarioOtro } from '../lib/types'

function fechaCO(iso: string) { return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16) }
function hoyCO() { return new Date(Date.now() - 5 * 3_600_000).toISOString().substring(0, 10) }

const ESTADO_COLOR: Record<EstadoHemodinamia, any> = { recibido: 'blue', atendido: 'green', revisado: 'purple', pendiente: 'amber' }

const COLS: Columna<SolicitudOtro>[] = [
  { header: 'Fecha', get: (r) => r.fecha },
  { header: 'Paciente', get: (r) => r.nombre_paciente },
  { header: 'Documento', get: (r) => r.documento_paciente },
  { header: 'EPS', get: (r) => r.eps ?? '' },
  { header: 'Quién solicita', get: (r) => r.persona_solicita ?? '' },
  { header: 'Concepto', get: (r) => r.concepto ?? '' },
  { header: 'Celular', get: (r) => r.celular ?? '' },
  { header: 'Observaciones', get: (r) => r.observaciones ?? '' },
  { header: 'Atendido por', get: (r) => r.atendido_por_nombre ?? '' },
  { header: 'Estado', get: (r) => ESTADO_HEMODINAMIA_LABEL[r.estado] },
]

const vacio = { fecha: hoyCO(), nombre_paciente: '', documento_paciente: '', eps: '', persona_solicita: '', concepto: '', celular: '', observaciones: '' }

export default function Otro() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const esOtro = perfil?.rol === 'otro' || perfil?.rol === 'admin'
  const [rows, setRows] = useState<SolicitudOtro[]>([])
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState<FiltrosOtro>({})
  const [abrirNueva, setAbrirNueva] = useState(false)
  const [form, setForm] = useState(vacio)
  const [msg, setMsg] = useState<string | null>(null)

  const [comentar, setComentar] = useState<SolicitudOtro | null>(null)
  const [comentarios, setComentarios] = useState<(ComentarioOtro & { autor_nombre: string | null })[]>([])
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [comentariosPorSolicitud, setComentariosPorSolicitud] = useState<Map<string, (ComentarioOtro & { autor_nombre: string | null })[]>>(new Map())
  const [atendidoPorOpciones, setAtendidoPorOpciones] = useState<string[]>([])

  async function cargar() {
    setLoading(true)
    const [r, cm] = await Promise.all([listSolicitudesOtro(f), listComentariosOtroPorSolicitud()])
    setRows(r); setComentariosPorSolicitud(cm); setLoading(false)
  }
  useEffect(() => { cargar() }, [f.estado, f.atendidoPor, f.desde, f.hasta, f.texto])
  useEffect(() => { listAtendidoPorOtro().then(setAtendidoPorOpciones) }, [])

  function abrirModalNueva() { setForm({ ...vacio, fecha: hoyCO() }); setMsg(null); setAbrirNueva(true) }

  async function guardarNueva() {
    if (!form.nombre_paciente.trim() || !form.documento_paciente.trim()) { setMsg('Nombre y documento del paciente son obligatorios.'); return }
    await crearSolicitudOtro({
      ...form, atendido_por: perfil?.id ?? null, atendido_por_nombre: perfil?.nombre ?? perfil?.email ?? null, registrado_por: perfil?.id ?? null,
    })
    setAbrirNueva(false); setForm(vacio); setMsg(null); cargar()
  }

  async function abrirComentarios(r: SolicitudOtro) {
    setComentar(r); setNuevoComentario('')
    setComentarios(await listComentariosOtro(r.id))
  }
  async function enviarComentario() {
    if (!comentar || !nuevoComentario.trim()) return
    await comentarOtro(comentar.id, perfil?.id ?? null, nuevoComentario.trim())
    setComentar(null); setNuevoComentario('')
    cargar()
  }
  async function setEstado(r: SolicitudOtro, estado: EstadoHemodinamia) {
    await cambiarEstadoOtro(r.id, estado)
    cargar()
  }

  return (
    <div>
      <PageHeader title="Otro — solicitudes de información" subtitle="Otros conceptos que solicitan pacientes/familiares en recepción (aparte de Cirugía y Hemodinamia)"
        action={<div className="flex gap-2">
          {esStaff && <Btn onClick={abrirModalNueva}>+ Nueva solicitud</Btn>}
          <Btn variant="light" onClick={() => exportarExcel('Solicitudes de Otro', COLS, rows)}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Solicitudes de Otro', COLS, rows)}>PDF</Btn>
        </div>} />

      <div className="grid gap-4 sm:grid-cols-4 mb-5">
        <MetricCard label="Total (filtro)" value={rows.length} color="blue" />
        <MetricCard label="Recibidos" value={rows.filter((r) => r.estado === 'recibido').length} color="blue" />
        <MetricCard label="Atendidos" value={rows.filter((r) => r.estado === 'atendido').length} color="green" />
        <MetricCard label="Pendientes" value={rows.filter((r) => r.estado === 'pendiente').length} color="amber" />
      </div>

      <FilterBar onClear={() => setF({})}>
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_HEMODINAMIA_LABEL) as EstadoHemodinamia[]).map((e) => <option key={e} value={e}>{ESTADO_HEMODINAMIA_LABEL[e]}</option>)}
        </select>
        <select className={selectCls} value={f.atendidoPor ?? ''} onChange={(e) => setF({ ...f, atendidoPor: e.target.value })}>
          <option value="">Todos (atendido por)</option>
          {atendidoPorOpciones.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Paciente, documento, concepto…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500">{rows.length} solicitud(es)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Fecha', 'Paciente', 'EPS', 'Concepto', 'Solicita', 'Atendido por', 'Estado'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
              <th className="sticky right-0 z-10 bg-brand px-3 py-2.5 text-left font-medium whitespace-nowrap shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)]"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin registros</td></tr>
                : rows.map((r) => (
                  <tr key={r.id} className="group hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.fecha}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{r.nombre_paciente}</span>
                        <ComentariosBadge items={comentariosPorSolicitud.get(r.id) ?? []} />
                      </div>
                      <div className="text-xs text-gray-500">{r.documento_paciente}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.eps ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.concepto ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <div>{r.persona_solicita ?? '—'}</div>
                      {r.celular && <div className="text-xs text-gray-500">{r.celular}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.atendido_por_nombre ?? '—'}</td>
                    <td className="px-3 py-2">
                      {esOtro
                        ? <select className={`${selectCls} min-w-0`} value={r.estado} onChange={(e) => setEstado(r, e.target.value as EstadoHemodinamia)}>
                            {(Object.keys(ESTADO_HEMODINAMIA_LABEL) as EstadoHemodinamia[]).map((e) => <option key={e} value={e}>{ESTADO_HEMODINAMIA_LABEL[e]}</option>)}
                          </select>
                        : <Badge color={ESTADO_COLOR[r.estado]}>{ESTADO_HEMODINAMIA_LABEL[r.estado]}</Badge>}
                    </td>
                    <td className="sticky right-0 z-10 bg-white px-3 py-2 text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)] group-hover:bg-brand-50">
                      <button onClick={() => abrirComentarios(r)} title="Comentarios" className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand hover:bg-brand-100">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.06 0-2.077-.163-3.02-.463L3 21l1.395-3.72C3.512 16.132 3 14.62 3 13c0-4.418 4.03-8 9-8s9 3.582 9 7z" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nueva solicitud (staff) */}
      <Modal open={abrirNueva} onClose={() => setAbrirNueva(false)} title="Nueva solicitud de información — Otro">
        <div className="space-y-3">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Fecha *</label>
            <input type="date" className={inputCls} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Nombre del paciente *</label>
            <input className={inputCls} value={form.nombre_paciente} onChange={(e) => setForm({ ...form, nombre_paciente: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Documento del paciente *</label>
            <input className={inputCls} value={form.documento_paciente} onChange={(e) => setForm({ ...form, documento_paciente: e.target.value })} inputMode="numeric" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">EPS</label>
              <input className={inputCls} value={form.eps} onChange={(e) => setForm({ ...form, eps: e.target.value })} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Celular</label>
              <input className={inputCls} value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Persona que solicita la información</label>
            <input className={inputCls} value={form.persona_solicita} onChange={(e) => setForm({ ...form, persona_solicita: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Concepto</label>
            <input className={inputCls} value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
            <textarea className={textareaCls} rows={3} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
          {msg && <p className="text-sm text-rose-600">{msg}</p>}
          <div className="flex gap-2 pt-1">
            <Btn onClick={guardarNueva} className="flex-1">Registrar solicitud</Btn>
            <Btn variant="ghost" onClick={() => setAbrirNueva(false)}>Cancelar</Btn>
          </div>
        </div>
      </Modal>

      {/* Comentarios (hilo, visible para todos los roles del módulo, incl. orientador) */}
      <Modal open={!!comentar} onClose={() => setComentar(null)} title="Comentarios">
        {comentar && (
          <>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm mb-3">
              <div className="font-semibold text-gray-800">{comentar.nombre_paciente} · {comentar.documento_paciente}</div>
              <div className="text-gray-500">{comentar.concepto ?? 'Sin concepto indicado'}</div>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-2">
              {comentarios.length === 0
                ? <p className="text-sm text-gray-400">Sin comentarios todavía.</p>
                : comentarios.map((c, i) => (
                  <div key={c.id} className="rounded-lg border-l-4 border-brand-light bg-brand-50/60 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">ID #{i + 1}</span>
                        <span className="font-medium text-gray-700">{c.autor_nombre ?? 'Usuario'}</span>
                      </span>
                      <span>{fechaCO(c.created_at)}</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{c.comentario}</div>
                  </div>
                ))}
            </div>
            <div className="mt-3">
              <textarea className={textareaCls} rows={3} value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)} placeholder="Agregar comentario…" />
            </div>
            <div className="mt-3 flex gap-2">
              <Btn onClick={enviarComentario} disabled={!nuevoComentario.trim()} className="flex-1">Comentar</Btn>
              <Btn variant="ghost" onClick={() => setComentar(null)}>Cerrar</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
