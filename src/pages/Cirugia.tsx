import { useEffect, useState } from 'react'
import { PageHeader, Card, MetricCard, FilterBar, selectCls, inputCls, textareaCls, Btn, Badge, Modal } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { listSolicitudesCirugia, crearSolicitudCirugia, revisarSolicitudCirugia, type FiltrosCirugia } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import type { SolicitudCirugia } from '../lib/types'

function fechaCO(iso: string | null) { return iso ? new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16) : '—' }

const COLS: Columna<SolicitudCirugia>[] = [
  { header: 'Fecha', get: (r) => r.fecha },
  { header: 'Paciente', get: (r) => r.nombre_paciente },
  { header: 'Documento', get: (r) => r.documento_paciente },
  { header: 'EPS', get: (r) => r.eps ?? '' },
  { header: 'Quién solicita', get: (r) => r.persona_solicita ?? '' },
  { header: 'Procedimiento', get: (r) => r.procedimiento ?? '' },
  { header: 'Celular', get: (r) => r.celular ?? '' },
  { header: 'Observaciones', get: (r) => r.observaciones ?? '' },
  { header: 'Revisado por Cirugía', get: (r) => (r.revisado_por_cirugia ? 'Sí' : 'No') },
  { header: 'Observación Cirugía', get: (r) => r.observacion_cirugia ?? '' },
]

const vacio = { nombre_paciente: '', documento_paciente: '', eps: '', persona_solicita: '', procedimiento: '', celular: '', observaciones: '' }

export default function Cirugia() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const esCirugia = perfil?.rol === 'cirugia' || perfil?.rol === 'admin'
  const [rows, setRows] = useState<SolicitudCirugia[]>([])
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState<FiltrosCirugia>({})
  const [abrirNueva, setAbrirNueva] = useState(false)
  const [form, setForm] = useState(vacio)
  const [msg, setMsg] = useState<string | null>(null)
  const [revisar, setRevisar] = useState<SolicitudCirugia | null>(null)
  const [obsCirugia, setObsCirugia] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() { setLoading(true); setRows(await listSolicitudesCirugia(f)); setLoading(false) }
  useEffect(() => { cargar() }, [f.desde, f.hasta, f.texto, f.revisadas])

  async function guardarNueva() {
    if (!form.nombre_paciente.trim() || !form.documento_paciente.trim()) { setMsg('Nombre y documento del paciente son obligatorios.'); return }
    await crearSolicitudCirugia({ ...form, atendido_por: perfil?.id ?? null, registrado_por: perfil?.id ?? null })
    setAbrirNueva(false); setForm(vacio); setMsg(null); cargar()
  }

  function abrirRevision(r: SolicitudCirugia) { setRevisar(r); setObsCirugia(r.observacion_cirugia ?? '') }
  async function guardarRevision() {
    if (!revisar || !perfil?.id) return
    setGuardando(true)
    try {
      await revisarSolicitudCirugia(revisar.id, perfil.id, obsCirugia)
      setRevisar(null); cargar()
    } finally { setGuardando(false) }
  }

  const pendientes = rows.filter((r) => !r.revisado_por_cirugia).length

  return (
    <div>
      <PageHeader title="Cirugía — solicitudes de información" subtitle="Información que solicitan pacientes/familiares en recepción sobre Cirugía"
        action={<div className="flex gap-2">
          {esStaff && <Btn onClick={() => setAbrirNueva(true)}>+ Nueva solicitud</Btn>}
          <Btn variant="light" onClick={() => exportarExcel('Solicitudes de Cirugía', COLS, rows)}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Solicitudes de Cirugía', COLS, rows)}>PDF</Btn>
        </div>} />

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <MetricCard label="Total (filtro)" value={rows.length} color="blue" />
        <MetricCard label="Pendientes de revisión" value={pendientes} color="amber" />
        <MetricCard label="Revisadas" value={rows.length - pendientes} color="green" />
      </div>

      <FilterBar onClear={() => setF({})}>
        <select className={selectCls} value={f.revisadas ?? ''} onChange={(e) => setF({ ...f, revisadas: e.target.value as any })}>
          <option value="">Todas</option><option value="no">Pendientes de revisión</option><option value="si">Revisadas</option>
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input className={selectCls} placeholder="Paciente, documento, procedimiento…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500">{rows.length} solicitud(es)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Fecha', 'Paciente', 'EPS', 'Procedimiento', 'Solicita', 'Celular', 'Estado', ''].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-gray-400">Sin registros</td></tr>
                : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.fecha}</td>
                    <td className="px-3 py-2"><div className="font-medium text-gray-800">{r.nombre_paciente}</div><div className="text-xs text-gray-500">{r.documento_paciente}</div></td>
                    <td className="px-3 py-2 text-gray-600">{r.eps ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.procedimiento ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.persona_solicita ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.celular ?? '—'}</td>
                    <td className="px-3 py-2">{r.revisado_por_cirugia ? <Badge color="green">Revisada</Badge> : <Badge color="amber">Pendiente</Badge>}</td>
                    <td className="px-3 py-2 text-right">
                      {esCirugia && <button onClick={() => abrirRevision(r)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-100">
                        {r.revisado_por_cirugia ? 'Ver revisión' : 'Revisar'}
                      </button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Nueva solicitud (staff) */}
      <Modal open={abrirNueva} onClose={() => setAbrirNueva(false)} title="Nueva solicitud de información — Cirugía">
        <div className="space-y-3">
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
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Procedimiento</label>
            <input className={inputCls} value={form.procedimiento} onChange={(e) => setForm({ ...form, procedimiento: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
            <textarea className={textareaCls} rows={3} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></div>
          {msg && <p className="text-sm text-rose-600">{msg}</p>}
          <div className="flex gap-2 pt-1">
            <Btn onClick={guardarNueva} className="flex-1">Registrar solicitud</Btn>
            <Btn variant="ghost" onClick={() => setAbrirNueva(false)}>Cancelar</Btn>
          </div>
        </div>
      </Modal>

      {/* Revisión de Cirugía: no edita los campos originales, solo su observación */}
      <Modal open={!!revisar} onClose={() => setRevisar(null)} title="Revisión — Cirugía">
        {revisar && (
          <>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
              <div className="font-semibold text-gray-800">{revisar.nombre_paciente} · {revisar.documento_paciente}</div>
              <div className="text-gray-500">{fechaCO(revisar.created_at)} · {revisar.procedimiento ?? 'Sin procedimiento indicado'}</div>
              {revisar.observaciones && <div className="mt-1 text-gray-600">Obs. orientador: {revisar.observaciones}</div>}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Observación de Cirugía</label>
              <textarea className={textareaCls} rows={4} value={obsCirugia} onChange={(e) => setObsCirugia(e.target.value)} />
              {revisar.revisado_at && <p className="mt-1 text-xs text-gray-400">Última revisión: {fechaCO(revisar.revisado_at)}</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <Btn onClick={guardarRevision} disabled={guardando} className="flex-1">{guardando ? 'Guardando…' : 'Guardar revisión'}</Btn>
              <Btn variant="ghost" onClick={() => setRevisar(null)}>Cerrar</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
