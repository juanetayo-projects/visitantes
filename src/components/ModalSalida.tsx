import type { ReactNode } from 'react'
import { Modal } from './ui'

// Datos que muestra la confirmación, ya normalizados por cada página (Visitas y Tarjetas los
// tienen con formas distintas).
export interface DatosSalida {
  visitante: string | null
  cedula: string | null
  celular: string | null
  tarjeta: string
  tipo: string
  paciente: string
  ingreso: string
}

// Confirmación de «Registrar salida y devolver tarjeta». Antes había dos copias, en Visitas y en Tarjetas.
export default function ModalSalida({ datos, aviso, onConfirmar, onCerrar }: {
  datos: DatosSalida | null // null = cerrado
  aviso: ReactNode
  onConfirmar: () => void
  onCerrar: () => void
}) {
  return (
    <Modal open={!!datos} onClose={onCerrar} title="Registrar salida y devolver tarjeta">
      {datos && (
        <>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Visitante</div>
            <div className="text-base font-semibold text-gray-800">{datos.visitante}</div>
            <div className="text-sm text-gray-500">Cédula {datos.cedula ?? '—'}{datos.celular ? ` · ☎ ${datos.celular}` : ''}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-400 text-xs">Tarjeta</span><div className="font-medium text-brand">{datos.tarjeta}</div></div>
              <div><span className="text-gray-400 text-xs">Tipo</span><div>{datos.tipo}</div></div>
              <div className="col-span-2"><span className="text-gray-400 text-xs">Paciente / ubicación</span><div>{datos.paciente}</div></div>
              <div className="col-span-2"><span className="text-gray-400 text-xs">Ingreso</span><div>{datos.ingreso}</div></div>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-600">{aviso}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onConfirmar} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
              <svg className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Confirmar salida
            </button>
            <button type="button" onClick={onCerrar} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
              <svg className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" /></svg>
              Cancelar
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
