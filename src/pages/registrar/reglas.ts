// Reglas y textos del registro de visitas, compartidos por la página y sus piezas.
import type { EvalRestriccion, NuevaVisita, VerificacionCenso } from '../../lib/data'
import type { OcupacionUbicacion, TipoVisitante } from '../../lib/types'

// Fecha y hora de ingreso en hora Colombia (GMT-5): "25/06 03:14 p.m."
export function fechaHoraCO(iso: string | null): string {
  if (!iso) return '—'
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dd = String(co.getUTCDate()).padStart(2, '0')
  const mm = String(co.getUTCMonth() + 1).padStart(2, '0')
  let h = co.getUTCHours(); const min = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dd}/${mm} ${h}:${min} ${ap}`
}

// Texto del motivo de autorización a partir de las restricciones detectadas.
export function motivoAutorizacion(r: EvalRestriccion | null): string {
  if (!r) return ''
  const p: string[] = []
  if (r.fueraHorario) p.push(`Fuera de horario (${r.ventanas})`)
  if (r.excedeSimultaneo) p.push(`Excede máx. simultáneo (${r.limiteSimultaneo})`)
  if (r.excedeDia) p.push(`Excede máx. por día (${r.maxPorDia})`)
  return p.join('; ')
}

// La regla institucional: pacientes ≥65 o ≤18 años requieren acompañante permanente.
export const requierePermanente = (edad: number | null | undefined) => edad != null && (edad >= 65 || edad <= 18)

export const TIPOS: { v: TipoVisitante; label: string; icon: string; desc: string }[] = [
  { v: 'familiar', label: 'Familiar', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z', desc: 'Acompañante de un paciente' },
  { v: 'proveedor', label: 'Proveedor', icon: 'M3 7h13v8H3zM16 10h3l2 2v3h-5M5.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', desc: 'Acompañado por responsable' },
  { v: 'colaborador', label: 'Colaborador', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', desc: 'Personal interno' },
  { v: 'sin_tarjeta', label: 'Sin tarjeta', icon: 'M12 9v2m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z', desc: 'Familiar sin ubicación/tarjeta asignada' },
]

export type TipoAviso = 'sinPaciente' | 'autorizacion' | 'tarjeta' | 'sinTarjetas' | 'egreso'

export const restriccionEstaActiva = (r: EvalRestriccion | null) => !!r && (r.fueraHorario || r.excedeSimultaneo || r.excedeDia)

// Lo que hace falta para validar y guardar un ingreso.
export interface DatosRegistro {
  tipo: TipoVisitante
  cedula: string; nombres: string; celular: string; email: string
  sel: OcupacionUbicacion | null
  verif: VerificacionCenso | 'verificando' | null
  restric: EvalRestriccion | null
  tipoAcomp: 'permanente' | 'visita'; permisoOtros: string; responsableId: string; servicioVisita: string
  sedeId: string; puertaId: string; requiereTarjeta: boolean; tarjetaId: string; hayTarjetas: boolean
  autorizadoPorId: string; autorizacionObs: string
}

// Antes de guardar: un mensaje en la página, un aviso modal, o nada (se puede guardar).
// El orden importa: es el mismo en que se le pide al orientador que corrija.
export function validarRegistro(d: DatosRegistro): { msg: string } | { aviso: TipoAviso } | null {
  const familiar = d.tipo === 'familiar'
  if (!d.cedula.trim() || !d.nombres.trim()) return { msg: 'Cédula y nombres son obligatorios.' }
  if (familiar && !d.sel?.num_ingreso) return { msg: 'Selecciona la habitación del paciente en el mapa.' }
  if (familiar && d.verif === 'verificando') return { msg: 'Espera a que termine la verificación de la ubicación en el censo.' }
  if (d.tipo === 'proveedor' && !d.responsableId) return { msg: 'Selecciona la persona responsable que acompaña.' }
  if (d.requiereTarjeta && !d.tarjetaId) return { aviso: d.hayTarjetas ? 'tarjeta' : 'sinTarjetas' }
  // Fuera de horario o excede el cupo ⇒ pedir autorización (permite continuar)
  if (familiar && restriccionEstaActiva(d.restric) && !d.autorizadoPorId) return { aviso: 'autorizacion' }
  return null
}

// Datos de la visita a guardar. `visitanteId` es el del visitante ya creado o actualizado.
export function armarVisita(d: DatosRegistro, visitanteId: string, registradoPor: string | null): NuevaVisita {
  const { tipo, sel } = d
  const autorizado = restriccionEstaActiva(d.restric) && !!d.autorizadoPorId
  const obs = d.autorizacionObs.trim()
  const conAcompanante = tipo === 'familiar' || tipo === 'sin_tarjeta'
  return {
    tipo_visitante: tipo,
    visitante_id: visitanteId,
    tipo_acompanante: conAcompanante ? d.tipoAcomp : null,
    paciente_documento: sel?.num_ingreso ? sel.paciente_documento ?? null : null,
    paciente_nombre: sel?.paciente_nombre ?? null,
    num_ingreso: sel?.num_ingreso ?? null,
    ubicacion_id: sel?.ubicacion_id || null,
    ubicacion_etiqueta: sel?.etiqueta ?? null,
    // Nunca se asume el piso visible en pantalla: un paciente sin cama queda sin piso.
    piso_id: sel?.piso_id || null,
    aislamiento: sel?.aislamiento ?? null,
    responsable_id: tipo === 'proveedor' ? d.responsableId : null,
    autorizado_por_id: autorizado ? d.autorizadoPorId : null,
    autorizacion_motivo: autorizado ? motivoAutorizacion(d.restric) + (obs ? ` — ${obs}` : '') : null,
    permiso_alimentos: false,
    permiso_otros: d.permisoOtros || null,
    servicio_paciente: tipo === 'colaborador' ? d.servicioVisita || null : sel?.servicio ?? sel?.area ?? null,
    sede_id: d.sedeId || null,
    puerta_id: d.puertaId || null,
    tarjeta_id: d.requiereTarjeta ? (d.tarjetaId || null) : null,
    registrado_por: registradoPor,
  }
}
