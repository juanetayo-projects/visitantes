import { useEffect, useState } from 'react'
import { Btn, Modal, textareaCls } from './ui'
import { useAuth } from '../auth/AuthProvider'
import { crearNotaAdministrativa, listNotasContexto } from '../lib/data'
import type { OcupacionUbicacion, NotaAdministrativa } from '../lib/types'

// Formatea una marca de tiempo ISO en hora Colombia (GMT-5): «11/11/2026 9:25 a.m.».
function fechaHoraNota(iso: string): string {
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dd = String(co.getUTCDate()).padStart(2, '0'), mm = String(co.getUTCMonth() + 1).padStart(2, '0')
  let h = co.getUTCHours(); const min = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dd}/${mm}/${co.getUTCFullYear()} ${h}:${min} ${ap}`
}

// Nota administrativa sobre una habitación o un paciente (fecha/hora de la app + comentario libre),
// con las notas anteriores del mismo contexto. Antes vivía dentro de la página del Mapa: es una
// pieza con su propio estado (comentario, guardado, historial) y su propio guardado.
export default function ModalNotaAdministrativa({ contexto, onCerrar, onGuardada }: {
  contexto: OcupacionUbicacion | null // null = cerrado
  onCerrar: () => void
  onGuardada: () => void
}) {
  const { perfil } = useAuth()
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState<NotaAdministrativa[]>([])

  // Al abrir otro contexto: comentario en blanco y su historial (se descarta si se cambió a otro).
  useEffect(() => {
    setComentario(''); setHistorial([])
    if (!contexto) return
    let vigente = true
    listNotasContexto({ pacienteDocumento: contexto.paciente_documento ?? null, ubicacionId: contexto.ubicacion_id || null })
      .then((h) => { if (vigente) setHistorial(h) })
    return () => { vigente = false }
  }, [contexto])

  async function guardar() {
    if (!contexto || !comentario.trim()) return
    setGuardando(true)
    try {
      await crearNotaAdministrativa({
        ubicacion_id: contexto.ubicacion_id || null,
        piso_id: contexto.piso_id ?? null,
        num_ingreso: contexto.num_ingreso,
        paciente_documento: contexto.paciente_documento ?? null,
        paciente_nombre: contexto.paciente_nombre,
        comentario: comentario.trim(),
        registrado_por: perfil?.id ?? null,
      })
      onGuardada()
    } finally { setGuardando(false) }
  }

  return (
    <Modal open={!!contexto} onClose={onCerrar} title="Nota administrativa">
      {contexto && (
        <>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Contexto</div>
            <div className="text-base font-semibold text-gray-800">{contexto.paciente_nombre ?? contexto.etiqueta}</div>
            <div className="text-sm text-gray-500">
              {contexto.num_ingreso ? `# ingreso ${contexto.num_ingreso} · ` : ''}{contexto.etiqueta}
              {contexto.paciente_documento ? ` · ID ${contexto.paciente_documento}` : ''}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-400 text-xs">Fecha y hora</span><div className="font-medium text-gray-700">{fechaHoraNota(new Date().toISOString())}</div></div>
            <div><span className="text-gray-400 text-xs">Registrado por</span><div className="font-medium text-gray-700">{perfil?.nombre ?? perfil?.email}</div></div>
          </div>
          <div className="mt-3">
            <label htmlFor="mapa-comentario" className="block text-xs font-medium text-gray-500 mb-1">Comentario *</label>
            <textarea id="mapa-comentario" className={textareaCls} rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Describe la novedad administrativa…" />
          </div>

          {historial.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Notas anteriores ({historial.length})</div>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {historial.map((n, i) => (
                  <div key={n.id} className="rounded-lg border-l-4 border-brand-light bg-brand-50/60 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="inline-flex items-center rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">ID #{historial.length - i}</span>
                      <span>{fechaHoraNota(n.created_at)}</span>
                    </div>
                    <div className="mt-1 text-gray-700">{n.comentario}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Btn onClick={guardar} disabled={guardando || !comentario.trim()} className="flex-1">{guardando ? 'Guardando…' : 'Guardar nota'}</Btn>
            <Btn variant="ghost" onClick={onCerrar}>Cerrar</Btn>
          </div>
        </>
      )}
    </Modal>
  )
}
