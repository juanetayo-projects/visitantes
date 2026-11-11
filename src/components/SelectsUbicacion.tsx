import { useEffect, useState } from 'react'
import { selectCls } from './ui'
import { listSedes, listPisos, listUbicaciones } from '../lib/data'
import type { Sede, Piso, Ubicacion } from '../lib/types'

// Filtros en cascada sede → piso → ubicación. Antes cada página (Visitas, Histórico, Tarjetas,
// Inicio) repetía los mismos tres estados, los mismos tres efectos de carga y los mismos selects.

export interface ValorUbicacion { sedeId?: string; pisoId?: string; ubicacionId?: string }

// Catálogos de la cascada: pisos de la sede elegida y ubicaciones del piso elegido.
// Cada carga descarta su respuesta si la selección cambió mientras llegaba.
export function useUbicacionesFiltro(sedeId?: string, pisoId?: string) {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  useEffect(() => { let vigente = true; listSedes().then((s) => { if (vigente) setSedes(s) }); return () => { vigente = false } }, [])
  useEffect(() => {
    if (!sedeId) { setPisos([]); return }
    let vigente = true
    listPisos(sedeId).then((p) => { if (vigente) setPisos(p) })
    return () => { vigente = false }
  }, [sedeId])
  useEffect(() => {
    if (!pisoId) { setUbicaciones([]); return }
    let vigente = true
    listUbicaciones(pisoId).then((u) => { if (vigente) setUbicaciones(u) })
    return () => { vigente = false }
  }, [pisoId])
  return { sedes, pisos, ubicaciones }
}

// Al cambiar un nivel se limpian los de abajo (otra sede ⇒ ningún piso ni ubicación elegidos).
export function SelectsUbicacion({ valor, onCambio, sedes, pisos, ubicaciones }: {
  valor: ValorUbicacion
  onCambio: (cambio: ValorUbicacion) => void
  sedes: Sede[]
  pisos: Piso[]
  // Si se omite, solo se muestran sede y piso.
  ubicaciones?: Ubicacion[]
}) {
  const { sedeId = '', pisoId = '', ubicacionId = '' } = valor
  return (
    <>
      <select aria-label="Sede" className={selectCls} value={sedeId} onChange={(e) => onCambio({ sedeId: e.target.value, pisoId: '', ubicacionId: '' })}>
        <option value="">Todas las sedes</option>
        {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <select aria-label="Piso" className={selectCls} value={pisoId} disabled={!sedeId} onChange={(e) => onCambio({ pisoId: e.target.value, ubicacionId: '' })}>
        <option value="">{sedeId ? 'Todos los pisos' : 'Elige sede'}</option>
        {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
      {ubicaciones && (
        <select aria-label="Ubicación" className={selectCls} value={ubicacionId} disabled={!pisoId} onChange={(e) => onCambio({ ubicacionId: e.target.value })}>
          <option value="">{pisoId ? 'Todas las ubicaciones' : 'Elige piso'}</option>
          {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}{u.area ? ` (${u.area})` : ''}</option>)}
        </select>
      )}
    </>
  )
}
