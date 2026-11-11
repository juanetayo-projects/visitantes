import { Btn, Modal, textareaCls } from './ui'

const fechaCO = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16)

export interface ComentarioHilo { id: string; autor_nombre: string | null; comentario: string; created_at: string }

// Hilo de comentarios de una solicitud (Cirugía, Hemodinamia, Otro): antes había tres copias
// iguales de este modal, una en cada página.
export default function ModalComentarios({ encabezado, comentarios, valor, onCambio, onEnviar, onCerrar }: {
  // null = cerrado. titulo: paciente · documento; detalle: procedimiento o concepto.
  encabezado: { titulo: string; detalle: string } | null
  comentarios: ComentarioHilo[]
  valor: string
  onCambio: (v: string) => void
  onEnviar: () => void
  onCerrar: () => void
}) {
  return (
    <Modal open={!!encabezado} onClose={onCerrar} title="Comentarios">
      {encabezado && (
        <>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm mb-3">
            <div className="font-semibold text-gray-800">{encabezado.titulo}</div>
            <div className="text-gray-500">{encabezado.detalle}</div>
          </div>
          <div className="max-h-56 overflow-y-auto space-y-2">
            {comentarios.length === 0 && <p className="text-sm text-gray-400">Sin comentarios todavía.</p>}
            {comentarios.map((c, i) => (
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
            <label htmlFor="nuevo-comentario" className="block text-xs font-medium text-gray-500 mb-1">Nuevo comentario</label>
            <textarea id="nuevo-comentario" className={textareaCls} rows={3} value={valor} onChange={(e) => onCambio(e.target.value)} placeholder="Escribe aquí el seguimiento…" />
          </div>
          <div className="mt-3 flex gap-2">
            <Btn onClick={onEnviar} disabled={!valor.trim()} className="flex-1">Comentar</Btn>
            <Btn variant="ghost" onClick={onCerrar}>Cerrar</Btn>
          </div>
        </>
      )}
    </Modal>
  )
}
