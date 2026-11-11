import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader, ContadorCircular, Card, PanelIndicadores, ConLateral, FilterBar, selectCls, inputCls, textareaCls, Btn, Badge, Modal, ComentariosBadge, FilasEstado } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import ModalComentarios from '../components/ModalComentarios'
import {
  listSolicitudesHemodinamia, crearSolicitudHemodinamia, cambiarEstadoHemodinamia,
  listComentariosHemodinamia, comentarHemodinamia, listComentariosHemodinamiaPorSolicitud, type FiltrosHemodinamia,
} from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import { ESTADO_HEMODINAMIA_LABEL, type SolicitudHemodinamia, type EstadoHemodinamia, type ComentarioHemodinamia } from '../lib/types'
import { ICONOS_IND } from '../lib/iconos'

function fechaCO(iso: string) { return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16) }

const ESTADO_COLOR: Record<EstadoHemodinamia, any> = { recibido: 'blue', atendido: 'green', revisado: 'purple', pendiente: 'amber' }

const COLS: Columna<SolicitudHemodinamia>[] = [
  { header: 'Fecha/hora', get: (r) => fechaCO(r.fecha_hora) },
  { header: 'Paciente', get: (r) => r.nombre_paciente },
  { header: 'Cédula', get: (r) => r.cedula_paciente },
  { header: 'Procedimiento', get: (r) => r.procedimiento },
  { header: 'Documentos', get: (r) => r.documentos ?? '' },
  { header: 'Estado', get: (r) => ESTADO_HEMODINAMIA_LABEL[r.estado] },
]

const vacio = { cedula_paciente: '', nombre_paciente: '', procedimiento: '', documentos: '' }

