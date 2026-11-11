import { useCallback, useEffect, useState } from 'react'
import { listSedes, listPisos, listPuertas, listResponsables, listServicios, tarjetasDisponibles } from '../../lib/data'
import type { Sede, Piso, Puerta, Responsable, Servicio, Tarjeta } from '../../lib/types'

// Catálogos de «Registrar visita»: sedes y, de la sede elegida, sus pisos, puertas y tarjetas
// disponibles; más responsables y servicios. Al cambiar de sede se preselecciona el primer
// piso y la primera puerta. La sede de partida es la de trabajo del orientador, si la eligió.
export function useCatalogosSede(sedeTrabajoId: string | null) {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeId, setSedeId] = useState('')
  const [pisos, setPisos] = useState<Piso[]>([])
  const [pisoId, setPisoId] = useState('')
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [puertaId, setPuertaId] = useState('')
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])

  useEffect(() => {
    let vigente = true
    listSedes().then((s) => {
      if (!vigente) return
      setSedes(s)
      const preferida = sedeTrabajoId ? s.find((x) => x.id === sedeTrabajoId) : undefined
      setSedeId((preferida ?? s[0])?.id ?? '')
    })
    return () => { vigente = false }
  }, [sedeTrabajoId])

  useEffect(() => {
    if (!sedeId) return
    // Si se cambia de sede antes de que lleguen, se descartan las respuestas de la anterior.
    let vigente = true
    listPisos(sedeId).then((p) => { if (vigente) { setPisos(p); setPisoId(p[0]?.id ?? '') } })
    listPuertas(sedeId).then((p) => { if (vigente) { setPuertas(p); setPuertaId(p[0]?.id ?? '') } })
    tarjetasDisponibles(sedeId).then((t) => { if (vigente) setTarjetas(t) })
    return () => { vigente = false }
  }, [sedeId])

  useEffect(() => {
    let vigente = true
    listResponsables().then((r) => { if (vigente) setResponsables(r) })
    listServicios().then((s) => { if (vigente) setServicios(s) })
    return () => { vigente = false }
  }, [])

  // Tras registrar un ingreso, la tarjeta usada deja de estar disponible.
  const recargarTarjetas = useCallback(() => { if (sedeId) tarjetasDisponibles(sedeId).then(setTarjetas) }, [sedeId])

  return { sedes, sedeId, setSedeId, pisos, pisoId, setPisoId, puertas, puertaId, setPuertaId, tarjetas, recargarTarjetas, responsables, servicios }
}
