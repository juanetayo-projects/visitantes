import { useEffect, useMemo, useState } from 'react'
import { Badge, FilasEstado, Modal, selectCls } from './ui'
import { pacientesEnAislamiento, type PacienteAislado, type PacienteSinCama } from '../lib/data'
import { AISLAMIENTO_LABEL } from '../lib/types'

// Modales de pacientes que abre el Inicio desde sus tarjetas de indicadores. Antes vivían dentro
// de la página (con su estado, su carga y su buscador), lo que la hacía muy difícil de seguir.

export function ModalSinCama({ abierto, pacientes, onCerrar }: { abierto: boolean; pacientes: PacienteSinCama[]; onCerrar: () => void }) {
  return (
    <Modal open={abierto} onClose={onCerrar} title="Pacientes sin cama asignada" maxWidth="max-w-3xl">
      <p className="mb-3 text-sm text-gray-600">
        Pacientes que el CENSO reporta <b>sin ubicación física</b> (sala de espera de urgencias, recuperación, etc.).
        Búscalos por su número de identificación al registrar una visita.
      </p>
      <div className="max-h-[60vh] overflow-auto rounded-lg ring-1 ring-gray-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-brand text-white"><tr>
            {['Paciente', 'Edad', 'Unidad CENSO', '# Ingreso'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            <FilasEstado cargando={false} vacio={pacientes.length === 0} columnas={4} claseVacio="text-emerald-600" textoVacio="✓ Todos los pacientes tienen cama asignada.">
              {pacientes.map((p) => (
                <tr key={p.num_ingreso} className="hover:bg-brand-50/40">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{p.paciente ?? '—'}</div>
                    <div className="text-xs text-gray-500">ID {p.documento ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.edad ?? '—'}</td>
                  <td className="px-3 py-2"><Badge color="amber"><span className="whitespace-nowrap">{p.unidad ?? '—'}</span></Badge></td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.num_ingreso}</td>
                </tr>
              ))}
            </FilasEstado>
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right text-xs text-gray-400">{pacientes.length} paciente(s)</div>
    </Modal>
  )
}

// Resumen por tipo de aislamiento (de mayor a menor), para los chips que filtran la lista.
function conteoPorTipo(lista: PacienteAislado[]): [string, number][] {
  const m = new Map<string, number>()
  lista.forEach((p) => { const k = AISLAMIENTO_LABEL[p.tipo] ?? p.tipo; m.set(k, (m.get(k) ?? 0) + 1) })
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

// Se monta solo mientras está abierto (ver Dashboard): cada apertura empieza con el estado limpio
// y consulta la foto más reciente del censo, sin borrar nada a mano desde un efecto.
export function ModalAislados({ onCerrar }: { onCerrar: () => void }) {
  const [aislados, setAislados] = useState<PacienteAislado[] | null>(null)
  const [busca, setBusca] = useState('')
  useEffect(() => {
    let vigente = true
    pacientesEnAislamiento().then((a) => { if (vigente) setAislados(a) })
    return () => { vigente = false }
  }, [])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!aislados || !t) return aislados ?? []
    return aislados.filter((p) => [p.paciente, p.documento, p.ubicacion, p.piso, AISLAMIENTO_LABEL[p.tipo]].some((x) => x?.toLowerCase().includes(t)))
  }, [aislados, busca])
  const total = aislados?.length ?? 0

  return (
    <Modal open onClose={onCerrar} title="Pacientes en aislamiento" maxWidth="max-w-4xl">
      <p className="mb-3 text-sm text-gray-600">
        Pacientes con <b>aislamiento vigente</b> según el CENSO. Antes de autorizar una visita, recuerda al acompañante las
        precauciones del tipo de aislamiento.
      </p>
      {total > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* Resumen por tipo: clic para buscar solo ese tipo */}
          {conteoPorTipo(aislados ?? []).map(([k, n]) => (
            <button key={k} type="button" aria-pressed={busca === k} onClick={() => setBusca(busca === k ? '' : k)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${busca === k ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
              {k} · {n}
            </button>
          ))}
          <input aria-label="Buscar por paciente, cédula, ubicación" className={`${selectCls} ml-auto w-60`} placeholder="Buscar paciente, cédula, ubicación…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      )}
      <div className="max-h-[60vh] overflow-auto rounded-lg ring-1 ring-gray-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-brand text-white"><tr>
            {['Paciente', 'Edad', 'Ubicación', 'Aislamiento', '# Ingreso'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            <FilasEstado cargando={aislados == null} vacio={filtrados.length === 0} columnas={5} claseVacio="text-emerald-600"
              textoVacio={total ? 'Sin resultados para esta búsqueda.' : '✓ No hay pacientes en aislamiento.'}>
              {filtrados.map((p) => (
                <tr key={`${p.num_ingreso}-${p.tipo}`} className="hover:bg-brand-50/40">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-800">{p.paciente ?? '—'}</div>
                    <div className="text-xs text-gray-500">ID {p.documento ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.edad ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="text-gray-800">{p.ubicacion ?? 'Sin cama asignada'}</div>
                    <div className="text-xs text-gray-500">{p.piso ?? p.servicio ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2"><Badge color="red"><span className="whitespace-nowrap">{AISLAMIENTO_LABEL[p.tipo] ?? p.tipo}</span></Badge></td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.num_ingreso}</td>
                </tr>
              ))}
            </FilasEstado>
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right text-xs text-gray-400">{filtrados.length}{total > 0 && filtrados.length !== total ? ` de ${total}` : ''} paciente(s)</div>
    </Modal>
  )
}