export default function Hemodinamia() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const esHemodinamia = perfil?.rol === 'hemodinamia' || perfil?.rol === 'admin'
  const [rows, setRows] = useState<SolicitudHemodinamia[]>([])
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState<FiltrosHemodinamia>({})
  const [abrirNueva, setAbrirNueva] = useState(false)
  const [form, setForm] = useState(vacio)
  const [msg, setMsg] = useState<string | null>(null)

  const [comentar, setComentar] = useState<SolicitudHemodinamia | null>(null)
  const [comentarios, setComentarios] = useState<(ComentarioHemodinamia & { autor_nombre: string | null })[]>([])
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [comentariosPorSolicitud, setComentariosPorSolicitud] = useState<Map<string, (ComentarioHemodinamia & { autor_nombre: string | null })[]>>(new Map())

  // Solo la consulta más reciente escribe estado (al cambiar filtros rápido, una respuesta
  // vieja no pisa la nueva); el indicador de carga se apaga en finally aunque la consulta falle.
  const pedido = useRef(0)
  const cargar = useCallback(async () => {
    const id = ++pedido.current
    setLoading(true)
    try {
      const [r, cm] = await Promise.all([listSolicitudesHemodinamia(f), listComentariosHemodinamiaPorSolicitud()])
      if (id !== pedido.current) return
      setRows(r); setComentariosPorSolicitud(cm)
    } finally {
      if (id === pedido.current) setLoading(false)
    }
  }, [f])
  // Depende de `cargar` (y este de `f`): se recarga cuando cambia cualquier filtro, sin listas a mano.
  useEffect(() => { cargar() }, [cargar])

  async function guardarNueva() {
    if (!form.cedula_paciente.trim() || !form.nombre_paciente.trim() || !form.procedimiento.trim()) { setMsg('Cédula, nombre y procedimiento son obligatorios.'); return }
    await crearSolicitudHemodinamia({ ...form, registrado_por: perfil?.id ?? null })
    setAbrirNueva(false); setForm(vacio); setMsg(null); cargar()
  }

  async function abrirComentarios(r: SolicitudHemodinamia) {
    setComentar(r); setNuevoComentario('')
    setComentarios(await listComentariosHemodinamia(r.id))
  }
  async function enviarComentario() {
    if (!comentar || !nuevoComentario.trim()) return
    await comentarHemodinamia(comentar.id, perfil?.id ?? null, nuevoComentario.trim())
    setComentar(null); setNuevoComentario('')
    cargar()
  }
  async function setEstado(r: SolicitudHemodinamia, estado: EstadoHemodinamia) {
    await cambiarEstadoHemodinamia(r.id, estado)
    cargar()
  }

  return (
    <div>
      <PageHeader title="Hemodinamia — solicitudes de información" subtitle="Documentos y solicitudes que traen los pacientes/familiares para Hemodinamia"
        contador={<ContadorCircular valor={loading ? "…" : rows.length} etiqueta={rows.length === 1 ? "solicitud" : "solicitudes"} />}
        action={<div className="flex gap-2">
          {esStaff && <Btn onClick={() => setAbrirNueva(true)}>+ Nueva solicitud</Btn>}
          <Btn variant="light" onClick={() => exportarExcel('Solicitudes de Hemodinamia', COLS, rows)}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Solicitudes de Hemodinamia', COLS, rows)}>PDF</Btn>
        </div>} />

      <ConLateral lateral={
        <>
          <PanelIndicadores titulo="Resumen" items={[
            { label: 'Total (filtro)', value: rows.length, icono: ICONOS_IND.total, color: 'blue' },
            { label: 'Recibidos', value: rows.filter((r) => r.estado === 'recibido').length, icono: ICONOS_IND.recibido, color: 'teal' },
            { label: 'Atendidos', value: rows.filter((r) => r.estado === 'atendido').length, icono: ICONOS_IND.atendido, color: 'green' },
            { label: 'Pendientes', value: rows.filter((r) => r.estado === 'pendiente').length, icono: ICONOS_IND.pendiente, color: 'amber' },
          ]} />
          <FilterBar vertical onClear={() => setF({})}>
            <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
              <option value="">Todos los estados</option>
              {(Object.keys(ESTADO_HEMODINAMIA_LABEL) as EstadoHemodinamia[]).map((e) => <option key={e} value={e}>{ESTADO_HEMODINAMIA_LABEL[e]}</option>)}
            </select>
            <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
            <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
            <input aria-label="Buscar por paciente, cédula, procedimiento" className={selectCls} placeholder="Paciente, cédula, procedimiento…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
          </FilterBar>
        </>
      }>
      <Card hover={false} className="overflow-hidden">
        <div className="tabla-scroll">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Fecha/hora', 'Paciente', 'Procedimiento', 'Documentos', 'Estado', ''].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              <FilasEstado cargando={loading} vacio={rows.length === 0} columnas={6} textoVacio="Sin registros">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fechaCO(r.fecha_hora)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{r.nombre_paciente}</span>
                        <ComentariosBadge items={comentariosPorSolicitud.get(r.id) ?? []} />
                      </div>
                      <div className="text-xs text-gray-500">{r.cedula_paciente}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.procedimiento}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={r.documentos ?? ''}>{r.documentos ?? '—'}</td>
                    <td className="px-3 py-2">
                      {esHemodinamia
                        ? <select aria-label={`Estado de la solicitud de ${r.nombre_paciente}`} className={`${selectCls} min-w-0`} value={r.estado} onChange={(e) => setEstado(r, e.target.value as EstadoHemodinamia)}>
                            {(Object.keys(ESTADO_HEMODINAMIA_LABEL) as EstadoHemodinamia[]).map((e) => <option key={e} value={e}>{ESTADO_HEMODINAMIA_LABEL[e]}</option>)}
                          </select>
                        : <Badge color={ESTADO_COLOR[r.estado]}>{ESTADO_HEMODINAMIA_LABEL[r.estado]}</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => abrirComentarios(r)} title="Comentarios" className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand hover:bg-brand-100">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.06 0-2.077-.163-3.02-.463L3 21l1.395-3.72C3.512 16.132 3 14.62 3 13c0-4.418 4.03-8 9-8s9 3.582 9 7z" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </FilasEstado>
            </tbody>
          </table>
        </div>
      </Card>
      </ConLateral>

      {/* Nueva solicitud (staff) */}
      <Modal open={abrirNueva} onClose={() => setAbrirNueva(false)} title="Nueva solicitud — Hemodinamia">
        <div className="space-y-3">
          <div><label htmlFor="hemodinamia-cedula-del-paciente" className="block text-xs font-medium text-gray-500 mb-1">Cédula del paciente *</label>
            <input id="hemodinamia-cedula-del-paciente" className={inputCls} value={form.cedula_paciente} onChange={(e) => setForm({ ...form, cedula_paciente: e.target.value })} inputMode="numeric" /></div>
          <div><label htmlFor="hemodinamia-nombres-del-paciente" className="block text-xs font-medium text-gray-500 mb-1">Nombres del paciente *</label>
            <input id="hemodinamia-nombres-del-paciente" className={inputCls} value={form.nombre_paciente} onChange={(e) => setForm({ ...form, nombre_paciente: e.target.value })} /></div>
          <div><label htmlFor="hemodinamia-nombre-del-procedimiento" className="block text-xs font-medium text-gray-500 mb-1">Nombre del procedimiento *</label>
            <input id="hemodinamia-nombre-del-procedimiento" className={inputCls} value={form.procedimiento} onChange={(e) => setForm({ ...form, procedimiento: e.target.value })} /></div>
          <div><label htmlFor="hemodinamia-documentos-que-trae" className="block text-xs font-medium text-gray-500 mb-1">Documentos que trae</label>
            <textarea id="hemodinamia-documentos-que-trae" className={textareaCls} rows={3} value={form.documentos} onChange={(e) => setForm({ ...form, documentos: e.target.value })} /></div>
          {msg && <p className="text-sm text-rose-600">{msg}</p>}
          <div className="flex gap-2 pt-1">
            <Btn onClick={guardarNueva} className="flex-1">Registrar solicitud</Btn>
            <Btn variant="ghost" onClick={() => setAbrirNueva(false)}>Cancelar</Btn>
          </div>
        </div>
      </Modal>

      {/* Comentarios (hilo, visible para todos los roles del módulo) */}
      <ModalComentarios encabezado={comentar ? { titulo: `${comentar.nombre_paciente} · ${comentar.cedula_paciente}`, detalle: comentar.procedimiento } : null}
        comentarios={comentarios} valor={nuevoComentario} onCambio={setNuevoComentario}
        onEnviar={enviarComentario} onCerrar={() => setComentar(null)} />
    </div>
  )
}
