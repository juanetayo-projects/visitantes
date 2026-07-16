import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, Btn, Modal, selectCls, inputCls, textareaCls } from '../components/ui'
import MapaHabitaciones from '../components/MapaHabitaciones'
import { useAuth } from '../auth/AuthProvider'
import { listSedes, listPisos, listUbicaciones, ordenarAreas, buscarPacientePorDocumento, crearNotaAdministrativa, listNotasContexto } from '../lib/data'
import type { Sede, Piso, OcupacionUbicacion, NotaAdministrativa } from '../lib/types'

// Fecha/hora de app en Colombia (GMT-5), para mostrar y guardar en la nota administrativa.
function fechaHoraCO(): string { return fechaHoraNota(new Date().toISOString()) }

// Formatea una marca de tiempo ISO (created_at de una nota previa) en hora Colombia.
function fechaHoraNota(iso: string): string {
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dd = String(co.getUTCDate()).padStart(2, '0'), mm = String(co.getUTCMonth() + 1).padStart(2, '0')
  let h = co.getUTCHours(); const min = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dd}/${mm}/${co.getUTCFullYear()} ${h}:${min} ${ap}`
}

export default function Mapa() {
  const { perfil } = useAuth()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [sedeId, setSedeId] = useState('')
  const [pisoId, setPisoId] = useState('')
  const [area, setArea] = useState('')

  // Nota administrativa: contexto (habitación seleccionada o paciente buscado por cédula)
  const [notaFor, setNotaFor] = useState<OcupacionUbicacion | null>(null)
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState<NotaAdministrativa[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  // Búsqueda por cédula: para casos sin cama mapeada (p.ej. Urgencias)
  const [doc, setDoc] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [docMsg, setDocMsg] = useState<string | null>(null)

  useEffect(() => { listSedes().then((s) => { setSedes(s); if (s[0]) setSedeId(s[0].id) }) }, [])
  useEffect(() => {
    if (!sedeId) return
    listPisos(sedeId).then((p) => { setPisos(p); setPisoId(p[0]?.id ?? '') })
  }, [sedeId])
  useEffect(() => {
    setArea('')
    if (!pisoId) { setAreas([]); return }
    listUbicaciones(pisoId).then((u) => {
      setAreas(ordenarAreas([...new Set(u.map((x) => x.area).filter((a): a is string => !!a))]))
    })
  }, [pisoId])

  const pisoSel = useMemo(() => pisos.find((p) => p.id === pisoId), [pisos, pisoId])

  function abrirNota(o: OcupacionUbicacion) {
    setNotaFor(o); setComentario(''); setHistorial([])
    listNotasContexto({ pacienteDocumento: o.paciente_documento ?? null, ubicacionId: o.ubicacion_id || null }).then(setHistorial)
  }

  async function buscarPorCedula() {
    setDocMsg(null)
    if (!doc.trim()) return
    setBuscando(true)
    try {
      const o = await buscarPacientePorDocumento(doc)
      if (!o) { setDocMsg('No se encontró un paciente con esa identificación.'); return }
      abrirNota(o)
    } finally { setBuscando(false) }
  }

  async function guardarNota() {
    if (!notaFor || !comentario.trim()) return
    setGuardando(true)
    try {
      await crearNotaAdministrativa({
        ubicacion_id: notaFor.ubicacion_id || null,
        piso_id: notaFor.piso_id ?? null,
        num_ingreso: notaFor.num_ingreso,
        paciente_documento: notaFor.paciente_documento ?? null,
        paciente_nombre: notaFor.paciente_nombre,
        comentario: comentario.trim(),
        registrado_por: perfil?.id ?? null,
      })
      setNotaFor(null); setComentario('')
      setMsg('Nota administrativa guardada.')
    } finally { setGuardando(false) }
  }

  // El aviso de guardado se muestra a nivel de página (el modal ya se cerró) y se autolimpia.
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  return (
    <div>
      <PageHeader title="Mapa de habitaciones" subtitle="Vista global de ocupación y acompañantes en tiempo real" />

      {msg && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{msg}</div>}

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sede</label>
            <select className={selectCls} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Piso / servicio</label>
            <select className={selectCls} value={pisoId} onChange={(e) => setPisoId(e.target.value)}>
              {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {areas.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Área</label>
              <select className={selectCls} value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Todas las áreas</option>
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Nota administrativa por cédula (sin cama asignada)</label>
            <div className="flex gap-2">
              <input className={inputCls} value={doc} placeholder="N° identificación del paciente" inputMode="numeric" autoComplete="off"
                onChange={(e) => setDoc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscarPorCedula() }} />
              <Btn variant="light" onClick={buscarPorCedula} disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</Btn>
            </div>
            {docMsg && <p className="mt-1 text-xs text-rose-600">{docMsg}</p>}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        {pisoSel && <div className="mb-4 text-lg font-semibold text-brand">{pisoSel.nombre}{area ? ` · ${area}` : ''}</div>}
        {pisoId
          ? <MapaHabitaciones pisoId={pisoId} area={area || undefined} onSelect={abrirNota} />
          : <div className="py-16 text-center text-gray-400 text-sm">Selecciona un piso</div>}
      </Card>

      {/* Nota administrativa: fecha/hora de la app + comentario libre */}
      <Modal open={!!notaFor} onClose={() => setNotaFor(null)} title="Nota administrativa">
        {notaFor && (
          <>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Contexto</div>
              <div className="text-base font-semibold text-gray-800">{notaFor.paciente_nombre ?? notaFor.etiqueta}</div>
              <div className="text-sm text-gray-500">
                {notaFor.num_ingreso ? `# ingreso ${notaFor.num_ingreso} · ` : ''}{notaFor.etiqueta}
                {notaFor.paciente_documento ? ` · ID ${notaFor.paciente_documento}` : ''}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-400 text-xs">Fecha y hora</span><div className="font-medium text-gray-700">{fechaHoraCO()}</div></div>
              <div><span className="text-gray-400 text-xs">Registrado por</span><div className="font-medium text-gray-700">{perfil?.nombre ?? perfil?.email}</div></div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Comentario *</label>
              <textarea className={textareaCls} rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Describe la novedad administrativa…" />
            </div>

            {historial.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Notas anteriores ({historial.length})</div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {historial.map((n, i) => (
                    <div key={n.id} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between text-gray-500">
                        <span className="font-semibold text-brand">#{historial.length - i}</span>
                        <span>{fechaHoraNota(n.created_at)}</span>
                      </div>
                      <div className="mt-0.5 text-gray-700">{n.comentario}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Btn onClick={guardarNota} disabled={guardando || !comentario.trim()} className="flex-1">{guardando ? 'Guardando…' : 'Guardar nota'}</Btn>
              <Btn variant="ghost" onClick={() => setNotaFor(null)}>Cerrar</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
